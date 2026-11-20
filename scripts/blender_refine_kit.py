# Executado DENTRO do Blender (via: node scripts/blender_exec.js scripts/blender_refine_kit.py)
# Refina o kit_completo.obj para realismo comercial:
#  - solda vertices duplicados (remove "facetado" e rachaduras de shading)
#  - subdivisao Catmull-Clark preservando UVs (silhueta suave, sem poligonos visiveis)
#  - drapeado/rugas sutis de tecido via Displace procedural (sem quebrar UV)
#  - espessura real do tecido (Solidify) para bainhas/golas nao parecerem "papel"
#  - normais suaves exportadas no OBJ (o app usa as normais do arquivo)
import bpy, bmesh, os, shutil

root = r"D:\02_Projetos\03_Hacking\teste_REA\perfil_sports"
models = os.path.join(root, "app", "models")
src = os.path.join(models, "kit_completo.obj")
backup = os.path.join(models, "kit_completo_v1_backup.obj")
if not os.path.exists(backup):
    shutil.copyfile(src, backup)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for m in list(bpy.data.meshes):
    bpy.data.meshes.remove(m)
for t in list(bpy.data.textures):
    bpy.data.textures.remove(t)

bpy.ops.wm.obj_import(filepath=backup, forward_axis='Y', up_axis='Z')
objs = {o.name: o for o in bpy.context.selected_objects}

# ---------------------------------------------------------------------------
# Calcao v2: calcao de futebol com topologia real (uma peca so)
#  - cos elastico com leve volume, quadril unico, gancho/entrepernas costurado
#    em x=0 (vertices compartilhados entre as pernas = malha fechada, sem
#    paredes internas), pernas com abertura em leve "A" e fenda lateral na barra.
# Layout UV (canvas 1024x1024 do app): perna direita u 0.0-0.5, esquerda 0.5-1.0.
#   dentro de cada metade: frente-centro 0.02 -> lateral 0.22 -> costas 0.42
#   -> entrepernas 0.48.  v = altura (barra=0, cos=1).
# ---------------------------------------------------------------------------
import math

