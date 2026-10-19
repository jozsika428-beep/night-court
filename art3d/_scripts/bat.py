import sys, math, json, os, random
sys.path.insert(0, "/workspace/tools3d/lib")
from units import *
import bmesh
from mathutils import Vector, Quaternion, Matrix, Euler

BATS = [((0, 0, 1.75), 1.0), ((0.62, 0.3, 1.5), 0.85), ((-0.66, 0.22, 1.95), 0.9), ((0.32, -0.55, 2.15), 0.8),
        ((-0.38, -0.5, 1.35), 0.85), ((0.05, 0.7, 2.25), 0.75), ((-0.1, 0.55, 1.2), 0.8)]
FUR = srgb("#2a2024"); FUR2 = srgb("#3a2c30")

def wing_mesh(side, s):
    pts = [(0.04, 0.07), (0.04, -0.05), (0.2, -0.06), (0.38, -0.02), (0.52, 0.06), (0.44, 0.1), (0.36, 0.06), (0.28, 0.14), (0.2, 0.09), (0.12, 0.13)]
    me = bpy.data.meshes.new("wing"); bm = bmesh.new()
    vs = [bm.verts.new((side * x * s, y * s, 0)) for x, y in pts]
    bm.faces.new(vs if side > 0 else list(reversed(vs))); bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new("wing", me); bpy.context.collection.objects.link(o); return o

