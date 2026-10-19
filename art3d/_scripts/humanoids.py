import sys; sys.path.insert(0, "/workspace/tools3d/lib")
from units import *
MAN = f"{CAND}/HMnuH5geEG.glb"
MANCLIPS = {"Idle": "Man_Idle", "Walk": "Man_Walk", "Run": "Man_Run", "Attack": "Man_SwordSlash", "Death": "Man_Death"}
C = srgb

def hand(R, side="R"):
    p = R.bonepos("Palm." + side); f = R.bonepos("Fingers." + side)
    return (p * 0.4 + f * 0.6) + Vector((0, 0.03, -0.01))

def sword(R, length=0.85, width=0.05, side="R", col="#c9ced8", hilt="#2a1c18", guard="#8a6a30"):
    c = hand(R, side)
    R.part(prim("cube", (0.012, length, width), loc=(c.x, c.y - 0.08 - length / 2, c.z)), "Palm." + side, "Metal", C(col))
    R.part(prim("cube", (0.035, 0.035, 0.2), loc=(c.x, c.y - 0.07, c.z)), "Palm." + side, "Metal", C(guard))
    R.part(prim("cyl", (0.035, 0.035, 0.16), loc=(c.x, c.y + 0.02, c.z), rot=(math.pi / 2, 0, 0), segs=6), "Palm." + side, "Body", C(hilt))

def cape(R, col_mat="Team", length=1.0, width=0.46, top=1.47):
    bm_obj = prim("cube", (width, 0.03, length), loc=(0, 0.19, top - length / 2), rot=(math.radians(-8), 0, 0))
    def w(co):
        t = max(0, min(1, (top - co.z) / length))
        return {"Torso": 1 - 0.5 * t, "Hips": 0.5 * t}
    R.part_w(bm_obj, w, col_mat, C("#202020"))

def collar(R, col="#202020", mat="Team", h=0.24, w=0.34):
    o = prim("cube", (w, 0.035, h), loc=(0, 0.13, 1.55 + h / 2), rot=(math.radians(-18), 0, 0))
    R.part(o, "Torso", mat, C(col))
    for sx in (-1, 1):
        R.part(prim("cube", (0.035, 0.12, h * 0.8), loc=(sx * w / 2, 0.08, 1.53 + h / 2), rot=(0, 0, sx * math.radians(-20))), "Torso", mat, C(col))

def robe(R, top_r=0.2, bot_r=0.36, top_z=1.0, bot_z=0.04, mat="Body", col="#e8e0d0", segs=10):
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=bot_r, radius2=top_r, depth=top_z - bot_z, location=(0, 0.02, (top_z + bot_z) / 2))
    o = bpy.context.active_object
    def w(co):
        t = max(0, min(1, (top_z - co.z) / (top_z - bot_z)))
        leg = "UpperLeg.L" if co.x > 0 else "UpperLeg.R"
        if abs(co.x) < 0.05: return {"Hips": 1.0}
        return {"Hips": 1 - 0.55 * t, leg: 0.55 * t}
    R.part_w(o, w, mat, C(col))

def hood(R, col="#e8e0d0", mat="Body", r=0.15):
    o = prim("sphere", (r * 1.75, r * 1.8, r * 1.75), loc=(0, 0.035, 1.695), segs=8)
    R.part(o, "Head", mat, C(col))
    o = prim("cube", (r * 1.9, r * 0.6, r * 1.6), loc=(0, 0.12, 1.53))
    R.part(o, "Torso", mat, C(col))