def build_calcao_v2():
    Y_TOP, Y_HEM = 3.30, 1.95
    CZ = 0.03
    N_ARC = 24          # segmentos de cada meia-volta (frente -> lateral -> costas)
    N_GUS = 8           # segmentos do entrepernas (costas -> frente)

    def vcoord(y):
        return (y - 1.85) / (Y_TOP - 1.85)

    # niveis do quadril: (y, rx, rz, bojo)
    hip = [
        (3.30, 0.530, 0.360, 0.000),
        (3.265, 0.545, 0.372, 0.010),   # cos elastico (volume)
        (3.225, 0.540, 0.368, 0.000),
        (3.12, 0.565, 0.388, 0.000),
        (2.98, 0.590, 0.402, 0.000),
        (2.84, 0.600, 0.410, 0.000),
        (2.70, 0.598, 0.408, 0.000),
    ]
    Y_CROTCH = hip[-1][0]

    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")

    # ---- aneis do quadril: 2*N_ARC pontos; t=pi/2 frente, t=3pi/2 costas
    hip_rings = []
    for (y, rx, rz, bulge) in hip:
        ring = []
        for k in range(2 * N_ARC):
            t = math.pi / 2 + math.pi * k / N_ARC
            r = 1.0 + bulge
            x = rx * r * math.cos(t)
            z = CZ + rz * r * math.sin(t)
            # nadegas: costas um pouco mais cheias, frente mais reta
            if math.sin(t) < 0:
                z -= 0.025 * (-math.sin(t)) * (1.0 if y < 3.2 else 0.3)
            ring.append(bm.verts.new((x, y, z)))
        hip_rings.append(ring)

    def arc_pts(ring, side):
        # side -1 (x<0): k = 0..N_ARC (frente -> lateral dir -> costas)
        # side +1 (x>0): frente -> lateral esq -> costas (indo pelo outro lado)
        if side < 0:
            return [ring[k] for k in range(N_ARC + 1)]
        return [ring[(2 * N_ARC - k) % (2 * N_ARC)] for k in range(N_ARC + 1)]

    # ---- entrepernas compartilhado (costas -> frente), x=0, com leve caimento
    zb = hip_rings[-1][N_ARC].co.z
    zf = hip_rings[-1][0].co.z
    gusset = []
    for g in range(1, N_GUS):
        s = g / N_GUS
        z = zb + (zf - zb) * s
        y = Y_CROTCH - 0.07 * math.sin(math.pi * s)
        gusset.append(bm.verts.new((0.0, y, z)))

    def u_of(j, n_ring, side):
        # j em [0..N_ARC] arco, (N_ARC..n_ring) entrepernas
        if j <= N_ARC:
            ul = 0.02 + 0.40 * j / N_ARC
        else:
            ul = 0.42 + 0.06 * (j - N_ARC) / (n_ring - N_ARC)
        return ul + (0.0 if side < 0 else 0.5)

    def quad(a, b, c, d, uva, uvb, uvc, uvd, flip):
        vs, uvs = [a, b, c, d], [uva, uvb, uvc, uvd]
        if flip:
            vs.reverse(); uvs.reverse()
        try:
            f = bm.faces.new(vs)
        except ValueError:
            return
        for lp, uv in zip(f.loops, uvs):
            lp[uvl].uv = uv

    # faces do quadril (cada metade com sua faixa de UV)
    for side in (-1, 1):
        flip = side > 0
        for li in range(len(hip_rings) - 1):
            A = arc_pts(hip_rings[li], side)
            B = arc_pts(hip_rings[li + 1], side)
            va, vb = vcoord(hip[li][0]), vcoord(hip[li + 1][0])
            for j in range(N_ARC):
                ua, ub = u_of(j, N_ARC + N_GUS, side), u_of(j + 1, N_ARC + N_GUS, side)
                quad(A[j], A[j + 1], B[j + 1], B[j], (ua, va), (ub, va), (ub, vb), (ua, vb), flip)

    # ---- pernas
    legs_lv = [
        # (y, rx, rz, cx, abertura_lateral)
        (2.56, 0.305, 0.385, 0.300),
        (2.40, 0.300, 0.370, 0.305),
        (2.24, 0.298, 0.358, 0.310),
        (2.09, 0.300, 0.350, 0.316),
        (1.95, 0.305, 0.345, 0.322),
    ]
    n_ring = N_ARC + N_GUS
    for side in (-1, 1):
        flip = side > 0
        top = arc_pts(hip_rings[-1], side) + list(reversed(gusset))
        cx0 = side * legs_lv[0][3]
        # angulo de cada ponto do anel do gancho em torno do centro da perna
        angs = []
        prev = None
        for v in top:
            a = math.atan2(v.co.z - CZ, (v.co.x - cx0) * side)
            if prev is not None:
                while a < prev - 1e-4:
                    a += 2 * math.pi
            angs.append(a)
            prev = a
        rings = [top]
        ys = [Y_CROTCH]
        for (y, rx, rz, cx) in legs_lv:
            ring = []
            is_hem = (y == legs_lv[-1][0])
            for j, a in enumerate(angs):
                x = side * (cx + rx * math.cos(a))
                z = CZ + rz * math.sin(a)
                yy = y
                # dobras verticais suaves de caimento
                fold = 0.006 * math.sin(a * 6.0 + (2.7 - y) * 3.0) * min(1.0, (2.7 - y) / 0.4)
                x += side * fold * math.cos(a)
                z += fold * math.sin(a)
                if is_hem:
                    # fenda lateral: barra sobe em "V" no lado externo (a ~ pi)
                    da = abs(((a - math.pi) + math.pi) % (2 * math.pi) - math.pi)
                    yy += 0.075 * max(0.0, 1.0 - da / 0.22)
                ring.append(bm.verts.new((x, yy, z)))
            rings.append(ring)
            ys.append(y)
        for li in range(len(rings) - 1):
            A, B = rings[li], rings[li + 1]
            va, vb = vcoord(ys[li]), vcoord(ys[li + 1])
            for j in range(n_ring):
                j2 = (j + 1) % n_ring
                ua = u_of(j, n_ring, side)
                ub = u_of(j + 1, n_ring, side) if j2 != 0 else 0.48 + (0.0 if side < 0 else 0.5)
                quad(A[j], A[j2], B[j2], B[j], (ua, va), (ub, va), (ub, vb), (ua, vb), flip)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Calcao")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("Calcao", me)
    bpy.context.collection.objects.link(ob)
    return ob