def build(path):
    reset(); mats = materials("night"); fix_glow(mats["Glow"], (1, 0.08, 0.04, 1), 6)
    arm_d = bpy.data.armatures.new("bat_rig"); arm = bpy.data.objects.new("bat_rig", arm_d); bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode="EDIT")
    root = arm_d.edit_bones.new("Root"); root.head = (0, 0, 0); root.tail = (0, 0, 0.3)
    for i, (p, s) in enumerate(BATS):
        p = Vector(p); b = arm_d.edit_bones.new(f"Bat{i}"); b.head = p; b.tail = p + Vector((0, -0.15 * s, 0)); b.parent = root
        for side, nm in ((1, "L"), (-1, "R")):
            w = arm_d.edit_bones.new(f"Wing{nm}{i}"); w.head = p + Vector((side * 0.04 * s, 0, 0)); w.tail = p + Vector((side * 0.4 * s, 0, 0)); w.parent = b; w.roll = 0
    bpy.ops.object.mode_set(mode="OBJECT")
    parts = []
    def add(o, bone, mat, col):
        o.data.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        for d in o.data.color_attributes["Col"].data: d.color = WHITE if mat == "Team" else col
        o.data.materials.clear()
        for n in MAT_ORDER: o.data.materials.append(mats[n])
        for pl in o.data.polygons: pl.material_index = MAT_ORDER.index(mat)
        vg = o.vertex_groups.new(name=bone); vg.add(list(range(len(o.data.vertices))), 1.0, "REPLACE"); parts.append(o)
    for i, (p, s) in enumerate(BATS):
        x, y, z = p; B = f"Bat{i}"
        add(prim("ico", (0.13 * s, 0.22 * s, 0.13 * s), (x, y + 0.02 * s, z)), B, "Body", FUR)
        add(prim("ico", (0.11 * s, 0.11 * s, 0.1 * s), (x, y - 0.12 * s, z + 0.03 * s)), B, "Body", FUR2)
        for sx in (-1, 1):
            add(prim("cone", (0.05 * s, 0.04 * s, 0.09 * s), (x + sx * 0.035 * s, y - 0.12 * s, z + 0.11 * s), segs=3), B, "Body", FUR2)
        add(prim("cube", (0.08 * s, 0.02 * s, 0.022 * s), (x, y - 0.172 * s, z + 0.045 * s)), B, "Glow", (1, 0.1, 0.05, 1))
        for side, nm in ((1, "L"), (-1, "R")):
            w = wing_mesh(side, s); w.location = (x, y, z); bpy.context.view_layer.objects.active = w
            bpy.ops.object.select_all(action="DESELECT"); w.select_set(True); bpy.ops.object.transform_apply(location=True)
            add(w, f"Wing{nm}{i}", "Team", WHITE)
            add(prim("cube", (0.36 * s, 0.018 * s, 0.018 * s), (x + side * 0.22 * s, y - 0.045 * s, z + 0.004)), f"Wing{nm}{i}", "Body", FUR)  # wing arm bone
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); body = parts[0]; body.name = "bat"
    body.parent = arm; mod = body.modifiers.new("Armature", "ARMATURE"); mod.object = arm
    # ---------------- animation ----------------
    arm.animation_data_create(); pbs = arm.pose.bones
    for pb in pbs: pb.rotation_mode = "QUATERNION"
    R0 = {b.name: b.matrix_local.to_quaternion() for b in arm_d.bones}
    def setq(name, Q):  # Q: rotation in armature rest orientation of the bone
        r = R0[name]; pbs[name].rotation_quaternion = r.inverted() @ Q @ r
    def setloc(name, d):
        pbs[name].location = R0[name].inverted() @ Vector(d)
    rnd = random.Random(4); phase = [rnd.uniform(0, 6.28) for _ in BATS]
    def clip(name, length, fn):
        a = bpy.data.actions.new(f"bat_{name}"); arm.animation_data.action = a
        for f in range(0, length + 1):
            for pb in pbs: pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0)
            fn(f / length)
            for pb in pbs:
                if pb.name == "Root": continue
                pb.keyframe_insert("rotation_quaternion", frame=f + 1)
                if pb.name.startswith("Bat"): pb.keyframe_insert("location", frame=f + 1)
        tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, a); arm.animation_data.action = None
    def flap(i, th):
        setq(f"WingL{i}", Quaternion((0, 1, 0), -th)); setq(f"WingR{i}", Quaternion((0, 1, 0), th))
    def idle(t):
        for i, (p, s) in enumerate(BATS):
            ph = phase[i]; flap(i, math.radians(10 + 45 * math.sin(2 * math.pi * 3 * t + ph)))
            setloc(f"Bat{i}", (0.07 * math.cos(2 * math.pi * t + ph), 0.07 * math.sin(2 * math.pi * t + ph), 0.09 * math.sin(2 * math.pi * 2 * t + ph)))
            setq(f"Bat{i}", Quaternion((0, 1, 0), math.radians(12) * math.sin(2 * math.pi * t + ph)))
    def fly(t):
        for i, (p, s) in enumerate(BATS):
            ph = phase[i]; flap(i, math.radians(5 + 55 * math.sin(2 * math.pi * 3 * t + ph)))
            setloc(f"Bat{i}", (0.05 * math.sin(2 * math.pi * t + ph), 0, 0.1 * math.sin(2 * math.pi * 3 * t + ph + 1.0)))
            setq(f"Bat{i}", Quaternion((1, 0, 0), math.radians(16)) @ Quaternion((0, 1, 0), math.radians(10) * math.sin(2 * math.pi * t + ph)))
    def attack(t):
        for i, (p, s) in enumerate(BATS):
            ph = phase[i]; d = max(0.0, math.sin(math.pi * min(1, max(0, (t - 0.05 * (i % 3)) / 0.8))))
            flap(i, math.radians(10 + 50 * math.sin(2 * math.pi * 4 * t + ph)) * (1 - 0.5 * d) - math.radians(30) * d)
            setloc(f"Bat{i}", (0, -1.0 * d, -0.7 * d * (p[2] / 2.0)))
            setq(f"Bat{i}", Quaternion((1, 0, 0), math.radians(35) * d))
    def death(t):
        for i, (p, s) in enumerate(BATS):
            e = min(1, max(0, (t - 0.04 * i) / 0.7)); e2 = e * e
            flap(i, math.radians(20 * (1 - e) - 75 * e) if e > 0 else math.radians(20))
            setloc(f"Bat{i}", (0.15 * e * math.cos(phase[i]), 0.15 * e * math.sin(phase[i]), -(p[2] - 0.08) * e2))
            setq(f"Bat{i}", Quaternion((0, 1, 0), math.radians(100 if i % 2 else -100) * e) @ Quaternion((1, 0, 0), math.radians(30) * e))
    clip("Idle", 24, idle); clip("Walk", 24, fly); clip("Attack", 24, attack); clip("Death", 30, death)
    for pb in pbs: pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0)
    t = tris([body]); size = export_glb(path, [arm, body])
    print("BUILT", json.dumps(dict(file=os.path.relpath(path, OUT), tris=t, bones=len(arm_d.bones), bytes=size)))

if __name__ == "__main__": build(f"{OUT}/units/bat.glb")
