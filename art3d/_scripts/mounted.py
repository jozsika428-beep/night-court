import sys; sys.path.insert(0, "/workspace/tools3d/lib")
from humanoids import *

def build_rider(dress, faction, path, tri=900):
    R = Rig(MAN, faction, dress["colors"], team_mats=dress.get("team", ()))
    if dress.get("clothe"): clothe(R, *dress["clothe"])
    for fn in dress["parts"]: fn(R)
    # pose: sitting frame, legs spread
    arm = R.arm
    act = next(a for a in bpy.data.actions if "Man_Sitting" in a.name)
    arm.animation_data.action = act
    bpy.context.scene.frame_set(int(act.frame_range[0] + 60)); bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode="POSE")
    for side, sx in (("L", 1), ("R", -1)):
        pb = arm.pose.bones["UpperLeg." + side]
        h = pb.head.copy()
        rot = Matrix.Translation(h) @ Matrix.Rotation(math.radians(sx * 32), 4, "Y") @ Matrix.Translation(-h)
        pb.matrix = rot @ pb.matrix
        bpy.context.view_layer.update()
        pk = arm.pose.bones["LowerLeg." + side]; hk = pk.head.copy()
        # bend knee down (shin points down instead of forward)
        rk = Matrix.Translation(hk) @ Matrix.Rotation(math.radians(70), 4, "X") @ Matrix.Translation(-hk)
        pk.matrix = rk @ pk.matrix
        bpy.context.view_layer.update()
    # arm forward a bit (holding reins / weapon)
    bpy.ops.object.mode_set(mode="OBJECT")
    hips = arm.matrix_world @ arm.pose.bones["Hips"].head
    body = R.body
    # apply armature deformation
    for m in body.modifiers:
        if m.type == "ARMATURE":
            bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier=m.name)
    body.parent = None
    bpy.data.objects.remove(arm, do_unlink=True)
    body.vertex_groups.clear()
    decimate(body, tri)
    body.location -= hips; bpy.context.view_layer.objects.active = body
    bpy.ops.object.select_all(action="DESELECT"); body.select_set(True)
    bpy.ops.object.transform_apply(location=True)
    body.name = "rider"
    bpy.data.libraries.write(path, {body}, fake_user=True)

def mounted(key, faction, horse_src, horse_cols, rider_dress, extras, height=2.6, path=None, tri=3000):
    rp = f"/tmp/rider_{key}.blend"
    build_rider(rider_dress, faction, rp)
    R = Rig(horse_src, faction, horse_cols, base_height=1.75, ground_clip="Idle_AnimalArmature")
    with bpy.data.libraries.load(rp) as (src, dst): dst.objects = ["rider"]
    rider = dst.objects[0]; bpy.context.scene.collection.objects.link(rider)
    saddle = Vector((0, 0.08, 1.12))
    rider.location = saddle; bpy.context.view_layer.objects.active = rider
    bpy.ops.object.select_all(action="DESELECT"); rider.select_set(True); bpy.ops.object.transform_apply(location=True)
    R.part(rider, "Torso", keep=True, weights={"Torso": 1.0})
    for fn in extras: fn(R)
    clips = {"Idle": "Idle_AnimalArmature", "Walk": "Walk_AnimalArmature", "Run": "Gallop_AnimalArmature", "Attack": "Attack_Kick", "Death": "Death_AnimalArmature"}
    return R.finish(key, 1.0, clips, tri, path=path or f"{OUT}/units/{key}.glb")

def wings(R):
    for sx in (-1, 1):
        bm = bpy.data.meshes.new("wing"); o = bpy.data.objects.new("wing", bm); bpy.context.scene.collection.objects.link(o)
        pts = [(sx * 0.18, -0.25, 1.15), (sx * 0.18, 0.25, 1.15), (sx * 0.9, 0.45, 1.75), (sx * 1.5, 0.15, 2.05), (sx * 1.25, -0.2, 1.75), (sx * 1.6, -0.5, 1.7), (sx * 0.9, -0.55, 1.6)]
        bm.from_pydata(pts, [], [list(range(len(pts)))])
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.quads_convert_to_tris(); bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.02)})
        bpy.ops.object.mode_set(mode="OBJECT")
        R.part(o, "Torso2", "Team")
        # wing bones (ribs)
        for (a, b) in ((pts[0], pts[3]), (pts[0], pts[5]), (pts[0], pts[2])):
            a, b = Vector(a), Vector(b); mid = (a + b) / 2; d = b - a
            c = prim("cyl", (0.035, 0.035, d.length), loc=mid, segs=4)
            c.rotation_mode = "QUATERNION"; c.rotation_quaternion = d.to_track_quat("Z", "Y")
            bpy.ops.object.transform_apply(rotation=True)
            R.part(c, "Torso2", "Body", C("#1a1214"))

