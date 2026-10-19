import bpy, sys, math, os
sys.path.insert(0, "/workspace/tools3d/lib")
from lib3d import *
from mathutils import Vector

def setup_scene(res=384, samples=24, ground_tex=None):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try: sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception: pass
    sc.render.resolution_x = res; sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    w = bpy.data.worlds.new("night"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.012, 0.018, 0.04, 1); bg.inputs[1].default_value = 1.0
    # moon (cold blue key from back-left), red fill from front-right, soft front fill
    def light(kind, loc, energy, color, rot=None, size=None):
        L = bpy.data.lights.new(kind, kind); L.energy = energy; L.color = color
        if size and kind == "AREA": L.size = size
        o = bpy.data.objects.new(kind, L); sc.collection.objects.link(o); o.location = loc
        if rot: o.rotation_euler = rot
        return o
    light("SUN", (0, 0, 10), 3.2, (0.6, 0.72, 1.0), rot=(math.radians(55), 0, math.radians(-150)))
    rim = light("AREA", (3, 5, 3), 600, (1.0, 0.18, 0.12), size=5); rim.rotation_euler = (c - rim.location).to_track_quat("-Z", "Y").to_euler() if False else (math.radians(-60), 0, math.radians(150))
    light("AREA", (-3, -6, 4), 420, (0.75, 0.82, 1.0), size=8).rotation_euler = (math.radians(55), 0, math.radians(-28))
    # ground disc
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=60, fill_type="NGON"); g = bpy.context.active_object; g.name = "ground"
    gm = bpy.data.materials.new("ground"); gm.use_nodes = True
    b = gm.node_tree.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.95
    if ground_tex and os.path.exists(ground_tex):
        t = gm.node_tree.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(ground_tex)
        tc = gm.node_tree.nodes.new("ShaderNodeTexCoord"); mp = gm.node_tree.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.25, 0.25, 0.25)
        gm.node_tree.links.new(tc.outputs["Object"], mp.inputs[0]); gm.node_tree.links.new(mp.outputs[0], t.inputs[0])
        gm.node_tree.links.new(t.outputs[0], b.inputs["Base Color"])
    else:
        b.inputs["Base Color"].default_value = (0.03, 0.035, 0.03, 1)
    g.data.materials.append(gm)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    return cam

def frame_camera(cam, objs, yaw=-35, pitch=28, margin=0.62):
    mn, mx = bbox(objs)
    c = (mn + mx) / 2; r = max((mx - mn).length / 2, 0.5) * margin
    cam.data.lens = 50
    fov = 2 * math.atan(18 / 50)
    d = r / math.sin(fov / 2)
    yr, pr = math.radians(yaw), math.radians(pitch)
    # camera in front (-Y) of model
    off = Vector((math.sin(yr) * math.cos(pr), -math.cos(yr) * math.cos(pr), math.sin(pr))) * d
    cam.location = c + off
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 1000

def render_glb(glb, out, clip=None, frame_frac=0.35, res=384, samples=24, yaw=-35, pitch=28, ground_tex=None, margin=None):
    reset()
    cam = setup_scene(res, samples, ground_tex)
    objs = import_glb(glb)
    arm = next((o for o in objs if o.type == "ARMATURE"), None)
    if arm and clip:
        ad = arm.animation_data
        act = bpy.data.actions.get(clip) or next((a for a in bpy.data.actions if a.name.startswith(clip)), None)
        if act:
            if ad is None: ad = arm.animation_data_create()
            for t in ad.nla_tracks: t.mute = True
            ad.action = act
            f0, f1 = act.frame_range
            bpy.context.scene.frame_set(int(f0 + (f1 - f0) * frame_frac))
    bpy.context.view_layer.update()
    frame_camera(cam, [o for o in objs if o.type == "MESH"], yaw, pitch, margin or (0.62 if arm else 0.78))
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)

if __name__ == "__main__":
    a = sys.argv[sys.argv.index("--") + 1:]
    render_glb(a[0], a[1], clip=(a[2] if len(a) > 2 else None))