# ---------------------------------------------------------------------------
# Gola_Polo v2 — proporções reais (1 unid. ~ 35 cm):
#  pé de gola ~3 cm, aba ~7 cm que DRAPEIA sobre ombros/costas/peito (projetada na
#  superfície da camisa via BVH), pontas da gola abertas na frente, peitilho de duas
#  tiras sobrepostas (~13 cm) seguindo a curvatura do peito e 2 botões.
# UVs: gola/peitilho na faixa Cor 3 (u .35-.65, v .728-.740); botões no canto (0.01, 0.99)
# que o app pinta de cinza-grafite.
# ---------------------------------------------------------------------------
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def build_gola_polo_v2(body_obj):
    bmb = bmesh.new()
    bmb.from_mesh(body_obj.data)
    bmesh.ops.remove_doubles(bmb, verts=bmb.verts, dist=0.0008)
    bvh = BVHTree.FromBMesh(bmb)
    ZC = 0.073
    PX = 0.04  # meia-largura do peitilho (~2,8 cm total)

    # --- costura do decote (borda real da malha da camisa)
    neck = [v.co.copy() for e in bmb.edges if e.is_boundary for v in e.verts
            if v.co.y > 4.9 and abs(v.co.x) < 0.45]
    uniq = {}
    for p in neck:
        uniq[(round(p.x, 4), round(p.y, 4), round(p.z, 4))] = p
    neck = list(uniq.values())
    ang = lambda p: math.degrees(math.atan2(p.z - ZC, p.x))
    a_start = math.degrees(math.atan2(0.273 - ZC, PX))      # ~77°  (frente, lado +x)
    a_end = math.degrees(math.atan2(0.275 - ZC, -PX))       # ~102° (frente, lado -x)
    def unwrap(a):  # percorre de a_start descendo até a_end-360
        return a if a <= a_start else a - 360.0
    seam = sorted([p for p in neck if not (a_start < ang(p) < a_end)], key=lambda p: -unwrap(ang(p)))
    # reamostra por comprimento de arco
    L = [0.0]
    for i in range(1, len(seam)):
        L.append(L[-1] + (seam[i] - seam[i - 1]).length)
    N = 80
    pts = []
    for k in range(N + 1):
        t = L[-1] * k / N
        j = max(1, next((i for i in range(1, len(L)) if L[i] >= t), len(L) - 1))
        f = (t - L[j - 1]) / max(1e-9, L[j] - L[j - 1])
        pts.append(seam[j - 1].lerp(seam[j], f))

    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")

    def surf(p, off):
        hit, nrm, _, _ = bvh.find_nearest(p)
        if hit is None:
            return p
        if nrm.dot(p - hit) < 0:
            nrm = -nrm
        return hit + nrm.normalized() * off

    # --- perfil da gola: (saida_radial, altura)
    # Proporções de polo comercial padrão: pé ~2,3 cm (0.065), aba ~4,5 cm (0.13)
    prof = [(0.000, 0.000), (-0.004, 0.032), (-0.006, 0.058), (0.003, 0.072),
            (0.020, 0.069), (0.045, 0.050), (0.075, 0.022), (0.104, -0.008), (0.130, -0.040)]
    drape = {5: (0.30, 0.024), 6: (0.60, 0.018), 7: (0.85, 0.013), 8: (1.0, 0.010)}
    rows = []
    for r, (o, dy) in enumerate(prof):
        row = []
        for k, p in enumerate(pts):
            s = k / N
            endd = min(s, 1.0 - s)
            tip = (1.0 - min(1.0, endd / 0.11)) ** 1.3
            frac = max(0.0, (r - 4) / 4.0)
            rad = Vector((p.x, 0.0, p.z - ZC))
            rad = rad.normalized() if rad.length > 1e-5 else Vector((0, 0, 1))
            stand = 1.0 - 0.35 * tip  # pé um pouco mais baixo na frente
            oo = o + 0.035 * tip * frac
            q = Vector((p.x + rad.x * oo, p.y + dy * (stand if r <= 3 else 1.0) - 0.045 * tip * frac, p.z + rad.z * oo))
            q.x += math.copysign(0.028 * tip * frac, p.x if abs(p.x) > 1e-4 else 1.0)  # pontas abrem
            if r in drape:
                w, off = drape[r]
                q = q.lerp(surf(q, off), w)
            row.append(bm.verts.new(q))
        rows.append(row)
    for r in range(len(rows) - 1):
        for k in range(N):
            f = bm.faces.new((rows[r][k], rows[r][k + 1], rows[r + 1][k + 1], rows[r + 1][k]))
            for lp, (uu, vv) in zip(f.loops, [(k, r), (k + 1, r), (k + 1, r + 1), (k, r + 1)]):
                lp[uvl].uv = (0.35 + 0.30 * uu / N, 0.728 + 0.012 * vv / (len(rows) - 1))

    # --- peitilho: duas tiras sobrepostas seguindo o peito
    def strip(x0, x1, y_top, y_bot, off, nx=3, ny=12):
        grid = []
        for j in range(ny + 1):
            y = y_top + (y_bot - y_top) * j / ny
            line = []
            for i in range(nx + 1):
                x = x0 + (x1 - x0) * i / nx
                hit = bvh.ray_cast(Vector((x, y, 2.0)), Vector((0, 0, -1)))
                # acima do decote o raio passa pelo buraco do pescoço e acerta as costas:
                # nesse trecho o peitilho sobe reto no plano da frente do decote (z ~0.274)
                if hit[0] is None or hit[0].z < 0.2:
                    base, nrm = Vector((x, y, 0.274 + (5.072 - y) * 0.45)), Vector((0, 0.2, 1))
                else:
                    base, nrm = hit[0], hit[1]
                if nrm.z < 0:
                    nrm = -nrm
                line.append(bm.verts.new(base + nrm.normalized() * off))
            grid.append(line)
        for j in range(ny):
            for i in range(nx):
                f = bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
                for lp in f.loops:
                    lp[uvl].uv = (0.50, 0.734)
        return grid
    Y_TOP, Y_BOT = 5.11, 4.78  # ~11 cm; topo entra por baixo das pontas da gola
    strip(-PX, PX * 0.15, Y_TOP, Y_BOT, 0.004)          # tira de baixo
    strip(-PX * 0.55, PX, Y_TOP, Y_BOT - 0.006, 0.009)  # tira de cima (botões)

    # --- botões
    for by in (5.0, 4.88):
        hit = bvh.ray_cast(Vector((0.012, by, 2.0)), Vector((0, 0, -1)))
        c = hit[0] + hit[1].normalized() * 0.013
        nrm = hit[1].normalized()
        t1 = nrm.cross(Vector((1, 0, 0))).normalized()
        t2 = nrm.cross(t1).normalized()
        R, H, S = 0.014, 0.006, 16
        ring_a = [bm.verts.new(c + (t1 * math.cos(2 * math.pi * i / S) + t2 * math.sin(2 * math.pi * i / S)) * R) for i in range(S)]
        ring_b = [bm.verts.new(v.co + nrm * H) for v in ring_a]
        faces = [bm.faces.new(ring_b)]
        for i in range(S):
            faces.append(bm.faces.new((ring_a[i], ring_a[(i + 1) % S], ring_b[(i + 1) % S], ring_b[i])))
        for f in faces:
            for lp in f.loops:
                lp[uvl].uv = (0.008, 0.992)

    bmb.free()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Gola_Polo")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("Gola_Polo", me)
    bpy.context.collection.objects.link(ob)
    return ob