def helmet(R, col="#b8bec8", kind="kettle", plume=None):
    o = prim("sphere", (0.25, 0.27, 0.22), loc=(0, 0.02, 1.74), segs=8); R.part(o, "Head", "Metal", C(col))
    if kind == "kettle":
        R.part(prim("cyl", (0.4, 0.4, 0.025), loc=(0, 0.02, 1.70), segs=10), "Head", "Metal", C(col))
    elif kind == "great":
        R.part(prim("cyl", (0.25, 0.27, 0.24), loc=(0, 0.02, 1.66), segs=8), "Head", "Metal", C(col))
        R.part(prim("cube", (0.16, 0.02, 0.02), loc=(0, -0.122, 1.69)), "Head", "Body", C("#101010"))
    elif kind == "horned":
        for sx in (-1, 1):
            R.part(prim("cone", (0.06, 0.06, 0.22), loc=(sx * 0.13, 0.0, 1.86), rot=(0, sx * math.radians(-35), 0), segs=5), "Head", "Body", C("#d8ccb0"))
    if plume:
        R.part(prim("cube", (0.04, 0.22, 0.12), loc=(0, 0.05, 1.88)), "Head", "Team", C(plume))

def pauldrons(R, col="#b8bec8", size=0.16, mat="Metal"):
    for side, sx in (("L", 1), ("R", -1)):
        R.part(prim("sphere", (size * 1.3, size * 1.2, size * 0.8), loc=(sx * 0.2, 0.02, 1.47), segs=8), "UpperArm." + side, mat, C(col))

def breastplate(R, col="#b8bec8"):
    R.part(prim("cube", (0.3, 0.06, 0.32), loc=(0, -0.12, 1.32)), "Torso", "Metal", C(col))

def tabard(R):
    R.part(prim("cube", (0.26, 0.03, 0.62), loc=(0, -0.135, 1.05)), "Torso", "Team", C("#ffffff"),
           weights=None)

def claws(R, col="#e6dcc0", n=3, length=0.12):
    for side, sx in (("L", 1), ("R", -1)):
        f = R.bonepos("Fingers." + side)
        for i in range(n):
            y = -0.0 + (i - 1) * 0.035
            R.part(prim("cone", (0.025, 0.025, length), loc=(f.x + sx * (0.08 + length / 2), f.y + y, f.z - 0.01), rot=(0, sx * math.radians(90), 0), segs=4), "Fingers." + side, "Body", C(col))

def glow_eyes(R, col=(1, 0.05, 0.03, 1), y=-0.108, z=1.685, dx=0.04, s=0.026):
    for sx in (-1, 1):
        R.part(prim("cube", (s, 0.012, s * 0.6), loc=(sx * dx, y, z)), "Head", "Glow", col)

def wolf_head(R, fur="#2a2624", muzzle="#3a3430"):
    R.part(prim("cube", (0.15, 0.24, 0.12), loc=(0, -0.2, 1.64), rot=(math.radians(-8), 0, 0)), "Head", "Body", C(muzzle))  # snout
    R.part(prim("cube", (0.06, 0.05, 0.05), loc=(0, -0.33, 1.67)), "Head", "Body", C("#080606"))  # nose
    R.part(prim("cube", (0.13, 0.2, 0.04), loc=(0, -0.19, 1.565), rot=(math.radians(10), 0, 0)), "Head", "Body", C("#5a1418"))  # jaw
    for sx in (-1, 1):
        R.part(prim("cone", (0.09, 0.06, 0.16), loc=(sx * 0.075, 0.02, 1.86), rot=(0, sx * math.radians(14), 0), segs=4), "Head", "Body", C(fur))
        R.part(prim("cone", (0.02, 0.02, 0.05), loc=(sx * 0.045, -0.29, 1.575), rot=(math.pi, 0, 0), segs=4), "Head", "Body", C("#efe6d0"))  # fangs
    # mane/ruff
    R.part(prim("ico", (0.42, 0.36, 0.26), loc=(0, 0.05, 1.47)), "Torso", "Body", C(fur))

def tail(R, fur="#2a2624", length=0.6):
    R.part(prim("cone", (0.13, 0.13, length), loc=(0, 0.3, 0.75), rot=(math.radians(-60), 0, 0), segs=5), "Hips", "Body", C(fur))

