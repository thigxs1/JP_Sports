import socket
import json
import os
import sys

BLENDER_SCRIPT = r'''
import bpy
import bmesh
import math
import mathutils
import os
import struct
import zlib

# 1. Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

for block in list(bpy.data.meshes):
    bpy.data.meshes.remove(block)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)

project_root = r"D:\02_Projetos\03_Hacking\teste_REA\perfil_sports"
orig_obj_path = os.path.join(project_root, "app", "models", "objeto.obj")
out_obj_path = os.path.join(project_root, "app", "models", "kit_completo.obj")
tex_dir = os.path.join(project_root, "app", "assets", "textures")
os.makedirs(tex_dir, exist_ok=True)

# 2. Import original shirt OBJ (keeping raw coordinates: forward_axis='Y', up_axis='Z' so no axis swap occurs)
bpy.ops.wm.obj_import(
    filepath=orig_obj_path,
    import_vertex_groups=True,
    forward_axis='Y',
    up_axis='Z'
)

base_obj = bpy.context.selected_objects[0]
base_obj.name = "Base_Imported"
mesh = base_obj.data
vg_names = {vg.index: vg.name for vg in base_obj.vertex_groups}

# Helper to extract a new object from a subset of polygon indices
def extract_submesh(src_obj, name, allowed_groups):
    src_mesh = src_obj.data
    uv_layer_src = src_mesh.uv_layers.active.data

    bm = bmesh.new()
    uv_layer_dst = bm.loops.layers.uv.new("UVMap")

    vert_map = {}
    for poly in src_mesh.polygons:
        poly_groups = set()
        for v_idx in poly.vertices:
            for g in src_mesh.vertices[v_idx].groups:
                if g.weight > 0.5 and g.group in vg_names:
                    poly_groups.add(vg_names[g.group])
        if poly_groups & allowed_groups:
            face_verts = []
            face_uvs = []
            for loop_idx in poly.loop_indices:
                v_idx = src_mesh.loops[loop_idx].vertex_index
                if v_idx not in vert_map:
                    vert_map[v_idx] = bm.verts.new(src_mesh.vertices[v_idx].co)
                face_verts.append(vert_map[v_idx])
                face_uvs.append(uv_layer_src[loop_idx].uv.copy())
            try:
                f = bm.faces.new(face_verts)
                for loop, uv in zip(f.loops, face_uvs):
                    loop[uv_layer_dst].uv = uv
            except ValueError:
                pass

    new_mesh = bpy.data.meshes.new(name)
    bm.to_mesh(new_mesh)
    bm.free()
    new_mesh.update()

    new_obj = bpy.data.objects.new(name, new_mesh)
    bpy.context.collection.objects.link(new_obj)
    return new_obj

# Extract Camisa_Corpo, Gola_V, Punhos
camisa_obj = extract_submesh(base_obj, "Camisa_Corpo", {"40", "36", "61", "8"})
gola_v_obj = extract_submesh(base_obj, "Gola_V", {"Pattern_1144504", "Pattern_1144506"})
punhos_obj = extract_submesh(base_obj, "Punhos", {"Pattern_1573565", "Pattern_1573566", "Pattern_1573567", "Pattern_1573568"})

# Remove base imported object
bpy.data.objects.remove(base_obj, do_unlink=True)

# 3. Extract the exact neck seam curve from Gola_V to build Gola_Redonda and Gola_Polo
# Sample angular bins around the neck center (x=0, z=0.07) to get a clean 64-point seam ring
gola_v_verts = [v.co.copy() for v in gola_v_obj.data.vertices]
body_verts = [v.co.copy() for v in camisa_obj.data.vertices if v.co.y > 5.0]

# Find the lower/outer seam points of Gola_V that touch Camisa_Corpo
N_RING = 64
seam_ring = []
neck_center_z = 0.073

for i in range(N_RING):
    theta = -math.pi + (2.0 * math.pi * i) / N_RING
    # Find vertices in Gola_V near this angle
    best_v = None
    best_score = 1e9
    for co in gola_v_verts:
        ang = math.atan2(co.z - neck_center_z, co.x)
        diff = abs((ang - theta + math.pi) % (2.0 * math.pi) - math.pi)
        if diff < 0.22:
            # Prefer vertices closer to body seam (lower y / outer radius)
            dist_body = min((co - bv).length for bv in body_verts)
            score = dist_body + diff * 0.15
            if score < best_score:
                best_score = score
                best_v = co
    if best_v is None:
        # Analytic fallback
        rx = 0.26 * math.cos(theta)
        rz = neck_center_z + 0.195 * math.sin(theta)
        ry = 5.17 - 0.095 * math.sin(theta)
        best_v = mathutils.Vector((rx, ry, rz))
    seam_ring.append(best_v.copy())

# Smooth the seam ring slightly so procedural collars have silky-smooth topology
def smooth_ring(ring, passes=2):
    pts = [p.copy() for p in ring]
    n = len(pts)
    for _ in range(passes):
        nxt = []
        for i in range(n):
            p_prev = pts[(i - 1) % n]
            p_curr = pts[i]
            p_next = pts[(i + 1) % n]
            nxt.append(p_prev * 0.25 + p_curr * 0.5 + p_next * 0.25)
        pts = nxt
    return pts

seam_ring = smooth_ring(seam_ring, passes=3)

# 4. Build Gola_Redonda (Crew Neck / Gola Careca Redonda)
def build_gola_redonda(seam_pts):
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    n = len(seam_pts)
    center = mathutils.Vector((0.0, 5.18, neck_center_z))

    # Crew neck fills the sharp front V slightly and forms a rounded ribbed band
    rings = []
    # 5 cross-section profile steps: outer base -> mid outer -> top rim -> inner rim -> inner base
    profile = [
        (0.00, -0.004, 0.0),    # 0: seated slightly inside seam
        (0.18,  0.014, 0.35),   # 1: rising ribbed band
        (0.36,  0.032, 0.75),   # 2: rounded top edge
        (0.42,  0.026, 1.00),   # 3: inner fold
        (0.28, -0.005, 0.85),   # 4: inner lining meeting neck
    ]

    for r_idx, (inward, dy, round_fill) in enumerate(profile):
        ring_bm = []
        for i, p in enumerate(seam_pts):
            theta = -math.pi + (2.0 * math.pi * i) / n
            # At the front (theta ~ pi/2), lift the V dip into a smooth round curve
            front_factor = max(0.0, math.sin(theta)) ** 2.2
            v_lift = front_factor * 0.022 * round_fill
            z_round = -front_factor * 0.018 * round_fill

            radial = mathutils.Vector((p.x, 0.0, p.z - neck_center_z))
            rad_dir = radial.normalized() if radial.length > 1e-4 else mathutils.Vector((1, 0, 0))

            pos = mathutils.Vector((
                p.x - rad_dir.x * (inward * 0.095),
                p.y + dy + v_lift,
                p.z - rad_dir.z * (inward * 0.095) + z_round
            ))
            ring_bm.append(bm.verts.new(pos))
        rings.append(ring_bm)

    for r in range(len(rings) - 1):
        for i in range(n):
            i_next = (i + 1) % n
            v1 = rings[r][i]
            v2 = rings[r][i_next]
            v3 = rings[r + 1][i_next]
            v4 = rings[r + 1][i]
            f = bm.faces.new((v1, v2, v3, v4))
            # Map UVs into the collar UV band (u: 0.35..0.65, v: 0.728..0.741) so SVG cor3 colors it!
            u1 = 0.35 + 0.30 * (i / n)
            u2 = 0.35 + 0.30 * ((i + 1) / n)
            v_coord1 = 0.728 + 0.012 * (r / (len(rings) - 1))
            v_coord2 = 0.728 + 0.012 * ((r + 1) / (len(rings) - 1))
            f.loops[0][uv_layer].uv = (u1, v_coord1)
            f.loops[1][uv_layer].uv = (u2, v_coord1)
            f.loops[2][uv_layer].uv = (u2, v_coord2)
            f.loops[3][uv_layer].uv = (u1, v_coord2)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    m = bpy.data.meshes.new("Gola_Redonda")
    bm.to_mesh(m)
    bm.free()
    m.update()
    obj = bpy.data.objects.new("Gola_Redonda", m)
    bpy.context.collection.objects.link(obj)
    return obj

gola_redonda_obj = build_gola_redonda(seam_ring)

# 5. Build Gola_Polo (Folded Polo Collar + Front Placket)
def build_gola_polo(seam_pts):
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    n = len(seam_pts)

    # Part A: Collar Stand + Folded Down Collar Wings (covering back and sides, opening at front V)
    # Reorder indices starting from front-right (theta ~ 75 deg) going around back to front-left (theta ~ 105 deg)
    ordered_indices = []
    for step in range(n + 1):
        # Angle from +102 deg Counter-Clockwise (going via 0, -90 back, -180) to +78 deg
        ang_deg = 102.0 - (336.0 * step) / n
        ang_rad = math.radians(ang_deg)
        # Find closest point in seam_pts
        best_i = min(range(n), key=lambda idx: abs(((-math.pi + 2*math.pi*idx/n) - ang_rad + math.pi) % (2*math.pi) - math.pi))
        ordered_indices.append((best_i, step / n))

    # Deduplicate consecutive identical indices while keeping t parameter
    arc_pts = []
    for idx, t in ordered_indices:
        if not arc_pts or arc_pts[-1][0] != idx:
            arc_pts.append((seam_pts[idx].copy(), t))

    # Build 5 profile rows for the Polo Collar:
    # 0: neck seam base
    # 1: inner stand rising up (+0.042 in Y)
    # 2: top fold crease (+0.058 in Y, slightly outward)
    # 3: folded-down outer wing mid (+0.025 in Y, outward +0.038)
    # 4: folded-down outer wing tip (-0.012 in Y, outward +0.062, pointed at front ends)
    polo_rings = []
    profile_polo = [
        (-0.008, -0.002, 0.0),   # 0: seam base
        (-0.012,  0.036, 0.4),   # 1: high stand
        ( 0.006,  0.052, 0.8),   # 2: fold crest
        ( 0.032,  0.022, 1.0),   # 3: outer flap mid
        ( 0.052, -0.016, 1.25),  # 4: outer flap lower edge
    ]

    for r_idx, (out_dist, dy, tip_flare) in enumerate(profile_polo):
        row_verts = []
        for p, t in arc_pts:
            # t goes 0.0 (front left) -> 0.5 (back center) -> 1.0 (front right)
            end_Dist = min(t, 1.0 - t)  # 0 at front tips, 0.5 at back
            # Taper stand height right at the very tips, flare the polo points at front tips
            stand_taper = min(1.0, end_Dist * 7.5 + 0.25)
            point_drop = (1.0 - min(1.0, end_Dist * 4.5)) * 0.028 * tip_flare

            radial = mathutils.Vector((p.x, 0.0, p.z - neck_center_z))
            rad_dir = radial.normalized() if radial.length > 1e-4 else mathutils.Vector((0, 0, 1))

            pos = mathutils.Vector((
                p.x + rad_dir.x * out_dist * (1.0 + 0.25 * tip_flare * (1.0 - end_Dist)),
                p.y + dy * stand_taper - point_drop,
                p.z + rad_dir.z * out_dist * (1.0 + 0.25 * tip_flare * (1.0 - end_Dist))
            ))
            row_verts.append((bm.verts.new(pos), t))
        polo_rings.append(row_verts)

    for r in range(len(polo_rings) - 1):
        for i in range(len(arc_pts) - 1):
            v1, t1 = polo_rings[r][i]
            v2, t2 = polo_rings[r][i + 1]
            v3, _  = polo_rings[r + 1][i + 1]
            v4, _  = polo_rings[r + 1][i]
            f = bm.faces.new((v1, v2, v3, v4))
            u1 = 0.35 + 0.30 * t1
            u2 = 0.35 + 0.30 * t2
            vc1 = 0.728 + 0.012 * (r / (len(polo_rings) - 1))
            vc2 = 0.728 + 0.012 * ((r + 1) / (len(polo_rings) - 1))
            f.loops[0][uv_layer].uv = (u1, vc1)
            f.loops[1][uv_layer].uv = (u2, vc1)
            f.loops[2][uv_layer].uv = (u2, vc2)
            f.loops[3][uv_layer].uv = (u1, vc2)

    # Part B: Front Polo Button Placket (Peitilho vertical abaixo da gola)
    placket_w = 0.028
    placket_top_y = 5.082
    placket_bot_y = 4.915
    z_top = 0.278
    z_bot = 0.302
    pv1 = bm.verts.new((-placket_w, placket_bot_y, z_bot))
    pv2 = bm.verts.new(( placket_w, placket_bot_y, z_bot))
    pv3 = bm.verts.new(( placket_w, placket_top_y, z_top))
    pv4 = bm.verts.new((-placket_w, placket_top_y, z_top))
    pf = bm.faces.new((pv1, pv2, pv3, pv4))
    for loop in pf.loops:
        loop[uv_layer].uv = (0.50, 0.735)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    m = bpy.data.meshes.new("Gola_Polo")
    bm.to_mesh(m)
    bm.free()
    m.update()
    obj = bpy.data.objects.new("Gola_Polo", m)
    bpy.context.collection.objects.link(obj)
    return obj

gola_polo_obj = build_gola_polo(seam_ring)

# 6. Build Anatomically Proportioned Soccer Shorts (Calcao)
# Shirt bottom hem is at Y=3.131..3.18, X=-0.58..0.58, Z=-0.40..0.43
def build_calcao():
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    # Build left and right leg + upper pelvis seamlessly using unified cross-sections
    # From Y=3.18 (waist) down to Y=2.62 (crotch split), then two separate legs from Y=2.62 down to Y=1.82 (knee/thigh hem)
    n_seg = 48
    waist_levels = [
        # (y, rx, rz, fold_amp)
        (3.175, 0.545, 0.365, 0.004),
        (3.060, 0.565, 0.385, 0.006),
        (2.920, 0.585, 0.400, 0.008),
        (2.770, 0.595, 0.405, 0.010),
    ]

    # Create each leg as a smooth anatomical tube that merges at the hip/waistband
    for side in (-1, 1):  # -1 = Right Leg (viewer left), +1 = Left Leg (viewer right)
        leg_rings = []
        leg_levels = [
            # (y, center_x, rx, rz, flare)
            (3.175, side * 0.255, 0.295, 0.365, 0.004),
            (3.040, side * 0.260, 0.308, 0.382, 0.006),
            (2.880, side * 0.265, 0.318, 0.392, 0.008),
            (2.720, side * 0.270, 0.312, 0.380, 0.010),
            (2.540, side * 0.278, 0.302, 0.355, 0.011),
            (2.340, side * 0.286, 0.295, 0.335, 0.012),
            (2.120, side * 0.292, 0.288, 0.320, 0.012),
            (1.920, side * 0.296, 0.282, 0.310, 0.010),
            (1.850, side * 0.298, 0.278, 0.305, 0.006),
        ]
        n_leg = 36
        for lvl_idx, (y_val, cx, rx, rz, fold_amp) in enumerate(leg_levels):
            ring = []
            v_param = 1.0 - (lvl_idx / (len(leg_levels) - 1))
            for i in range(n_leg):
                theta = (2.0 * math.pi * i) / n_leg
                # Flatten inner seam near crotch for realistic shorts silhouette
                cos_t = math.cos(theta)
                sin_t = math.sin(theta)
                x_raw = cx + rx * cos_t
                # Above crotch (y > 2.65), clamp inner boundary cleanly to X=0 center seam
                if y_val > 2.60 and ((side < 0 and x_raw > 0.002) or (side > 0 and x_raw < -0.002)):
                    x_raw = 0.0
                elif y_val <= 2.60 and ((side < 0 and x_raw > -0.035) or (side > 0 and x_raw < 0.035)):
                    x_raw = side * 0.035 + (x_raw - side * 0.035) * 0.35

                # Subtle cloth drape folds
                drape = fold_amp * math.sin(theta * 5.0 + lvl_idx * 0.6)
                z_raw = rz * sin_t + drape + 0.02

                v = bm.verts.new((x_raw, y_val, z_raw))
                # UV mapping: map right leg to u in [0.0..0.5], left leg to u in [0.5..1.0]
                u_base = (i / n_leg) * 0.48 + (0.01 if side < 0 else 0.51)
                ring.append((v, u_base, v_param))
            leg_rings.append(ring)

        for r in range(len(leg_rings) - 1):
            for i in range(n_leg):
                i_next = (i + 1) % n_leg
                v1, u1, vp1 = leg_rings[r][i]
                v2, u2, _   = leg_rings[r][i_next]
                v3, _,  vp2 = leg_rings[r + 1][i_next]
                v4, _,  _   = leg_rings[r + 1][i]
                if i == n_leg - 1:
                    u2 = u1 + (0.48 / n_leg)
                f = bm.faces.new((v1, v2, v3, v4))
                f.loops[0][uv_layer].uv = (u1, vp1)
                f.loops[1][uv_layer].uv = (u2, vp1)
                f.loops[2][uv_layer].uv = (u2, vp2)
                f.loops[3][uv_layer].uv = (u1, vp2)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    m = bpy.data.meshes.new("Calcao")
    bm.to_mesh(m)
    bm.free()
    m.update()
    obj = bpy.data.objects.new("Calcao", m)
    bpy.context.collection.objects.link(obj)
    return obj

calcao_obj = build_calcao()

# 7. Build Pair of Soccer Socks (Meiao) positioned below the shorts (matching reference bottom view)
def build_meiao():
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    for side in (-1, 1):
        sock_rings = []
        sock_levels = [
            # (y, cx, rx, rz) - Top cuff turnover down to calf/shin
            (1.620, side * 0.295, 0.168, 0.175),
            (1.540, side * 0.295, 0.174, 0.182),
            (1.420, side * 0.295, 0.166, 0.174),
            (1.250, side * 0.292, 0.160, 0.168),
            (1.050, side * 0.288, 0.146, 0.155),
            (0.850, side * 0.285, 0.130, 0.140),
            (0.650, side * 0.282, 0.118, 0.128),
        ]
        n_sock = 28
        for lvl_idx, (y_val, cx, rx, rz) in enumerate(sock_levels):
            ring = []
            vp = 1.0 - (lvl_idx / (len(sock_levels) - 1))
            for i in range(n_sock):
                theta = (2.0 * math.pi * i) / n_sock
                x_val = cx + rx * math.cos(theta)
                z_val = rz * math.sin(theta) + 0.01
                v = bm.verts.new((x_val, y_val, z_val))
                u_val = i / n_sock
                ring.append((v, u_val, vp))
            sock_rings.append(ring)

        for r in range(len(sock_rings) - 1):
            for i in range(n_sock):
                i_next = (i + 1) % n_sock
                v1, u1, vp1 = sock_rings[r][i]
                v2, u2, _   = sock_rings[r][i_next]
                v3, _,  vp2 = sock_rings[r + 1][i_next]
                v4, _,  _   = sock_rings[r + 1][i]
                if i == n_sock - 1:
                    u2 = 1.0
                f = bm.faces.new((v1, v2, v3, v4))
                f.loops[0][uv_layer].uv = (u1, vp1)
                f.loops[1][uv_layer].uv = (u2, vp1)
                f.loops[2][uv_layer].uv = (u2, vp2)
                f.loops[3][uv_layer].uv = (u1, vp2)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    m = bpy.data.meshes.new("Meiao")
    bm.to_mesh(m)
    bm.free()
    m.update()
    obj = bpy.data.objects.new("Meiao", m)
    bpy.context.collection.objects.link(obj)
    return obj

meiao_obj = build_meiao()

# 8. Smooth shading on all generated meshes
for obj_item in [camisa_obj, gola_v_obj, gola_redonda_obj, gola_polo_obj, punhos_obj, calcao_obj, meiao_obj]:
    for poly in obj_item.data.polygons:
        poly.use_smooth = True

# 9. Generate Tileable 256x256 PBR Dry-Fit Normal Map and Roughness Map PNGs
def write_png(filepath, width, height, rgba_bytes):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # Filter type 0
        raw.extend(rgba_bytes[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    with open(filepath, "wb") as f:
        f.write(png)

W, H = 256, 256
norm_buf = bytearray(W * H * 4)
rough_buf = bytearray(W * H * 4)

# Dry-fit hexagonal micro-pore pattern
for y in range(H):
    for x in range(W):
        # Seamless periodic coordinates (16x16 knit cells per tile)
        fx = (x / W) * 16.0 * 2.0 * math.pi
        fy = (y / H) * 16.0 * 2.0 * math.pi
        # Knit micro-ridge derivatives
        dx = 0.28 * math.cos(fx) + 0.18 * math.cos(fx + fy) - 0.18 * math.cos(fx - fy)
        dy = 0.28 * math.cos(fy) + 0.18 * math.cos(fx + fy) + 0.18 * math.cos(fx - fy)
        nz = 1.0
        inv_len = 1.0 / math.sqrt(dx * dx + dy * dy + nz * nz)
        nx_u8 = int(max(0, min(255, (dx * inv_len * 0.5 + 0.5) * 255)))
        ny_u8 = int(max(0, min(255, (dy * inv_len * 0.5 + 0.5) * 255)))
        nz_u8 = int(max(0, min(255, (nz * inv_len * 0.5 + 0.5) * 255)))

        idx = (y * W + x) * 4
        norm_buf[idx : idx + 4] = bytes((nx_u8, ny_u8, nz_u8, 255))

        # Roughness variation (pores slightly rougher ~0.78, knit threads slightly smoother ~0.58)
        pore = 0.5 + 0.25 * math.sin(fx) * math.sin(fy)
        r_u8 = int(max(0, min(255, (0.55 + 0.22 * pore) * 255)))
        rough_buf[idx : idx + 4] = bytes((r_u8, r_u8, r_u8, 255))

norm_path = os.path.join(tex_dir, "dryfit_normal.png")
rough_path = os.path.join(tex_dir, "dryfit_roughness.png")
write_png(norm_path, W, H, norm_buf)
write_png(rough_path, W, H, rough_buf)

# 10. Assign Live Blender PBR Materials so the user sees the green/white kit in Blender's viewport
def create_pbr_mat(name, base_rgba, roughness=0.65):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_rgba
        bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = base_rgba
    return mat

mat_shirt = create_pbr_mat("Mat_Camisa_Verde", (0.0, 0.35, 0.075, 1.0), 0.62)
mat_white = create_pbr_mat("Mat_Detalhe_Branco", (0.96, 0.96, 0.96, 1.0), 0.58)
mat_shorts = create_pbr_mat("Mat_Calcao_Branco", (0.95, 0.95, 0.96, 1.0), 0.60)
mat_socks = create_pbr_mat("Mat_Meiao_Verde", (0.0, 0.32, 0.065, 1.0), 0.68)

for o, m in [
    (camisa_obj, mat_shirt),
    (gola_v_obj, mat_white),
    (gola_redonda_obj, mat_white),
    (gola_polo_obj, mat_white),
    (punhos_obj, mat_white),
    (calcao_obj, mat_shorts),
    (meiao_obj, mat_socks),
]:
    o.data.materials.clear()
    o.data.materials.append(m)

# Select all 7 kit objects and export to kit_completo.obj (preserving raw Y-up coordinate space)
bpy.ops.object.select_all(action='DESELECT')
for o in [camisa_obj, gola_v_obj, gola_redonda_obj, gola_polo_obj, punhos_obj, calcao_obj, meiao_obj]:
    o.select_set(True)

bpy.ops.wm.obj_export(
    filepath=out_obj_path,
    export_selected_objects=True,
    export_uv=True,
    export_normals=True,
    export_materials=False,
    export_object_groups=False,
    forward_axis='Y',
    up_axis='Z'
)

# In live Blender viewport, rotate the root visual or hide alternate collars so the user sees Gola_V active
gola_redonda_obj.hide_viewport = True
gola_polo_obj.hide_viewport = True

# Add Studio Lighting & Camera in Blender scene
light_data = bpy.data.lights.new(name="Studio_Key_Light", type='AREA')
light_data.energy = 250.0
light_obj = bpy.data.objects.new(name="Studio_Key_Light", object_data=light_data)
light_obj.location = (2.5, 4.5, 3.5)
bpy.context.collection.objects.link(light_obj)

print("KIT_EXPORT_OK:", os.path.exists(out_obj_path), os.path.getsize(out_obj_path))
'''

def main():
    payload = json.dumps({
        "type": "execute_code",
        "params": {"code": BLENDER_SCRIPT}
    }).encode("utf-8")

    with socket.create_connection(("127.0.0.1", 9876), timeout=30) as sock:
        sock.sendall(payload)
        chunks = []
        while True:
            data = sock.recv(65536)
            if not data:
                break
            chunks.append(data)
            try:
                resp = json.loads(b"".join(chunks).decode("utf-8"))
                print("Blender MCP Response:", json.dumps(resp, indent=2))
                if resp.get("status") != "success":
                    sys.exit(1)
                return
            except json.JSONDecodeError:
                continue

if __name__ == "__main__":
    main()