old_polo = objs.pop("Gola_Polo", None)
if old_polo is not None:
    bpy.data.objects.remove(old_polo, do_unlink=True)
objs["Gola_Polo"] = build_gola_polo_v2(objs["Camisa_Corpo"])

old = objs.pop("Calcao", None)
if old is not None:
    bpy.data.objects.remove(old, do_unlink=True)
objs["Calcao"] = build_calcao_v2()

# ---------------------------------------------------------------------------
# Modelos poliesportivos (derivados da mesma malha/UV da camisa -> estampas e
# personalização funcionam igual):
#   Basquete: Regata_Corpo (cavas fundas, sem manga) + Regata_Vies (viés nas cavas e decote)
#   Vôlei:    Volei_Corpo (manga curta "raglan curta", acima do bíceps) + Volei_Vies (punho)
# Viés = faixa extrudada a partir da borda relaxada (borda lisa, sem serrilhado).
# ---------------------------------------------------------------------------
from mathutils.kdtree import KDTree

def _clone_raw(src_obj, name):
    me = src_obj.data.copy()
    me.name = name
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob

def _delete_faces(bm, pred):
    dead = [f for f in bm.faces if pred(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')

def _relax_boundary(bm, sel, iters=12):
    for _ in range(iters):
        bverts = [v for v in bm.verts if v.is_boundary and sel(v.co)]
        newpos = {}
        for v in bverts:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                newpos[v] = v.co * 0.4 + (nb[0].co + nb[1].co) * 0.3
        for v, p in newpos.items():
            v.co = p

def _add_binding(bm, sel, width, uvl, tag_layer):
    """Extruda a borda selecionada 'width' para dentro do buraco e marca as faces novas."""
    bm.normal_update()
    edges = [e for e in bm.edges if e.is_boundary and sel(e.verts[0].co) and sel(e.verts[1].co)]
    dirs = {}
    for e in edges:
        f = e.link_faces[0]
        c = f.calc_center_median()
        for v in e.verts:
            t = (e.other_vert(v).co - v.co).normalized()
            d = v.normal.cross(t).normalized()
            mid = (e.verts[0].co + e.verts[1].co) * 0.5
            if d.dot(c - mid) > 0:
                d = -d
            dirs.setdefault(v, Vector()).__iadd__(d)
    res = bmesh.ops.extrude_edge_only(bm, edges=edges)
    new_verts = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
    new_faces = set()
    for nv in new_verts:
        src = [e.other_vert(nv) for e in nv.link_edges if e.other_vert(nv) in dirs]
        if src:
            d = dirs[src[0]].normalized()
            nv.co = src[0].co + d * width
        for f in nv.link_faces:
            new_faces.add(f)
    for f in new_faces:
        f[tag_layer] = 1
        for lp in f.loops:
            lp[uvl].uv = (0.50, 0.734)  # faixa Cor 3 (gola/punho)

def _split_tagged(ob, vies_name):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    tag = bm.faces.layers.int.get("vies")
    keep_body = [f for f in bm.faces if f[tag] == 1]
    bm_v = bm.copy()
    tag_v = bm_v.faces.layers.int.get("vies")
    bmesh.ops.delete(bm_v, geom=[f for f in bm_v.faces if f[tag_v] != 1], context='FACES')
    bmesh.ops.delete(bm, geom=keep_body, context='FACES')
    for b in (bm, bm_v):
        bmesh.ops.delete(b, geom=[v for v in b.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(ob.data); bm.free()
    me = bpy.data.meshes.new(vies_name); bm_v.to_mesh(me); bm_v.free()
    vo = bpy.data.objects.new(vies_name, me)
    bpy.context.collection.objects.link(vo)
    return vo

def build_regata(body_raw):
    ob = _clone_raw(body_raw, "Regata_Corpo")
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
    uvl = bm.loops.layers.uv.active
    tag = bm.faces.layers.int.new("vies")
    # cava funda de regata: remove manga + ombro externo (elipse centrada na axila)
    def cava(c):
        ax = abs(c.x)
        if c.y > 4.15 and ax > 0.60:
            return True
        return ((ax - 0.66) / 0.25) ** 2 + ((c.y - 4.66) / 0.46) ** 2 < 1.0
    _delete_faces(bm, cava)
    # decote de regata um pouco mais aberto (ombro mais estreito)
    _delete_faces(bm, lambda c: c.y > 5.0 and abs(c.x) < 0.33 and
                  ((c.x / 0.33) ** 2 + ((c.y - 5.32) / 0.27) ** 2 < 1.0) and c.z > -0.2)
    is_arm = lambda co: co.y > 3.9 and abs(co.x) > 0.25 and not (abs(co.x) < 0.36 and co.y > 5.05)
    is_neck = lambda co: co.y > 4.95 and abs(co.x) < 0.40
    _relax_boundary(bm, lambda co: co.y > 3.6)
    _add_binding(bm, lambda co: co.y > 3.6, 0.030, uvl, tag)
    bm.to_mesh(ob.data); bm.free()
    vies = _split_tagged(ob, "Regata_Vies")
    return ob, vies

def build_volei(body_raw):
    ob = _clone_raw(body_raw, "Volei_Corpo")
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
    uvl = bm.loops.layers.uv.active
    tag = bm.faces.layers.int.new("vies")
    # manga curta de vôlei (acaba ~6 cm antes da manga de futebol)
    _delete_faces(bm, lambda c: abs(c.x) > 0.70 and c.y > 4.1)
    sleeve = lambda co: abs(co.x) > 0.6 and co.y > 4.1
    _relax_boundary(bm, sleeve)
    _add_binding(bm, sleeve, 0.028, uvl, tag)
    bm.to_mesh(ob.data); bm.free()
    vies = _split_tagged(ob, "Volei_Vies")
    return ob, vies

modal = {}
modal["Regata_Corpo"], modal["Regata_Vies"] = build_regata(objs["Camisa_Corpo"])
modal["Volei_Corpo"], modal["Volei_Vies"] = build_volei(objs["Camisa_Corpo"])

# nome: (subdiv, rugas_forca, rugas_escala, espessura)
CFG = {
    "Camisa_Corpo": (1, 0.004, 0.8, 0.007),
    "Gola_V":       (1, 0.0,   0.0,  0.006),
    "Gola_Redonda": (1, 0.0,   0.0,  0.006),
    "Gola_Polo":    (1, 0.0,   0.0,  0.006),
    "Punhos":       (1, 0.0,   0.0,  0.006),
    "Calcao":       (1, 0.008, 0.45, 0.007),
    "Meiao":        (1, 0.004, 0.08, 0.005),
    "Regata_Corpo": (1, 0.004, 0.8, 0.007),
    "Regata_Vies":  (1, 0.0,   0.0,  0.006),
    "Volei_Corpo":  (1, 0.004, 0.8, 0.007),
    "Volei_Vies":   (1, 0.0,   0.0,  0.006),
}
objs.update(modal)

wrinkle_tex = bpy.data.textures.new("TecidoRugas", type='CLOUDS')
wrinkle_tex.noise_basis = 'ORIGINAL_PERLIN'
wrinkle_tex.noise_depth = 2

report = []
for name, (lvl, w_str, w_scale, thick) in CFG.items():
    o = objs.get(name)
    if o is None:
        report.append(f"FALTANDO {name}")
        continue
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o

    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
    bm.to_mesh(o.data)
    bm.free()

    sub = o.modifiers.new("Subdiv", 'SUBSURF')
    sub.levels = lvl
    sub.render_levels = lvl
    sub.uv_smooth = 'PRESERVE_BOUNDARIES'
    sub.boundary_smooth = 'PRESERVE_CORNERS'

    if w_str > 0:
        tex = wrinkle_tex.copy()
        tex.noise_scale = w_scale
        d = o.modifiers.new("Rugas", 'DISPLACE')
        d.texture = tex
        d.texture_coords = 'LOCAL'
        d.strength = w_str
        d.mid_level = 0.5

    sol = o.modifiers.new("Espessura", 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = -1.0
    # even_offset/quality_normals geram "espinhos" em vértices quase degenerados da malha original
    sol.use_even_offset = False
    sol.use_quality_normals = False

    for p in o.data.polygons:
        p.use_smooth = True
    for mod in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    report.append(f"{name}: {len(o.data.vertices)} v / {len(o.data.polygons)} f")

def export(names, path):
    bpy.ops.object.select_all(action='DESELECT')
    for n in names:
        objs[n].select_set(True)
    bpy.ops.wm.obj_export(
        filepath=path,
        export_selected_objects=True,
        export_uv=True,
        export_normals=True,
        export_materials=False,
        export_object_groups=False,
        export_triangulated_mesh=True,
        forward_axis='Y',
        up_axis='Z',
    )

# kit base (futebol + peças compartilhadas) e um OBJ leve por modalidade, carregado sob demanda
export([n for n in objs if n not in modal], src)
export(["Regata_Corpo", "Regata_Vies"], os.path.join(models, "modal_basquete.obj"))
export(["Volei_Corpo", "Volei_Vies"], os.path.join(models, "modal_volei.obj"))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(models, "kit_completo.blend"))
for o in objs.values():
    me = o.data
    longest = max((me.vertices[e.vertices[0]].co - me.vertices[e.vertices[1]].co).length for e in me.edges)
    report.append(f"{o.name}: maior aresta {longest:.3f}")
print("\n".join(report))
print("tamanho OBJ:", os.path.getsize(src))

