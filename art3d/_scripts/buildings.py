import sys; sys.path.insert(0, "/workspace/tools3d/lib")
from build import *
C = srgb

def pennant(B, x, y, z, s=1.0, h=1.0):
    B.prim("cyl", (0.05 * s, 0.05 * s, h * s), (x, y, z + h * s / 2), color=srgb("#3a2a20"), segs=5)
    B.prim("cube", (0.03 * s, 0.42 * s, 0.3 * s), (x, y + 0.22 * s, z + h * s - 0.18 * s), mat="Team")

def windows(B, x, y, z, half, s=1.0, faces="nsew", n=1, w=0.13, h=0.3):
    """emissive window slits on the faces of a square block centred (x,y), half-size `half` (all world units)."""
    for f in faces:
        for k in range(n):
            o = (k - (n - 1) / 2) * half * 0.8
            if f == "s": B.glowbox((w * s, 0.04, h * s), (x + o, y - half - 0.01, z))
            if f == "n": B.glowbox((w * s, 0.04, h * s), (x + o, y + half + 0.01, z))
            if f == "e": B.glowbox((0.04, w * s, h * s), (x + half + 0.01, y + o, z))
            if f == "w": B.glowbox((0.04, w * s, h * s), (x - half - 0.01, y + o, z))

def brazier(B, x, y, s=1.0):
    B.add("grave", "pillar-small", (x, y, 0), scale=(s * 1.6, s * 1.6, s * 0.7))
    B.prim("cyl", (0.3 * s, 0.3 * s, 0.08 * s), (x, y, 0.55 * s), color=srgb("#2a2624"), segs=6)
    B.glowbox((0.26 * s, 0.26 * s, 0.34 * s), (x, y, 0.75 * s), kind="cone", segs=5)

