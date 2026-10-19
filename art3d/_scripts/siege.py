import sys, math, colorsys, json, os
sys.path.insert(0, "/workspace/tools3d/lib")
from build import *
KC = KIT["castle"]

def bone_tone(_, c):
    r, g, b = (lin2s(max(0, min(1, v))) for v in c[:3]); h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if 0.03 <= h < 0.17 and s > 0.2: h, s, v = 0.11, 0.2, 0.5 + 0.38 * v       # wood -> bone
    else: h, s, v = 0.0, 0.25, 0.08 + 0.2 * v                                   # metal/stone -> dark blood-iron
    r, g, b = colorsys.hsv_to_rgb(h, s, v); return (s2lin(r), s2lin(g), s2lin(b), 1)

def setmats(o, mats, idx=0):
    o.data.materials.clear()
    for n in MAT_ORDER: o.data.materials.append(mats[n])
    for p in o.data.polygons: p.material_index = idx

def addprim(target, mats, kind, size, loc, rot=(0, 0, 0), mat="Body", color=(0.5, 0.5, 0.5, 1), segs=6):
    o = prim(kind, size, loc, rot, segs)
    o.data.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    for d in o.data.color_attributes["Col"].data: d.color = WHITE if mat == "Team" else color
    setmats(o, mats, MAT_ORDER.index(mat))
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); target.select_set(True)
    bpy.context.view_layer.objects.active = target; bpy.ops.object.join()
    return target

def key_all(objs, f):
    for o in objs:
        for path in ("location", "rotation_euler", "scale"): o.keyframe_insert(path, frame=f)

def make_clip(name, objs, length, fn, loop=False):
    """fn(f, t) poses objects for frame f (t=0..1). keys every 2 frames."""
    acts = {}
    for o in objs:
        o.animation_data_create(); a = bpy.data.actions.new(f"{name}_{o.name}"); o.animation_data.action = a; acts[o] = a
    for f in range(0, length + 1, 2):
        for o in objs: o.location, o.rotation_euler, o.scale = o["rest_loc"], o["rest_rot"], (1, 1, 1)
        fn(f, f / length); key_all(objs, f + 1)
    for o in objs:
        for fc in acts[o].fcurves:
            for k in fc.keyframe_points: k.interpolation = "LINEAR"
        tr = o.animation_data.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 1, acts[o]); o.animation_data.action = None