def caparison(R, col_mat="Team"):
    o = prim("cyl", (0.52, 1.25, 0.42), loc=(0, 0.0, 0.92), segs=8)
    R.part_w(o, lambda co: {"Torso": 0.5, "Torso2": 0.5} if co.y < 0 else {"Torso": 0.5, "Back": 0.5}, col_mat)

def chanfron(R, col="#9aa0aa"):
    hb = R.group_bounds(["Head"]); c = (hb[0] + hb[1]) / 2
    R.part(prim("cube", (0.2, 0.3, 0.12), loc=(c.x, c.y - 0.02, hb[1].z - 0.03), rot=(math.radians(-35), 0, 0)), "Head", "Metal", C(col))

def red_eyes_horse(R):
    hb = R.group_bounds(["Head"]); c = (hb[0] + hb[1]) / 2
    for sx in (-1, 1):
        R.part(prim("cube", (0.03, 0.05, 0.03), loc=(sx * (hb[1].x - 0.005), c.y + 0.02, c.z + 0.06)), "Head", "Glow", (1, 0.1, 0.05, 1))

def lance(R, col="#c9ced8"):
    R.part(prim("cyl", (0.05, 0.05, 2.6), loc=(-0.42, -0.6, 1.75), rot=(math.radians(70), 0, 0), segs=6), "Torso", "Metal", C(col))

HORSE_BLACK = {"Main": C("#141012"), "Main_Dark": C("#0a0808"), "Main_Light": C("#2a2224"), "Hair": C("#5a0a12"), "Muzzle": C("#1e1618"), "Hooves": C("#0a0808"), "Eye_Black": C("#ff1a10"), "Eye_White": C("#100c0c")}
HORSE_WHITE = {"Main": C("#e8e4dc"), "Main_Dark": C("#c8c2b8"), "Main_Light": C("#f4f0ea"), "Hair": C("#d8ccb0"), "Muzzle": C("#bab2a8"), "Hooves": C("#4a3a2a"), "Eye_Black": C("#101010"), "Eye_White": C("#e0e0e0")}

def blood_knight():
    dress = dict(colors={"Shirt": C("#1c1418"), "Skin": C("#d8d0ce"), "Pants": C("#121014"), "Socks": C("#121014"), "Hair": C("#0a0808"), "Eyes": C("#100c0c")},
                 clothe=("#141014", "#2a2428", "#2a2428"),
                 parts=[lambda R: helmet(R, "#2a2428", "horned"), lambda R: breastplate(R, "#2a2428"), lambda R: pauldrons(R, "#2a2428", 0.15), lambda R: cape(R, length=0.8)])
    def eq(R): fix_glow(R.mats["Glow"], (1, 0.1, 0.05, 1), 6)
    return mounted("bloodknight", "night", f"{CAND}/qvTrSG9pZF.glb", HORSE_BLACK, dress, [eq, wings, red_eyes_horse, lambda R: lance(R, "#3a3438")])

def silver_knight():
    dress = dict(colors={"Shirt": C("#ffffff"), "Skin": C("#c99a74"), "Pants": C("#a8aeb8"), "Socks": C("#a8aeb8"), "Hair": C("#5a3a20"), "Eyes": C("#100c0c")},
                 team=("Shirt",), clothe=("#a8aeb8", "#c0c6d0", "#c0c6d0"),
                 parts=[lambda R: helmet(R, "#d0d6de", "great", plume="#ffffff"), lambda R: pauldrons(R, "#d0d6de", 0.15), lambda R: tabard(R), shield])
    return mounted("knight", "dawn", f"{CAND}/bEdE4rmZy9.glb", HORSE_WHITE, dress, [caparison, lance])

ALL2 = dict(bloodknight=blood_knight, knight=silver_knight)
if __name__ == "__main__":
    for k in sys.argv[sys.argv.index("--") + 1:]:
        ALL2[k]()
