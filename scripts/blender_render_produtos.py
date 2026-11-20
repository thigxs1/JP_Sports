# Executado DENTRO do Blender (node scripts/blender_exec.js scripts/blender_render_produtos.py)
# Gera fotos de produto 4:5 (fundo transparente) das peças JP Sport para o site.
# Direção de arte (brandbook 08): luz lateral dura, contraste alto, peça navy,
# azul elétrico só nos detalhes (viés/gola).
import bpy, math, os
from mathutils import Vector, Matrix

root = r"D:\02_Projetos\03_Hacking\teste_REA\perfil_sports"
bpy.ops.wm.open_mainfile(filepath=os.path.join(root, "app", "models", "kit_completo.blend"))
out_dir = os.path.join(root, "app", "assets", "produtos")
os.makedirs(out_dir, exist_ok=True)
sc = bpy.context.scene

def mat(name, rgb_lin, rough, sheen=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb_lin, 1)
    b.inputs["Roughness"].default_value = rough
    if "Sheen Weight" in b.inputs:
        b.inputs["Sheen Weight"].default_value = sheen
    return m

NAVY = mat("JP_Navy", (0.0048, 0.0137, 0.0467), 0.55, 0.6)
ELET = mat("JP_Eletrico", (0.0284, 0.1046, 1.0), 0.45, 0.3)
OFF = mat("JP_Off", (0.88, 0.88, 0.88), 0.6, 0.4)

for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.materials.clear()
        if o.name in ("Camisa_Corpo", "Regata_Corpo", "Volei_Corpo", "Calcao", "Meiao"):
            o.data.materials.append(NAVY)
        else:
            o.data.materials.append(ELET)

# luz: key lateral dura + rim frio + fill fraco
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o, do_unlink=True)
def light(name, kind, energy, loc, size=1.0, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy; ld.color = color
    if kind == 'AREA':
        ld.size = size
    ob = bpy.data.objects.new(name, ld)
    sc.collection.objects.link(ob)
    ob.location = Vector(loc)
    fwd = (Vector((0, 4.2, 0)) - ob.location).normalized()
    right = fwd.cross(Vector((0, 1, 0))).normalized(); up = right.cross(fwd).normalized()
    ob.rotation_euler = Matrix((right, up, -fwd)).transposed().to_euler()
light("Key", 'AREA', 900, (-4.0, 6.0, 3.0), 1.2)
light("Rim", 'AREA', 700, (4.5, 5.5, -3.5), 2.0, (0.75, 0.85, 1.0))
light("Fill", 'AREA', 120, (3.0, 3.5, 4.5), 4.0)

if sc.world is None:
    sc.world = bpy.data.worlds.new("World")
sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.15

cam = bpy.data.objects.new("CamProduto", bpy.data.cameras.new("CamProduto"))
sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50

sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.film_transparent = True
sc.render.resolution_x = 880
sc.render.resolution_y = 1100
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
try:
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
except Exception:
    pass

SHOTS = {
    "futebol":  (["Camisa_Corpo", "Gola_V", "Punhos"], (4.2, 0.02), (0.9, 4.55, 4.9)),
    "basquete": (["Regata_Corpo", "Regata_Vies", "Calcao"], (3.6, 0.02), (0.9, 4.1, 6.3)),
    "volei":    (["Volei_Corpo", "Volei_Vies", "Gola_V"], (4.2, 0.02), (0.9, 4.55, 4.9)),
    "kit":      (["Camisa_Corpo", "Gola_V", "Punhos", "Calcao", "Meiao"], (3.1, 0.02), (1.1, 3.6, 9.6)),
}
for key, (parts, (ty, tz), pos) in SHOTS.items():
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.hide_render = o.name not in parts
    cam.location = Vector(pos)
    target = Vector((0, ty, tz))
    fwd = (target - cam.location).normalized()
    right = fwd.cross(Vector((0, 1, 0))).normalized(); up = right.cross(fwd).normalized()
    cam.rotation_euler = Matrix((right, up, -fwd)).transposed().to_euler()
    sc.render.filepath = os.path.join(out_dir, f"{key}.png")
    bpy.ops.render.render(write_still=True)
print("renders:", sorted(os.listdir(out_dir)))