def bulk(R, f=1.3):
    R.scale_verts(["Torso", "Abdomen"], f, f * 1.1, 1.0, center=Vector((0, 0.02, 1.2)), thresh=0.4)
    for side in ("L", "R"):
        for g in ("UpperArm.", "LowerArm."):
            vs = R.group_verts([g + side], 0.4)
            if not vs: continue
            for v in vs:
                v.co.y = 0.02 + (v.co.y - 0.02) * 1.35; v.co.z = 1.43 + (v.co.z - 1.43) * 1.35

def crossbow(R):
    c = hand(R, "R")
    R.part(prim("cube", (0.06, 0.6, 0.07), loc=(c.x, c.y - 0.22, c.z + 0.02)), "Palm.R", "Body", C("#5a3a20"))
    R.part(prim("cube", (0.62, 0.04, 0.04), loc=(c.x, c.y - 0.48, c.z + 0.05)), "Palm.R", "Metal", C("#9aa0aa"))
    R.part(prim("cube", (0.015, 0.4, 0.015), loc=(c.x, c.y - 0.36, c.z + 0.08)), "Palm.R", "Glow", (0.85, 0.9, 1.0, 1))  # silver bolt

def torch(R):
    c = hand(R, "R"); Y = (0, math.pi / 2, 0)
    R.part(prim("cyl", (0.05, 0.05, 0.6), loc=(c.x + 0.2, c.y - 0.03, c.z), rot=Y, segs=6), "Palm.R", "Body", C("#4a3020"))
    R.part(prim("cyl", (0.09, 0.09, 0.1), loc=(c.x + 0.5, c.y - 0.03, c.z), rot=Y, segs=6), "Palm.R", "Body", C("#2a2a2a"))
    R.part(prim("cone", (0.17, 0.17, 0.3), loc=(c.x + 0.68, c.y - 0.03, c.z), rot=(0, -math.pi / 2, 0), segs=6), "Palm.R", "Glow", (1.0, 0.45, 0.08, 1))

def staff(R, top="sun", side="R"):
    c = hand(R, side); sx = 1 if side == "R" else -1; Y = (0, math.pi / 2, 0)
    R.part(prim("cyl", (0.04, 0.04, 1.7), loc=(c.x + sx * 0.05, c.y - 0.03, c.z), rot=Y, segs=6), "Palm." + side, "Body", C("#6a4a24"))
    if top == "sun":
        R.part(prim("cyl", (0.26, 0.26, 0.03), loc=(c.x + sx * 0.95, c.y - 0.03, c.z), rot=(math.pi / 2, 0, 0), segs=10), "Palm." + side, "Glow", (1.0, 0.75, 0.25, 1))
    elif top == "skull":
        R.part(prim("ico", (0.16, 0.16, 0.16), loc=(c.x + sx * 0.9, c.y - 0.03, c.z)), "Palm." + side, "Glow", (0.35, 0.6, 1.0, 1))

def shield(R, col="#e8e4dc", rim="#b0905a"):
    p = R.bonepos("LowerArm.L"); q = R.bonepos("Palm.L"); c = (p + q) / 2
    R.part(prim("cube", (0.06, 0.48, 0.58), loc=(c.x, c.y - 0.02, c.z - 0.08)), "LowerArm.L", "Team", C(col))
    R.part(prim("cube", (0.07, 0.12, 0.12), loc=(c.x + 0.005, c.y - 0.02, c.z - 0.08)), "LowerArm.L", "Metal", C(rim))

def banner_back(R, h=2.4):
    R.part(prim("cyl", (0.04, 0.04, h), loc=(0.12, 0.2, 1.0 + h / 2 - 0.6), segs=6), "Torso", "Body", C("#5a3a20"))
    R.part(prim("cube", (0.02, 0.4, 0.55), loc=(0.12, 0.42, 1.0 + h - 0.95)), "Torso", "Team", C("#ffffff"))
    R.part(prim("ico", (0.14, 0.14, 0.14), loc=(0.12, 0.2, 1.0 + h - 0.55)), "Torso", "Glow", (1.0, 0.75, 0.25, 1))