def ring(B, n, style, h_tower="square", tall=1):
    """square wall ring of (2n+1) cells, corner towers, gate at front (-Y)."""
    for i in range(-n + 1, n):
        if i == 0: B.add("castle", "wall-narrow-gate", (0, -n, 0), 90)
        else: B.add("castle", "wall", (i, -n, 0), 90)
        B.add("castle", "wall", (i, n, 0), 90)
        B.add("castle", "wall", (-n, i, 0), 0); B.add("castle", "wall", (n, i, 0), 0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * n, sy * n
            if h_tower == "corner": B.add("castle", "wall-corner", (x, y, 0)); continue
            B.add("castle", "tower-square-base", (x, y, 0)); z = 1.01
            for t in range(tall): B.add("castle", "tower-square-mid", (x, y, z)); z += 1.01
            windows(B, x, y, z - 0.5, 0.48, faces="s" if sy < 0 else "n")
            if style == "night": B.add("castle", "tower-square-top", (x, y, z))
            else: B.add("castle", "tower-square-top-roof-rounded", (x, y, z), team=True)

def keep_tower(B, loc, mids, style, s=1.0, door=True, win=True):
    x, y = loc; z = 0
    B.add("castle", "tower-square-base", (x, y, z), scale=s); z += 1.01 * s
    for k in range(mids):
        B.add("castle", "tower-square-mid-door" if (k == 0 and door) else "tower-square-mid", (x, y, z), scale=s)
        if win and not (k == 0 and door): windows(B, x, y, z + 0.55 * s, 0.475 * s, s, n=1)
        z += 1.01 * s
    if style == "night":
        B.add("castle", "tower-square-top", (x, y, z), scale=s); z += 0.3 * s
        B.add("castle", "tower-square-roof", (x, y, z), scale=(s * 0.9, s * 0.9, s * 1.2))
        z += 2.0 * s * 1.2
    else:
        B.add("castle", "tower-square-top-roof-rounded", (x, y, z), scale=s, team=True); z += 0.95 * s
    return z

def flag(B, loc, z, s=1.0, long=False):
    B.add("castle", "flag-banner-long" if long else "flag", (loc[0], loc[1], z), scale=s, team=True)

def small_keep(B, style):
    """L1: a compact square keep block with a corner turret, door, windows, braziers."""
    W = 2.0
    B.add("castle", "tower-square-base", (0, 0.1, 0), scale=(W, W, 1.0))
    B.add("castle", "tower-square-mid", (0, 0.1, 1.01), scale=(W * 1.02, W * 1.02, 1.4))
    windows(B, 0, 0.1, 1.01 + 0.75, 0.475 * W * 1.02, 1.3, faces="nsew", n=2)
    B.add("castle", "tower-square-top", (0, 0.1, 1.01 + 1.414), scale=(W, W, 1.0))
    B.add("castle", "door", (0, 0.1 - W / 2 - 0.02, 0), 90, scale=1.5)
    z = keep_tower(B, (0.55, 0.65), 3, style, 0.75, door=False)
    flag(B, (0.55, 0.65), z - (1.8 if style == "night" else 0), 1.0)
    for sx in (-1, 1): brazier(B, sx * 0.75, -1.2, 0.8)

def fortress(style, level, path):
    B = Build(style)
    if level == 1:
        small_keep(B, style)
        return B.finish(path, scale=1.85)
    elif level == 2:
        ring(B, 2, style, h_tower="corner")
        top = keep_tower(B, (0, 0.3), 2, style, 1.15)
        flag(B, (0, 0.3), top - (2.4 if style == "night" else 0), 1.4)
        for sx in (-1, 1): pennant(B, sx * 2, -2, 1.31, 1.0)
        for sx in (-1, 1): brazier(B, sx * 0.7, -2.75, 0.8)
    else:
        ring(B, 2, style, h_tower="square", tall=1)
        top = keep_tower(B, (0, 0.3), 3, style, 1.2)
        flag(B, (0, 0.3), top - (2.5 if style == "night" else 0), 1.5)
        for sx in (-1, 1):
            B.add("castle", "flag-banner-long", (sx * 0.5, -2.05, 0.2), rot=90, team=True)
            for sy in (-1, 1): pennant(B, sx * 2, sy * 2, 2.6 if style == "night" else 2.9, 0.9)
            brazier(B, sx * 0.75, -2.75, 0.8)
        # inner hall wing behind the keep
        B.add("castle", "tower-square-base", (0, 1.25, 0), scale=(2.4, 0.9, 0.9)); B.add("castle", "tower-square-mid", (0, 1.25, 0.9), scale=(2.4, 0.9, 0.8))
        windows(B, 0, 1.25, 1.3, 0.47 * 2.4, 1.0, faces="ew")
    return B.finish(path, scale=1.5)

def crypt(level, path):
    B = Build("night"); S = 2.2
    if level == 1:
        B.add("grave", "crypt-small", (0, 0.2, 0)); B.add("grave", "crypt-small-roof", (0, 0.2, 1.0))
        for x, p in ((-0.8, "gravestone-cross"), (0.8, "gravestone-round"), (-0.9, "gravestone-broken")):
            B.add("grave", p, (x, -0.9 if p != "gravestone-broken" else 0.9, 0))
        B.add("grave", "candle-multiple", (0.35, -0.75, 0), glow=True)
        B.add("castle", "flag-banner-short", (0.0, -0.55, 1.0), rot=90, team=True, scale=0.9)
    elif level == 2:
        B.add("grave", "crypt-large", (0, 0.3, 0)); B.add("grave", "crypt-large-roof", (0, 0.3, 1.0)); B.add("grave", "crypt-large-door", (0, -0.92, 0))
        for sx in (-1, 1):
            B.add("grave", "pillar-obelisk", (sx * 1.25, -1.1, 0)); B.add("grave", "lantern-candle", (sx * 0.55, -1.25, 0), glow=True)
            B.add("grave", "gravestone-cross-large", (sx * 1.35, 0.6, 0), rot=sx * 90)
        for x in (-0.9, 0.9): B.add("castle", "flag-banner-long", (x, -0.95, 0.05), rot=90, team=True, scale=0.8)
    else:
        B.add("grave", "crypt-large", (0, 0.4, 0)); B.add("grave", "crypt-large-roof", (0, 0.4, 1.0)); B.add("grave", "crypt-large-door", (0, -0.82, 0))
        for sx in (-1, 1):
            B.add("grave", "crypt-small", (sx * 1.35, 0.7, 0), scale=0.85); B.add("grave", "crypt-small-roof", (sx * 1.35, 0.7, 0.85), scale=0.85)
            B.add("grave", "pillar-obelisk", (sx * 1.4, -0.9, 0), scale=1.3); B.add("grave", "pillar-obelisk", (sx * 0.65, -1.35, 0), scale=1.0)
            brazier(B, sx * 0.35, -1.5, 0.55)
        for x in (-1.5, -0.5, 0.5, 1.5):
            if abs(x) > 0.6: B.add("grave", "iron-fence", (x, -1.95, 0), rot=0)
        for x in (-0.9, 0.9): B.add("castle", "flag-banner-long", (x, -0.85, 0.05), rot=90, team=True, scale=0.9)
        B.add("grave", "column-large", (0, 1.7, 0), scale=1.4)
    return B.finish(path, scale=S)

def house(B, cells, wall="wall-wood", door="wall-wood-door", window="wall-wood-window-shutters", roof="roof-gable", floors=1, team_roof=False, roof_rot=0):
    """cells: list of (x,y) in town units. walls on outer edges, door on first -Y edge."""
    cs = set(cells); door_done = False
    for f in range(floors):
        z = f * 1.0
        for (x, y) in cells:
            for rot, (dx, dy) in ((0, (1, 0)), (90, (0, 1)), (180, (-1, 0)), (270, (0, -1))):
                if (x + dx, y + dy) in cs: continue
                piece = wall
                if rot == 270 and not door_done and f == 0: piece = door; door_done = True
                elif (x + y + f) % 2 == 0: piece = window
                B.add("town", piece, (x, y, z), rot)
    for (x, y) in cells:
        B.add("town", roof, (x, y, floors * 1.0), roof_rot, team=team_roof)

def blood_farm(level, path):
    B = Build("night"); S = 1.9
    def vat(x, y, s=1.0):
        B.add("town", "fountain-round", (x, y, 0), scale=s)
        B.prim("cyl", (0.9 * s, 0.9 * s, 0.05), (x, y, 0.28 * s), mat="Glow", color=(0.6, 0.02, 0.02, 1), segs=10)
    if level == 1:
        house(B, [(0, 0), (0, 1)], roof_rot=0)
        for y in (-1, 0, 1): B.add("town", "fence", (1, y, 0), 0)
        B.add("grave", "hay-bale", (1.6, 0.6, 0)); B.add("town", "banner-red", (0, 1, 0), 0, team=True)
        B.add("grave", "lantern-candle", (0.6, -0.9, 0), glow=True)
    elif level == 2:
        house(B, [(0, 0), (0, 1), (-1, 0), (-1, 1)])
        for y in (-1, 0, 1, 2): B.add("town", "fence", (1, y, 0), 0)
        for x in (1,): B.add("town", "fence", (x, 2, 0), 90)
        vat(1.5, -0.4, 0.5); B.add("grave", "hay-bale-bundled", (1.6, 1.2, 0)); B.add("town", "cart", (-1.9, -0.5, 0), 20)
        B.add("town", "banner-red", (0, 0, 0), 0, team=True); B.add("town", "banner-red", (0, 1, 0), 0, team=True)
    else:
        house(B, [(0, 0), (0, 1), (-1, 0), (-1, 1)], floors=2)
        hook_rack(B, 2.1, 1.6, 3, 0)
        B.add("town", "chimney", (-1, 1, 2.0), 0)
        for y in (-2, -1): B.add("town", "fence", (2.4, y, 0), 0)
        for x in (1, 2): B.add("town", "fence", (x, -2.5, 0), 270)
        vat(1.5, -1.2, 0.6); brazier(B, -1.6, -1.6, 0.6)
        B.add("grave", "hay-bale-bundled", (2.9, 0.4, 0)); B.add("grave", "hay-bale", (-2.0, 0.6, 0), 80)
        for p in ((0, 0), (0, 1)): B.add("town", "banner-red", (p[0], p[1], 1.0), 0, team=True)
        B.add("castle", "flag-banner-long", (0.8, -0.9, 0), 0, team=True, scale=0.9)
        for x in (-0.6, 0.9): B.add("grave", "lantern-candle", (x, -1.0, 0), glow=True)
    return B.finish(path, scale=S)

def barracks(level, path):
    B = Build("dawn"); S = 1.9
    if level == 1:
        house(B, [(0, 0), (1, 0)], wall="wall", door="wall-door", window="wall-window-shutters", roof="roof-gable", team_roof=True, roof_rot=90)
        B.add("town", "stall", (0.5, -1.1, 0), 90); B.add("town", "banner-green", (1, 0, 0), 0, team=True)
    elif level == 2:
        house(B, [(0, 0), (1, 0), (0, 1), (1, 1)], wall="wall", door="wall-door", window="wall-window-shutters", roof="roof-high", team_roof=True)
        for x in (-1, 0, 1, 2): B.add("town", "fence", (x, -1.6, 0), 270)
        B.add("town", "stall-red", (2.2, -0.9, 0), 0); B.add("town", "banner-green", (1, 0, 0), 0, team=True); B.add("town", "banner-green", (1, 1, 0), 0, team=True)
    else:
        house(B, [(0, 0), (1, 0), (0, 1), (1, 1)], wall="wall", door="wall-door", window="wall-window-shutters", roof="roof-high", floors=2, team_roof=True)
        B.add("castle", "tower-square-base", (-1.3, 1.2, 0)); B.add("castle", "tower-square-mid-windows", (-1.3, 1.2, 1.01)); B.add("castle", "tower-square-mid", (-1.3, 1.2, 2.02))
        B.add("castle", "tower-square-top-roof-rounded", (-1.3, 1.2, 3.03), team=True); B.add("castle", "flag", (-1.3, 1.2, 3.9), team=True)
        for x in (-1, 0, 1, 2): B.add("town", "fence", (x, -1.8, 0), 270)
        B.add("town", "stall-red", (2.4, -1.0, 0), 0); B.add("castle", "siege-ballista", (-1.3, -1.0, 0), 200, scale=0.8)
        for p in ((1, 0), (1, 1)): B.add("town", "banner-green", (p[0], p[1], 1.0), 0, team=True)
    return B.finish(path, scale=S)

def mill(level, path):
    B = Build("dawn"); S = 1.9
    s = (0.8, 1.0, 1.2)[level - 1]
    z = 0
    B.add("castle", "tower-hexagon-base", (0, 0, 0), scale=(s, s, s)); z = 1.31 * s
    for k in range(level - 1): B.add("castle", "tower-hexagon-mid", (0, 0, z), scale=s); z += 0.46 * s
    B.add("castle", "tower-hexagon-top-wood", (0, 0, z), scale=s); z += 0.46 * s * 0.6
    B.add("castle", "tower-hexagon-roof", (0, 0, z), scale=s, team=True)
    hub_z = z - 0.05
    sails = B.add("town", "windmill", (0, -0.5 * s, hub_z), 90, scale=0.65 * s)
    B.add("castle", "door", (0, -0.42 * s, 0), 90, scale=s)
    if level >= 2:
        for x in (-1, 0, 1): B.add("town", "fence", (x, 1.2, 0), 90)
        B.add("grave", "hay-bale", (1.1, -0.6, 0)); B.add("grave", "hay-bale-bundled", (-1.1, 0.5, 0))
    if level == 3:
        house(B, [(1.7, 0.6), (1.7, 1.6)], wall="wall", door="wall-door", window="wall-window-shutters", roof="roof-gable", team_roof=True)
        B.add("town", "cart", (-1.6, -1.0, 0), 30); B.add("town", "stall", (-1.8, 1.2, 0), 0)
        B.add("castle", "flag", (0, 0, z + 0.8 * s), team=True)
    # animate sails: Idle clip rotating about Y (front axis)
    sails.rotation_mode = "XYZ"
    sails_obj = sails
    B.objs.remove(sails)
    piv = sails.matrix_world.translation.copy()
    # set origin at hub
    bpy.context.view_layer.objects.active = sails; bpy.ops.object.select_all(action="DESELECT"); sails.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    sails.name = "Sails"
    info = finish_with_spin(B, path, S, sails)
    return info

def finish_with_spin(B, path, S, sails):
    # scale sails position/size with building scale
    sails.matrix_world = Matrix.Diagonal((S, S, S, 1)) @ sails.matrix_world
    bpy.context.view_layer.objects.active = sails; bpy.ops.object.select_all(action="DESELECT"); sails.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    sails.animation_data_create()
    act = bpy.data.actions.new("Idle"); sails.animation_data.action = act
    sails.rotation_mode = "XYZ"
    for f, ang in ((1, 0), (97, -2 * math.pi)):
        sails.rotation_euler = (0, ang, 0); sails.keyframe_insert("rotation_euler", index=1, frame=f)
    for fc in act.fcurves:
        for k in fc.keyframe_points: k.interpolation = "LINEAR"
    tr = sails.animation_data.nla_tracks.new(); tr.name = "Idle"; tr.strips.new("Idle", 1, act); sails.animation_data.action = None
    return B.finish(path, scale=S, keep_separate=(sails,), sweeps=(sails,))

def tower(style, level, path):
    B = Build(style); s = 1.0; z = 0
    B.add("castle", "tower-square-base", (0, 0, 0)); z = 1.01
    for k in range(level):
        B.add("castle", "tower-square-mid-windows" if k else "tower-square-mid-door", (0, 0, z)); z += 1.01
    if style == "neutral":
        B.add("castle", "tower-hexagon-top-wood", (0, 0, z), scale=1.1)
    elif style == "night":
        B.add("castle", "tower-square-top", (0, 0, z)); B.add("castle", "tower-square-roof", (0, 0, z + 0.3), scale=(0.9, 0.9, 1.1))
        pennant(B, 0.42, -0.42, z + 0.3, 1.0, 1.1)
        if level >= 2: B.add("grave", "pillar-obelisk", (0.8, -0.8, 0))
        if level == 3: B.add("castle", "flag-banner-long", (0, -0.52, 0.8), 90, team=True); brazier(B, -0.8, -0.8, 0.6)
    else:
        B.add("castle", "tower-square-top-roof-high-windows", (0, 0, z), team=True)
        if level >= 2: B.add("castle", "flag", (0, 0, z + 1.05), team=True)
        if level == 3: B.add("castle", "flag-banner-long", (0, -0.52, 0.8), 90, team=True)
    return B.finish(path, scale=1.6)

def outpost_plot(path):
    B = Build("neutral", "neutral"); S = 2.0
    B.prim("cube", (3.6, 3.6, 0.1), (0, 0, 0.05), color=srgb("#3d3328"))
    B.prim("cube", (3.0, 3.0, 0.04), (0, 0, 0.11), color=srgb("#5a4c3c"))
    for x, y, r in ((-1.5, -0.6, 0), (-1.5, 0.6, 0), (1.5, 0.3, 0)):
        B.add("town", "fence-broken", (x, y, 0), r + 180 if x < 0 else r)
    B.add("grave", "rocks", (1.3, 1.3, 0)); B.add("castle", "rocks-small", (-1.2, 1.3, 0), scale=0.6)
    B.add("town", "planks-half", (0.6, -1.1, 0.0))
    B.add("castle", "flag", (-1.1, -1.1, 0), team=True)
    return B.finish(path, scale=S)

def watchtower(path):
    B = Build("neutral", "neutral")
    B.add("castle", "tower-square-base", (0, 0, 0)); B.add("castle", "tower-square-mid-door", (0, 0, 1.01)); B.add("castle", "tower-square-mid-open", (0, 0, 2.02))
    B.add("castle", "tower-hexagon-top-wood", (0, 0, 3.03), scale=1.1)
    B.add("castle", "rocks-small", (0.8, -0.7, 0), scale=0.5); B.add("castle", "stairs-stone", (-0.75, 0.1, 0), 0)
    B.add("castle", "flag", (0, 0, 3.6), team=True)
    return B.finish(path, scale=1.6)

JOBS = {}
for st, nm in (("night", "fortress"), ("dawn", "keep")):
    for l in (1, 2, 3): JOBS[f"{nm}_l{l}"] = (lambda st=st, nm=nm, l=l: fortress(st, l, f"{OUT}/buildings/{nm}_l{l}.glb"))
for l in (1, 2, 3):
    JOBS[f"crypt_l{l}"] = lambda l=l: crypt(l, f"{OUT}/buildings/crypt_l{l}.glb")
    JOBS[f"bloodfarm_l{l}"] = lambda l=l: blood_farm(l, f"{OUT}/buildings/bloodfarm_l{l}.glb")
    JOBS[f"barracks_l{l}"] = lambda l=l: barracks(l, f"{OUT}/buildings/barracks_l{l}.glb")
    JOBS[f"mill_l{l}"] = lambda l=l: mill(l, f"{OUT}/buildings/mill_l{l}.glb")
    JOBS[f"ntower_l{l}"] = lambda l=l: tower("night", l, f"{OUT}/buildings/ntower_l{l}.glb")
    JOBS[f"dtower_l{l}"] = lambda l=l: tower("dawn", l, f"{OUT}/buildings/dtower_l{l}.glb")
JOBS["outpost_plot"] = lambda: outpost_plot(f"{OUT}/buildings/outpost_plot.glb")
JOBS["watchtower"] = lambda: watchtower(f"{OUT}/buildings/watchtower.glb")

# ---------------- batch 2 buildings ----------------
def skull(B, x, y, z, s=1.0, eyes=True):
    B.prim("ico", (0.22 * s, 0.26 * s, 0.22 * s), (x, y, z), color=srgb("#d8ccb0"))
    if eyes:
        for sx in (-1, 1): B.glowbox((0.05 * s, 0.03, 0.04 * s), (x + sx * 0.05 * s, y - 0.12 * s, z))

def totem(B, x, y, s=1.0):
    B.add("grave", "pillar-obelisk", (x, y, 0), scale=(s, s, s * 1.1)); skull(B, x, y, 1.15 * s, s)

def wolfden(level, path):
    B = Build("night"); S = 2.0
    eyes = lambda x, y, z: [B.glowbox((0.07, 0.03, 0.04), (x + d, y, z)) for d in (-0.06, 0.06)]
    def bones(x, y, r=0):
        for k in range(3): B.prim("cyl", (0.05, 0.05, 0.42), (x + k * 0.07, y, 0.03), rot=(math.pi / 2, 0, math.radians(r + k * 35)), color=srgb("#d8ccb0"), segs=4)
        B.prim("ico", (0.16, 0.18, 0.15), (x + 0.1, y - 0.18, 0.07), color=srgb("#d8ccb0"))
    # cave mouth: dark opening framed by tall rocks, rock lintel on top
    B.prim("cube", (0.7, 0.2, 0.62), (0, -0.05, 0.31), color=srgb("#050304"))
    B.add("nature", "rock_tallA", (-0.62, 0.05, 0), 90, scale=(1.0, 1.0, 1.0)); B.add("nature", "rock_tallB", (0.62, 0.05, 0), 0, scale=(1.0, 1.0, 1.05))
    B.add("nature", "rock_largeB", (0, 0.15, 0.62), 90, scale=(1.4, 1.4, 1.0)); B.add("nature", "rock_largeC", (0, 0.65, 0), 0, scale=(1.4, 1.2, 2.2))
    eyes(-0.12, -0.16, 0.28); eyes(0.15, -0.16, 0.36)
    bones(0.35, -0.6); B.add("castle", "flag-banner-short", (-0.95, -0.25, 0.0), rot=90, team=True, scale=0.8)
    if level >= 2:
        B.add("nature", "rock_tallC", (-1.15, -0.2, 0), scale=1.3); B.add("nature", "rock_tallA", (1.25, 0.5, 0), 40, scale=0.9)
        totem(B, -0.95, -0.85, 0.8); totem(B, 0.95, -0.85, 0.8); brazier(B, -0.45, -1.0, 0.6)
        bones(-0.6, -0.4, 70); B.add("nature", "rock_largeA", (-1.0, 0.7, 0), 30, scale=1.3)
    if level == 3:
        B.add("nature", "rock_tallB", (-0.2, 0.9, 0.3), 120, scale=(1.4, 1.4, 1.6)); B.add("nature", "rock_tallC", (0.5, 0.5, 0.7), 0, scale=1.1)
        eyes(-0.9, -0.36, 0.5)
        for x in (-1.7, 1.7): B.add("castle", "flag-banner-long", (x, -0.3, 0.0), rot=90, team=True, scale=0.9)
        for x, y in ((-1.5, -1.5), (-0.7, -1.7), (0.7, -1.7), (1.5, -1.5)): B.add("grave", "pillar-obelisk", (x, y, 0), scale=(0.6, 0.6, 0.8))
        B.add("nature", "tree_thin_dark", (1.7, 1.3, 0), scale=1.4); bones(1.2, -1.0, 20); brazier(B, 0.45, -1.0, 0.6)
        skull(B, 0, -0.08, 1.15, 1.4)
    return B.finish(path, scale=(1.9, 2.2, 2.1)[level - 1])

def altar(level, path):
    B = Build("night"); S = 1.9; stone = srgb("#2c2830"); stone2 = srgb("#3a3440")
    st = (1.6, 2.4, 3.0)[level - 1]
    B.prim("cube", (st, st, 0.18), (0, 0, 0.09), color=stone)
    B.prim("cube", (st * 0.72, st * 0.72, 0.18), (0, 0, 0.27), color=stone2)
    B.add("grave", "altar-stone", (0, 0.05, 0.36), 0)
    B.glowbox((0.7, 0.36, 0.03), (0, 0.05, 0.86))  # blood pool on altar
    B.add("grave", "candle-multiple", (-0.5, 0.25, 0.36), glow=True)
    for sx in (-1, 1): totem(B, sx * st * 0.42, -st * 0.42, 0.8)
    if level >= 2:
        B.add("grave", "candle-multiple", (0.5, 0.25, 0.36), glow=True)
        for sx in (-1, 1): B.add("grave", "pillar-obelisk", (sx * st * 0.42, st * 0.42, 0), scale=1.2)
        B.add("grave", "coffin-old", (-st * 0.42, 0, 0.18), 90); B.add("grave", "urn-round", (st * 0.4, 0.05, 0.18))
        B.add("castle", "flag-banner-long", (0, st * 0.36, 0.36), rot=90, team=True, scale=1.0)
        B.glowbox((0.18, 0.18, 0.3), (0, 0.05, 1.45), kind="ico")   # floating blood crystal
    if level == 3:
        for sx in (-1, 1):
            for sy in (-1, 1):
                B.add("grave", "column-large", (sx * 1.05, sy * 1.05, 0.36), scale=(0.9, 0.9, 1.1))
        B.prim("cube", (2.5, 2.5, 0.16), (0, 0, 0.36 + 1.13 * 1.1 * 1.0), color=stone)  # canopy slab
        B.prim("cone", (1.9, 1.9, 0.9), (0, 0, 2.0), rot=(0, 0, math.pi / 4), color=srgb("#1c181e"), segs=4)
        for sx in (-1, 1): B.add("castle", "flag-banner-long", (sx * 1.25, -0.6, 1.5), rot=90, team=True, scale=0.8)
        B.add("grave", "iron-fence", (-0.9, -1.45, 0)); B.add("grave", "iron-fence", (0.9, -1.45, 0))
        for sx in (-1, 1): brazier(B, sx * 0.55, -1.35, 0.6)
    return B.finish(path, scale=S)

def vat(B, x, y, s=1.0):
    B.add("town", "fountain-round", (x, y, 0), scale=s)
    B.prim("cyl", (0.9 * s, 0.9 * s, 0.05), (x, y, 0.28 * s), mat="Glow", color=B.glow, segs=10)

def hook_rack(B, x, y, n=3, rot=0):
    c, sn = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    for sx in (-1, 1): B.prim("cyl", (0.06, 0.06, 1.0), (x + sx * 0.5 * c, y + sx * 0.5 * sn, 0.5), color=srgb("#2a1a14"), segs=5)
    B.prim("cube", (1.1, 0.06, 0.06), (x, y, 1.0), rot=(0, 0, math.radians(rot)), color=srgb("#2a1a14"))
    for k in range(n):
        t = (k - (n - 1) / 2) * 0.32
        B.prim("cube", (0.14, 0.12, 0.42), (x + t * c, y + t * sn, 0.72), color=srgb("#6a1418"))

def slaughter(level, path):
    B = Build("night"); S = 1.9
    if level == 1:
        house(B, [(0, 0), (1, 0)], roof_rot=90)
        vat(B, 0.5, -1.2, 0.45); hook_rack(B, 1.8, -0.2, 2, 90)
        B.add("town", "banner-red", (0, 0, 0), 0, team=True)
    elif level == 2:
        house(B, [(0, 0), (1, 0), (0, 1), (1, 1)])
        B.add("town", "chimney", (1, 1, 1.0), 0)
        vat(B, -0.9, -1.2, 0.5); vat(B, 0.6, -1.4, 0.4); hook_rack(B, 2.1, 0.3, 3, 90)
        for x in (-1, 0, 1, 2): B.add("town", "fence", (x, 2.0, 0), 90)
        B.add("town", "banner-red", (1, 0, 0), 0, team=True); B.add("grave", "lantern-candle", (0.0, -0.75, 0), glow=True)
    else:
        house(B, [(0, 0), (1, 0), (0, 1), (1, 1)], floors=2)
        B.add("town", "chimney", (1, 1, 2.0), 0)
        vat(B, -0.9, -1.4, 0.55); vat(B, 0.9, -1.6, 0.45)
        for x in (-2, -1): B.add("town", "fence", (x, 2.0, 0), 90)
        hook_rack(B, 2.2, 0.6, 3, 90); hook_rack(B, -1.0, -0.4, 3, 0)
        for p in ((1, 0), (1, 1)): B.add("town", "banner-red", (p[0], p[1], 1.0), 0, team=True)
        B.add("castle", "flag-banner-long", (0.5, -0.55, 0.0), 90, team=True, scale=1.0)
        brazier(B, 1.6, -0.8, 0.6); brazier(B, -0.4, -0.75, 0.6)
    return B.finish(path, scale=S)

def stables(level, path):
    B = Build("dawn"); S = 1.9; hay = lambda x, y, r=0: B.add("grave", "hay-bale", (x, y, 0), r)
    def trough(x, y): B.prim("cube", (0.8, 0.3, 0.22), (x, y, 0.11), color=srgb("#7a5230")); B.prim("cube", (0.7, 0.2, 0.03), (x, y, 0.21), color=srgb("#4a6a8a"))
    def stall_row(cells, floors=1):
        house(B, cells, wall="wall-wood", door="wall-wood-doorway-square-wide", window="wall-wood-doorway-square-wide", roof="roof-gable", floors=floors, team_roof=True, roof_rot=90)
    if level == 1:
        stall_row([(0, 0), (1, 0)]); hay(1.9, 0.3); trough(0.5, -1.0)
        for x in (-1, 0, 1, 2): B.add("town", "fence", (x, -1.5, 0), 270)
        B.add("town", "banner-green", (1, 0, 0), 0, team=True)
    elif level == 2:
        stall_row([(0, 0), (1, 0), (2, 0)]); hay(3.0, 0.4); hay(3.0, -0.1, 90); trough(0.0, -1.0); trough(2.0, -1.0)
        for x in (-1, 0, 1, 2, 3): B.add("town", "fence", (x, -1.8, 0), 270)
        for y in (-1, 0): B.add("town", "fence", (-1.5, y, 0), 180)
        B.add("town", "banner-green", (2, 0, 0), 0, team=True); B.add("grave", "lantern-candle", (1.0, -0.62, 0), glow=True)
    else:
        stall_row([(0, 0), (1, 0), (2, 0)], floors=2)
        house(B, [(-1.2, 0.0), (-1.2, 1.0)], wall="wall", door="wall-door", window="wall-window-glass", roof="roof-high", team_roof=True)
        windows(B, -1.2, 0.5, 0.55, 0.5, 1.0, faces="w", n=2)
        hay(3.1, 0.4); hay(3.1, -0.1, 90); B.add("grave", "hay-bale-bundled", (2.8, 1.2, 0)); trough(0.0, -1.0); trough(2.0, -1.0)
        for x in (-1, 0, 1, 2, 3): B.add("town", "fence", (x, -1.9, 0), 270)
        for p in ((0, 0), (2, 0)): B.add("town", "banner-green", (p[0], p[1], 1.0), 0, team=True)
        B.add("castle", "flag", (-1.2, 0.5, 2.1), team=True)
        for x in (0.5, 1.5): B.add("grave", "lantern-candle", (x, -0.62, 0), glow=True)
    return B.finish(path, scale=S)

def forge(level, path):
    B = Build("dawn"); S = 1.9; iron = srgb("#3a3c42")
    def anvil(x, y):
        B.prim("cube", (0.22, 0.22, 0.35), (x, y, 0.175), color=srgb("#4a3a2a"))
        B.prim("cube", (0.45, 0.18, 0.14), (x, y, 0.42), color=iron)
    def hearth(x, y, s=1.0):
        B.prim("cube", (0.8 * s, 0.6 * s, 0.45 * s), (x, y, 0.225 * s), color=srgb("#6a6460"))
        B.glowbox((0.6 * s, 0.4 * s, 0.06), (x, y, 0.46 * s))
        B.prim("cube", (0.35 * s, 0.35 * s, 1.6 * s), (x, y + 0.12 * s, 1.2 * s), color=srgb("#6a6460"))
        B.glowbox((0.2 * s, 0.2 * s, 0.25 * s), (x, y + 0.12 * s, 2.1 * s), kind="cone", segs=5)
    if level == 1:
        for x, y in ((-0.6, -0.5), (0.6, -0.5), (-0.6, 0.5), (0.6, 0.5)): B.add("town", "pillar-wood", (x, y, 0), scale=(1, 1, 1.1))
        B.prim("cube", (1.6, 1.4, 0.08), (0, 0, 1.14), mat="Team", rot=(math.radians(8), 0, 0))
        hearth(0, 0.3); anvil(0.1, -0.55); B.add("grave", "urn-square", (-0.85, -0.6, 0))
    elif level == 2:
        house(B, [(0, 0.3), (1, 0.3)], wall="wall", door="wall-doorway-square-wide", window="wall-window-small", roof="roof-gable", team_roof=True, roof_rot=90)
        windows(B, 0.5, 0.3, 0.55, 0.5, 1.0, faces="n", n=2)
        hearth(-1.0, -0.4); anvil(0.4, -0.9); anvil(1.2, -0.9)
        B.add("town", "stall", (1.9, -0.5, 0), 0); B.add("grave", "urn-square", (-1.2, 0.6, 0))
        B.add("town", "banner-green", (1, 0.3, 0), 0, team=True)
    else:
        house(B, [(0, 0.3), (1, 0.3), (0, 1.3), (1, 1.3)], wall="wall", door="wall-doorway-square-wide", window="wall-window-small", roof="roof-high", team_roof=True)
        windows(B, 0.5, 0.8, 0.55, 1.0, 1.0, faces="e", n=2)
        B.add("castle", "tower-square-base", (-1.2, 1.3, 0)); B.add("castle", "tower-square-mid", (-1.2, 1.3, 1.01))
        windows(B, -1.2, 1.3, 1.5, 0.475, 1.0, faces="sw"); B.add("castle", "tower-square-top-roof-rounded", (-1.2, 1.3, 2.02), team=True)
        hearth(-1.1, -0.4, 1.1); hearth(2.0, 1.0, 0.9); anvil(0.3, -0.9); anvil(1.1, -0.9)
        B.add("town", "stall-red", (2.1, -0.6, 0), 0); B.add("castle", "siege-ballista", (-1.6, -1.6, 0), 210, scale=0.6)
        for p in ((1, 0.3), (1, 1.3)): B.add("town", "banner-green", (p[0], p[1], 0), 0, team=True)
        B.add("castle", "flag", (-1.2, 1.3, 2.95), team=True)
    return B.finish(path, scale=S)

def silo(B, x, y, r, h, team_roof=True):
    B.prim("cyl", (2 * r, 2 * r, h), (x, y, h / 2), color=srgb("#e6dcc8"), segs=10)
    B.prim("cyl", (2 * r * 1.04, 2 * r * 1.04, 0.08), (x, y, h * 0.35), color=srgb("#8a6a40"), segs=10)
    B.prim("cyl", (2 * r * 1.04, 2 * r * 1.04, 0.08), (x, y, h * 0.7), color=srgb("#8a6a40"), segs=10)
    B.prim("cone", (2 * r * 1.15, 2 * r * 1.15, r * 1.3), (x, y, h + r * 0.65), mat="Team" if team_roof else "Body", segs=10)

def granary(level, path):
    B = Build("dawn"); S = 1.9
    sack = lambda x, y, z=0: B.prim("ico", (0.3, 0.24, 0.26), (x, y, z + 0.12), color=srgb("#c8b088"))
    if level == 1:
        silo(B, 0.4, 0.3, 0.55, 1.6); house(B, [(-0.8, 0.3)], wall="wall-wood", door="wall-wood-door", window="wall-wood", roof="roof-gable", team_roof=True)
        sack(0.0, -0.75); sack(0.35, -0.8); sack(0.18, -0.75, 0.2); B.add("grave", "hay-bale", (1.2, -0.6, 0))
    elif level == 2:
        silo(B, 0.6, 0.6, 0.6, 1.9); silo(B, 1.6, 0.6, 0.5, 1.5)
        house(B, [(-0.8, 0.4), (-0.8, -0.6)], wall="wall-wood", door="wall-wood-door", window="wall-wood-window-glass", roof="roof-gable", team_roof=True)
        windows(B, -0.8, -0.1, 0.55, 0.5, 1.0, faces="w", n=2)
        for k, x in enumerate((0.4, 0.75, 1.1)): sack(x, -0.8)
        B.add("town", "cart", (1.4, -0.9, 0), 80, scale=0.8); B.add("town", "banner-green", (-0.8, 0.4, 0), 0, team=True)
    else:
        silo(B, 0.4, 0.9, 0.65, 2.3); silo(B, 1.6, 0.9, 0.55, 1.9); silo(B, 1.6, -0.3, 0.45, 1.5)
        house(B, [(-1.0, 0.9), (-1.0, -0.1)], wall="wall-wood", door="wall-wood-door", window="wall-wood-window-glass", roof="roof-high", floors=2, team_roof=True)
        windows(B, -1.0, 0.4, 0.55, 0.5, 1.0, faces="w", n=2); windows(B, -1.0, 0.4, 1.55, 0.5, 1.0, faces="w", n=2)
        for x in (0.0, 0.35, 0.7): sack(x, -0.8); 
        sack(0.18, -0.8, 0.2); sack(0.52, -0.8, 0.2)
        B.add("town", "cart", (0.3, -1.6, 0), 0, scale=0.85); B.add("grave", "hay-bale-bundled", (2.4, -1.2, 0))
        B.add("castle", "flag", (0.4, 0.9, 2.3 + 0.85), team=True); B.add("grave", "lantern-candle", (-0.4, -0.8, 0), glow=True)
    return B.finish(path, scale=S)

for l in (1, 2, 3):
    for nm, fn in (("wolfden", wolfden), ("altar", altar), ("slaughter", slaughter), ("stables", stables), ("forge", forge), ("granary", granary)):
        JOBS[f"{nm}_l{l}"] = (lambda fn=fn, nm=nm, l=l: fn(l, f"{OUT}/buildings/{nm}_l{l}.glb"))

if __name__ == "__main__":
    ks = sys.argv[sys.argv.index("--") + 1:]
    if ks == ["all"]: ks = list(JOBS)
    for k in ks:
        try: JOBS[k]()
        except Exception as e:
            import traceback; traceback.print_exc(); print("FAILED", k, e)
    json.dump(sorted(USED), open(f"/tmp/used_{os.getpid()}.json", "w"))