def build(kind, path):
    reset(); faction = "night" if kind == "catapult" else "dawn"
    mats = materials(faction); fix_glow(mats["Glow"], (1, 0.12, 0.04, 1) if faction == "night" else (1, 0.5, 0.1, 1), 6)
    objs = import_glb(f"{KC}/siege-{kind}.glb"); ms = [o for o in objs if o.type == "MESH"]
    for o in objs:
        if o.type != "MESH": bpy.data.objects.remove(o, do_unlink=True)
    for o in ms:
        wm = o.matrix_world.copy(); o.parent = None; o.matrix_world = wm
        bake_to_vcol(o, bone_tone if faction == "night" else tone("dawn")); setmats(o, mats, 0)
    body = next(o for o in ms if o.name.startswith("siege")); wheels = [o for o in ms if o.name.startswith("wheel")]
    arm = next((o for o in ms if o.name in ("catapult", "arrow")), None)
    if kind == "catapult":
        bone = srgb("#d8ccb0")
        addprim(arm, mats, "ico", (0.2, 0.2, 0.2), (-0.93, 0, 0.3), mat="Glow", color=(1, 0.15, 0.05, 1))       # burning skull ammo
        for sx in (-1, 1):
            addprim(body, mats, "ico", (0.16, 0.18, 0.16), (0.72, sx * 0.3, 0.42), color=bone)                     # skulls on the front
            for k in range(3): addprim(body, mats, "cone", (0.06, 0.06, 0.3), (-0.4 + k * 0.4, sx * 0.47, 0.45), rot=(sx * -0.5, 0, 0), color=bone, segs=4)
        addprim(body, mats, "cyl", (0.04, 0.04, 1.1), (-0.65, 0.0, 0.75), color=srgb("#2a1a14"), segs=5)            # banner pole
        addprim(body, mats, "cube", (0.02, 0.45, 0.4), (-0.65, 0.0, 1.05), mat="Team")
        for sx in (-1, 1): addprim(body, mats, "cube", (1.2, 0.03, 0.2), (0, sx * 0.48, 0.3), mat="Team")           # side drapes
    else:
        addprim(arrow := arm, mats, "cone", (0.12, 0.12, 0.26), (1.05, 0, 0.495), rot=(0, math.pi / 2, 0), mat="Glow", color=(1, 0.5, 0.1, 1))
        for sx in (-1, 1): addprim(body, mats, "cube", (0.7, 0.03, 0.28), (-0.15, sx * 0.4, 0.45), mat="Team")
        addprim(body, mats, "cube", (0.05, 0.7, 0.3), (0.42, 0, 0.32), mat="Metal", color=srgb("#b8bec8"))   # front shield plate
        addprim(body, mats, "cyl", (0.04, 0.04, 1.0), (-0.58, 0.0, 0.62), color=srgb("#5a3a20"), segs=5)
        addprim(body, mats, "cube", (0.02, 0.42, 0.34), (-0.58, 0.22, 0.95), mat="Team")
        for sx in (-1, 1): addprim(body, mats, "cyl", (0.16, 0.16, 0.18), (-0.5, sx * 0.25, 0.2), color=srgb("#3a2a1a"), segs=6)  # oil pots
    allo = [body] + wheels + ([arm] if arm else [])
    # orient: Kenney front is +X -> Blender -Y (glTF +Z); scale to ~3 m long
    R = Matrix.Rotation(math.radians(-90), 4, "Z")
    for o in allo: o.matrix_world = R @ o.matrix_world
    bpy.context.view_layer.update(); mn, mx = bbox(allo); L = mx.y - mn.y; s = 3.0 / L
    for o in allo: o.matrix_world = Matrix.Diagonal((s, s, s, 1)) @ o.matrix_world
    bpy.context.view_layer.update(); mn, mx = bbox(allo); c = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    for o in allo: o.matrix_world = Matrix.Translation(-c) @ o.matrix_world
    for o in allo:
        bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=(o == body), rotation=True, scale=True)
    for o in allo[1:]:
        o.parent = body; o.matrix_parent_inverse = body.matrix_world.inverted()
    for o in allo: o.rotation_mode = "XYZ"
    for o in allo: o["rest_loc"] = tuple(o.location); o["rest_rot"] = tuple(o.rotation_euler)
    arm.name = "_tmp"; body.name = kind; arm.name = "arm" if kind == "catapult" else "bolt"
    for i, w in enumerate(wheels): w.name = f"wheel{i}"
    # ---- clips (24 fps) ----
    def idle(f, t):
        if kind == "catapult": arm.rotation_euler.x = math.radians(2.5) * math.sin(t * 2 * math.pi)
        body.location.z = 0.008 * math.sin(t * 2 * math.pi)
    def walk(f, t):
        for w in wheels: w.rotation_euler.x = t * 2 * math.pi
        body.rotation_euler.x = math.radians(1.2) * math.sin(t * 4 * math.pi); body.location.z = 0.02 * abs(math.sin(t * 4 * math.pi))
        if kind == "catapult": arm.rotation_euler.x = math.radians(4) * math.sin(t * 4 * math.pi)
    def attack(f, t):
        if kind == "catapult":
            a = (t / 0.25) if t < 0.25 else (1 - (t - 0.25) / 0.75)
            arm.rotation_euler.x = math.radians(105) * (a ** 0.6 if t < 0.25 else a)
            body.rotation_euler.x = math.radians(-3) * math.sin(min(1, t / 0.35) * math.pi)
        else:
            if t < 0.3: arm.location.y = arm["rest_loc"][1] - 6 * (t / 0.3) ** 2; arm.scale = (1, 1, 1) if t < 0.28 else (0.01, 0.01, 0.01)
            elif t < 0.7: arm.scale = (0.01, 0.01, 0.01)
            else: arm.scale = ((t - 0.7) / 0.3,) * 3
            body.location.y = 0.12 * math.sin(min(1, max(0, (t - 0.05) / 0.3)) * math.pi)
    def death(f, t):
        e = min(1, t / 0.7); e = 1 - (1 - e) ** 2
        body.rotation_euler.y = math.radians(18) * e; body.rotation_euler.x = math.radians(-8) * e; body.location.z = -0.25 * e
        for i, w in enumerate(wheels):
            if i % 2 == 0:
                w.rotation_euler.y = math.radians(80) * e * (1 if w.location.x > 0 else -1)
                w.location.x = w["rest_loc"][0] + 0.4 * e * (1 if w.location.x > 0 else -1); w.location.z = w["rest_loc"][2] - 0.15 * e
        if arm: arm.rotation_euler.x = math.radians(-12) * e if kind == "catapult" else 0; arm.rotation_euler.z = math.radians(25) * e if kind != "catapult" else 0
    for nm, ln, fn in (("Idle", 48, idle), ("Walk", 24, walk), ("Attack", 36, attack), ("Death", 36, death)):
        make_clip(nm, allo, ln, fn)
    for o in allo: o.location, o.rotation_euler, o.scale = o["rest_loc"], o["rest_rot"], (1, 1, 1)
    bpy.context.scene.frame_set(0)
    size = export_glb(path, allo)
    print("BUILT", json.dumps(dict(file=os.path.relpath(path, OUT), tris=tris(allo), bytes=size)))

if __name__ == "__main__":
    for k in sys.argv[sys.argv.index("--") + 1:]: build(k, f"{OUT}/units/{k}.glb")