def holy_hand(R, side="L"):
    c = hand(R, side)
    R.part(prim("ico", (0.16, 0.16, 0.16), loc=(c.x, c.y - 0.05, c.z + 0.05)), "Palm." + side, "Glow", (1.0, 0.8, 0.3, 1))

def bone_trophies(R):
    for i, x in enumerate((-0.16, -0.06, 0.06, 0.16)):
        R.part(prim("ico", (0.07, 0.07, 0.08), loc=(x, -0.17, 1.38 - abs(x) * 0.4)), "Torso", "Body", C("#ddd2b4"))

def hair_long(R, col="#0a0808"):
    R.part(prim("cube", (0.22, 0.08, 0.42), loc=(0, 0.14, 1.52)), "Head", "Body", C(col))

LEGS = ["UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R"]
ARMS_U = ["UpperArm.L", "UpperArm.R"]; ARMS_L = ["LowerArm.L", "LowerArm.R"]
def clothe(R, legs=None, upper=None, lower=None):
    if legs: R.recolor_group(LEGS, C(legs), 0.5)
    if upper: R.recolor_group(ARMS_U, C(upper), 0.5)
    if lower: R.recolor_group(ARMS_L, C(lower), 0.5)
# --------------- recipes ---------------
def ghoul():
    R = Rig(MAN, "night", {"Shirt": C("#7c857c"), "Skin": C("#8e9a8c"), "Hair": C("#7c857c"), "Socks": C("#4c544c"), "Pants": C("#ffffff"), "Eyes": C("#100c0c")},
            team_mats=("Pants",))
    fix_glow(R.mats["Glow"], (1, 0.08, 0.04, 1), 6)
    R.scale_verts(["Torso", "Abdomen"], 0.85, 0.85, 1.0, center=Vector((0, 0.02, 1.2)), thresh=0.4)
    claws(R, length=0.14)
    glow_eyes(R)
    R.offset_bone_rotation("Abdomen", (1, 0, 0), 25)
    R.offset_bone_rotation("Torso", (1, 0, 0), 12)
    R.offset_bone_rotation("Neck", (1, 0, 0), -25)
    return R.finish("ghoul", 1.75 / 1.8, dict(MANCLIPS, Attack="Man_Punch"), 1450)

def thrall():
    R = Rig(MAN, "night", {"Shirt": C("#1c1418"), "Skin": C("#e0d8d6"), "Pants": C("#121014"), "Socks": C("#241618"), "Hair": C("#0a0808"), "Eyes": C("#100c0c")})
    fix_glow(R.mats["Glow"], (1, 0.1, 0.1, 1), 4)
    clothe(R, "#141014", "#1c1418", "#2a1a1c")
    cape(R); collar(R, mat="Team"); breastplate(R, "#3a3438"); pauldrons(R, "#3a3438", 0.14)
    sword(R, 0.9, 0.05, col="#d0d4dc", guard="#8a1020")
    return R.finish("thrall", 1.0, MANCLIPS, 1500)

def werewolf(key="werewolf", fur="#2c2826", h=2.4, hero=False):
    R = Rig(MAN, "night", {"Shirt": C(fur), "Skin": C(fur), "Hair": C(fur), "Socks": C(fur), "Pants": C("#ffffff"), "Eyes": C("#100c0c")},
            team_mats=("Pants",))
    fix_glow(R.mats["Glow"], (1, 0.1, 0.03, 1), 7)
    bulk(R, 1.35)
    wolf_head(R, fur, "#3c3632" if not hero else "#7a726c")
    glow_eyes(R, y=-0.115, z=1.70, dx=0.05)
    claws(R, length=0.16); tail(R, fur)
    if hero:
        bone_trophies(R); banner_back(R, 2.2)
    R.offset_bone_rotation("Abdomen", (1, 0, 0), 14)
    R.offset_bone_rotation("Neck", (1, 0, 0), -10)
    clips = dict(MANCLIPS, Attack="Man_Punch")
    if hero: clips["Ability"] = "Man_Jump"
    return R.finish(key, h / 1.8, clips, 2900 if hero else 1500, path=f"{OUT}/{'heroes' if hero else 'units'}/{key}.glb")

