import sys; sys.path.insert(0, "/workspace/tools3d/lib")
from build import *
C = srgb

def ring(B, n, style, gate=True, h_tower="hex"):
    """square wall ring of (2n+1) cells, corner towers, gate at front (-Y)."""
    for i in range(-n + 1, n):
        # front (-Y) and back (+Y) rows: walls along X -> rot 90
        if gate and i == 0: B.add("castle", "wall-doorway", (0.25, -n, 0), 90); B.add("castle", "wall-doorway", (-0.25, -n, 0), -90)
        else: B.add("castle", "wall", (i, -n, 0), 90)
        B.add("castle", "wall", (i, n, 0), 90)
        B.add("castle", "wall", (-n, i, 0), 0); B.add("castle", "wall", (n, i, 0), 0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            if h_tower == "hex":
                B.add("castle", "tower-hexagon-base", (sx * n, sy * n, 0)); B.add("castle", "tower-hexagon-mid", (sx * n, sy * n, 1.31))
                if style == "night": B.add("castle", "tower-square-roof", (sx * n, sy * n, 1.77), scale=(0.9, 0.9, 0.8))
                else: B.add("castle", "tower-hexagon-roof", (sx * n, sy * n, 1.77), team=True)
            else:
                B.add("castle", "wall-corner", (sx * n, sy * n, 0))

def keep_tower(B, loc, mids, style, s=1.0, door=True):
    x, y = loc; z = 0
    B.add("castle", "tower-square-base", (x, y, z), scale=s); z += 1.01 * s
    for k in range(mids):
        B.add("castle", "tower-square-mid-door" if (k == 0 and door) else "tower-square-mid-windows", (x, y, z), scale=s); z += 1.01 * s
    if style == "night":
        B.add("castle", "tower-square-top", (x, y, z), scale=s); z += 0.3 * s
        B.add("castle", "tower-square-roof", (x, y, z), scale=(s * 0.9, s * 0.9, s * 1.2))
        z += 2.0 * s * 1.2
    else:
        B.add("castle", "tower-square-top-roof-rounded", (x, y, z), scale=s, team=True); z += 0.95 * s
    return z

def flag(B, loc, z, s=1.0, long=False):
    B.add("castle", "flag-banner-long" if long else "flag", (loc[0], loc[1], z), scale=s, team=True)

def fortress(style, level, path):
    B = Build(style)
    if level == 1:
        top = keep_tower(B, (0, 0), 1, style, 1.2)
        for sx in (-1, 1): B.add("castle", "wall-half", (sx * 1.25, 0, 0), 0)
        flag(B, (0, 0), top - (2.0 if style == "night" else 0), 1.3)
        if style == "night":
            for sx in (-1, 1): B.add("grave", "pillar-obelisk", (sx * 1.0, -1.0, 0), scale=1.2); B.add("grave", "candle-multiple", (sx * 0.6, -1.1, 0), glow=True)
    elif level == 2:
        ring(B, 2, style, h_tower="corner")
        top = keep_tower(B, (0, 0.3), 2, style, 1.15)
        flag(B, (0, 0.3), top - (2.4 if style == "night" else 0), 1.4)
        for sx in (-1, 1): flag(B, (sx * 2, -2), 1.31, 1.0)
    else:
        ring(B, 2, style, h_tower="hex")
        top = keep_tower(B, (0, 0.3), 3, style, 1.2)
        for sx in (-1, 1): keep_tower(B, (sx * 1.0, 0.9), 1, style, 0.7, door=False)
        flag(B, (0, 0.3), top - (2.5 if style == "night" else 0), 1.5)
        for sx in (-1, 1):
            B.add("castle", "flag-banner-long", (sx * 0.5, -2.05, 0.2), rot=90, team=True)
            for sy in (-1, 1): flag(B, (sx * 2, sy * 2), 2.6 if style == "night" else 2.6, 0.8)
        if style == "night":
            for sx in (-1, 1): B.add("grave", "pillar-obelisk", (sx * 0.9, -2.7, 0), scale=1.0); B.add("grave", "fire-basket", (sx * 0.5, -2.6, 0), glow=True)
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
            B.add("grave", "fire-basket", (sx * 0.35, -1.45, 0), glow=True)
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
        house(B, [(1.6, 1.6), (2.6, 1.6)], roof_rot=90)
        B.add("town", "chimney", (-1, 1, 2.0), 0)
        for y in (-2, -1): B.add("town", "fence", (2.4, y, 0), 0)
        for x in (1, 2): B.add("town", "fence", (x, -2.5, 0), 270)
        vat(1.5, -1.2, 0.6); vat(-1.6, -1.6, 0.45)
        B.add("town", "cart", (-2.2, 0.6, 0), 80); B.add("grave", "hay-bale-bundled", (2.9, 0.4, 0))
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
    return B.finish(path, scale=S, keep_separate=(sails,))

def tower(style, level, path):
    B = Build(style); s = 1.0; z = 0
    B.add("castle", "tower-square-base", (0, 0, 0)); z = 1.01
    for k in range(level):
        B.add("castle", "tower-square-mid-windows" if k else "tower-square-mid-door", (0, 0, z)); z += 1.01
    if style == "neutral":
        B.add("castle", "tower-hexagon-top-wood", (0, 0, z), scale=1.1)
    elif style == "night":
        B.add("castle", "tower-square-top", (0, 0, z)); B.add("castle", "tower-square-roof", (0, 0, z + 0.3), scale=(0.9, 0.9, 1.1))
        if level >= 2: B.add("grave", "pillar-obelisk", (0.8, -0.8, 0))
        if level == 3: B.add("castle", "flag-banner-long", (0, -0.52, 0.8), 90, team=True); B.add("grave", "fire-basket", (-0.8, -0.8, 0), glow=True)
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

if __name__ == "__main__":
    ks = sys.argv[sys.argv.index("--") + 1:]
    if ks == ["all"]: ks = list(JOBS)
    for k in ks:
        try: JOBS[k]()
        except Exception as e:
            import traceback; traceback.print_exc(); print("FAILED", k, e)
    json.dump(sorted(USED), open(f"/tmp/used_{os.getpid()}.json", "w"))