def crossbowman():
    R = Rig(MAN, "dawn", {"Shirt": C("#ffffff"), "Skin": C("#c99a74"), "Pants": C("#6c7078"), "Socks": C("#4a3222"), "Hair": C("#5a3a20"), "Eyes": C("#100c0c")},
            team_mats=("Shirt",))
    clothe(R, "#6c7078", "#8a8f98", "#5a3a22")
    helmet(R, "#c0c6d0", "kettle"); tabard(R); crossbow(R)
    return R.finish("crossbow", 1.0, dict(MANCLIPS, Attack="Man_Punch"), 1500)

def torchbearer():
    R = Rig(MAN, "dawn", {"Shirt": C("#ffffff"), "Skin": C("#d0a07a"), "Pants": C("#5a4a3a"), "Socks": C("#4a3222"), "Hair": C("#6a4a2a"), "Eyes": C("#100c0c")},
            team_mats=("Shirt",))
    fix_glow(R.mats["Glow"], (1, 0.45, 0.08, 1), 8)
    clothe(R, "#5a4a3a", "#e6dcc8")
    hood(R, "#e6dcc8", "Body", 0.13); torch(R)
    return R.finish("torch", 1.0, MANCLIPS, 1500)

def priest():
    R = Rig(MAN, "dawn", {"Shirt": C("#ece6d8"), "Skin": C("#d0a07a"), "Pants": C("#ece6d8"), "Socks": C("#ece6d8"), "Hair": C("#6a4a2a"), "Eyes": C("#100c0c")})
    fix_glow(R.mats["Glow"], (1, 0.75, 0.25, 1), 5)
    clothe(R, "#ece6d8", "#ece6d8", "#ece6d8")
    robe(R, col="#ece6d8"); hood(R, "#ece6d8"); tabard(R); staff(R, "sun")
    return R.finish("priest", 1.0, dict(MANCLIPS, Attack="Man_Punch"), 1500)

def vael():
    R = Rig(MAN, "night", {"Shirt": C("#16101a"), "Skin": C("#e8e0e0"), "Pants": C("#16101a"), "Socks": C("#16101a"), "Hair": C("#0a0808"), "Eyes": C("#100c0c")})
    fix_glow(R.mats["Glow"], (1, 0.1, 0.15, 1), 5)
    R.scale_verts(["Torso", "Abdomen"], 0.85, 0.9, 1.0, center=Vector((0, 0.02, 1.2)), thresh=0.4)
    clothe(R, "#16101a", "#16101a")
    robe(R, 0.17, 0.42, 1.02, 0.03, "Team", segs=12)
    collar(R, h=0.3, w=0.4)
    cape(R, length=1.35, width=0.5)
    hair_long(R)
    R.part(prim("cone", (0.24, 0.24, 0.12), loc=(0, 0.0, 1.84), r2=0.2, segs=6), "Head", "Metal", C("#c8a040"))  # tiara band
    sword(R, 0.8, 0.025, col="#e0e4ea", guard="#c8a040")
    clips = dict(MANCLIPS); clips["Ability"] = "Man_Clapping"
    return R.finish("vael", 2.2 / 1.8, clips, 2900, path=f"{OUT}/heroes/vael.glb")

def ashen():
    R = Rig(MAN, "dawn", {"Shirt": C("#ece6d8"), "Skin": C("#c08a66"), "Pants": C("#ece6d8"), "Socks": C("#5a3a22"), "Hair": C("#8a8580"), "Eyes": C("#100c0c")})
    fix_glow(R.mats["Glow"], (1, 0.78, 0.3, 1), 6)
    clothe(R, "#ece6d8", "#ece6d8", "#8a8f98")
    robe(R, col="#ece6d8"); hood(R, "#ece6d8", r=0.15); pauldrons(R, "#b8bec8", 0.17); tabard(R)
    banner_back(R, 2.4); holy_hand(R, "L"); sword(R, 0.8, 0.06, col="#d8dce4", guard="#c8a040")
    clips = dict(MANCLIPS); clips["Ability"] = "Man_Clapping"
    return R.finish("ashen", 2.2 / 1.8, clips, 2900, path=f"{OUT}/heroes/ashen.glb")

def grimfang():
    return werewolf("grimfang", "#6a625c", 2.6, hero=True)

ALL = dict(ghoul=ghoul, thrall=thrall, werewolf=werewolf, crossbow=crossbowman, torch=torchbearer, priest=priest, vael=vael, ashen=ashen, grimfang=grimfang)

SKEL = f"{CAND}/wODZYCgX5Z.glb"
def bone_archer():
    R = Rig(SKEL, "night", {"Skeleton": C("#d6cbb0")}, base_height=1.75, ground_clip="Skeleton_Idle")
    fix_glow(R.mats["Glow"], (1, 0.1, 0.05, 1), 6)
    hp = R.bonepos("Head")
    R.scale_verts(["Head"], 0.72, 0.72, 0.72, center=hp, thresh=0.5)
    hb = R.group_bounds(["Head"]); hc = (hb[0] + hb[1]) / 2
    # hood (Team) covering top/back of skull, open face
    sz = hb[1] - hb[0]
    R.part(prim("sphere", (sz.x * 1.2, sz.y * 1.05, sz.z * 1.1), loc=(hc.x, hc.y + sz.y * 0.1, hc.z + sz.z * 0.1), segs=10), "Head", "Team")
    R.part(prim("cube", (sz.x * 1.1, 0.1, 0.45), loc=(hc.x, hc.y + sz.y * 0.4, hb[0].z - 0.12)), "Torso", "Team")
    # eyes
    for sx in (-1, 1):
        R.part(prim("cube", (0.05, 0.02, 0.035), loc=(hc.x + sx * sz.x * 0.2, hb[0].y + 0.004, hc.z - sz.z * 0.05)), "Head", "Glow", (1, 0.1, 0.05, 1))
    # bow in left (-X) hand: vertical arc
    hand_ = R.bonepos("L.DownLeg.001"); hx = hand_.x - 0.2; hz = hand_.z
    for i in range(5):
        t = (i - 2) / 2.0
        R.part(prim("cube", (0.03, 0.03, 0.17), loc=(hx, 0.04 - 0.09 * (1 - t * t), hz + t * 0.3), rot=(math.radians(-t * 35), 0, 0)), "L.DownLeg.001", "Body", C("#e8dcc0"))
    R.part(prim("cube", (0.006, 0.006, 0.72), loc=(hx, 0.05, hz)), "L.DownLeg.001", "Body", C("#30201a"))
    # quiver
    tb = R.bonepos("Torso")
    R.part(prim("cyl", (0.11, 0.11, 0.42), loc=(0.1, 0.17, tb.z + 0.2), rot=(math.radians(15), math.radians(-20), 0), segs=6), "Torso", "Body", C("#3a1c18"))
    clips = {"Idle": "Skeleton_Idle", "Walk": "Skeleton_Running", "Run": "Skeleton_Running", "Attack": "Skeleton_Attack", "Death": "Skeleton_Death", "Ability": "Skeleton_Spawn"}
    return R.finish("archer", 1.0, clips, 1500)

ALL["archer"] = bone_archer

if __name__ == "__main__":
    for k in sys.argv[sys.argv.index("--") + 1:]:
        ALL[k]()
