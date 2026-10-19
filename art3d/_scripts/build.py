import sys, colorsys, math, os, json
sys.path.insert(0, "/workspace/tools3d/lib")
from lib3d import *
from units import srgb, TEAM, MAT_ORDER, materials, fix_glow, WHITE
SRC = "/workspace/tools3d/src"
KIT = {"castle": f"{SRC}/kenney_castle-kit/Models/GLB format", "grave": f"{SRC}/kenney_graveyard-kit_5.0/Models/GLB format",
       "town": f"{SRC}/kenney_fantasy-town-kit_2.0/Models/GLB format", "nature": f"{SRC}/kenney_nature-kit/Models/GLTF format"}
OUT = "/workspace/game/art3d"
USED = set()

def lin2s(x): return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
def s2lin(x): return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4

def tone(style):
    def f(_, c):
        r, g, b = (lin2s(max(0, min(1, v))) for v in c[:3])
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        if style == "night":
            if 0.95 < h or h < 0.03:     # reds stay rich
                s = min(1, s * 1.1); v *= 0.75
            elif 0.2 < h < 0.45:         # greens -> dead olive
                s *= 0.35; v *= 0.45; h = 0.18
            elif 0.5 < h < 0.75:         # blues -> cold dark slate
                s *= 0.3; v *= 0.3
            elif 0.03 <= h < 0.15 and s > 0.25:  # woods -> dark red-brown
                h = 0.02; s *= 0.8; v *= 0.45
            else:
                h = 0.78; s = 0.10; v = 0.06 + v * 0.30   # stone -> near-black violet grey
            v = max(0.04, v)
        elif style == "dawn":
            if 0.2 < h < 0.45: s *= 0.7; v *= 0.85
            elif 0.03 <= h < 0.15 and s > 0.25: v = min(1, v * 1.05)
            else:
                s *= 0.5; v = min(1, 0.25 + v * 0.85)
        elif style == "fords":
            if 0.15 < h < 0.62 and s > 0.15: h = 0.25 + (h - 0.3) * 0.15; s = min(0.6, s * 0.9); v *= 0.36   # dark wet greens
            elif 0.03 <= h < 0.15 and s > 0.2: s *= 0.6; v *= 0.55        # bark
            else: s *= 0.25; v *= 0.62                                   # cold stone
        elif style == "neutral":
            if 0.2 < h < 0.45: s *= 0.55; v *= 0.7
            else: s *= 0.55; v *= 0.8
        r, g, b = colorsys.hsv_to_rgb(h, s, v)
        return (s2lin(r), s2lin(g), s2lin(b), 1)
    return f

GLOWCOL = {"night": (1.0, 0.2, 0.05, 1), "dawn": (1.0, 0.68, 0.28, 1), "neutral": (1.0, 0.55, 0.2, 1), "fords": (1.0, 0.55, 0.2, 1)}

def sweep_points(o):
    """world-space bbox points of an object spinning about its local Y axis through its origin."""
    M = o.matrix_world; piv = M.translation; ax = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    r = 0; ys = []
    for v in o.data.vertices:
        w = M @ v.co; d = w - piv; a = d.dot(ax); r = max(r, (d - ax * a).length); ys.append(a)
    u = ax.orthogonal().normalized(); w2 = ax.cross(u).normalized(); pts = []
    for a in (min(ys), max(ys)):
        for k in range(16):
            t = k / 16 * 2 * math.pi; pts.append(piv + ax * a + (u * math.cos(t) + w2 * math.sin(t)) * r)
    return pts

def full_bbox(objs, sweeps=()):
    mn, mx = bbox([o for o in objs if o not in sweeps] or objs)
    for o in sweeps:
        for p in sweep_points(o):
            mn = Vector((min(mn.x, p.x), min(mn.y, p.y), min(mn.z, p.z))); mx = Vector((max(mx.x, p.x), max(mx.y, p.y), max(mx.z, p.z)))
    return mn, mx

class Build:
    def __init__(self, faction, style=None, glow=None):
        reset()
        self.faction = faction; self.style = style or faction
        self.mats = materials(faction if faction in TEAM else "night")
        self.glow = glow or GLOWCOL.get(self.style, GLOWCOL["neutral"])
        fix_glow(self.mats["Glow"], self.glow, 5.0)
        if faction == "neutral":
            b = next(n for n in self.mats["Team"].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        self.objs = []; self.anim = []

    def add(self, kit, piece, loc=(0, 0, 0), rot=0, scale=1.0, team=False, glow=None, metal=False, tint=None, sx=None):
        path = f"{KIT[kit]}/{piece}.glb"; USED.add((kit, piece))
        objs = import_glb(path)
        ms = [o for o in objs if o.type == "MESH"]
        for o in objs:
            if o.type != "MESH": pass
        res = []
        for o in ms:
            wm = o.matrix_world.copy(); o.parent = None; o.matrix_world = wm
            bake_to_vcol(o, (lambda n, c: tint) if tint else tone(self.style))
            mi = 1 if team else (3 if glow else (2 if metal else 0))
            o.data.materials.clear()
            for n in MAT_ORDER: o.data.materials.append(self.mats[n])
            for p in o.data.polygons: p.material_index = mi
            if team:
                for d in o.data.color_attributes["Col"].data: d.color = WHITE
            res.append(o)
        for o in objs:
            if o.type != "MESH": bpy.data.objects.remove(o, do_unlink=True)
        if len(res) > 1:
            bpy.ops.object.select_all(action="DESELECT")
            for o in res: o.select_set(True)
            bpy.context.view_layer.objects.active = res[0]; bpy.ops.object.join(); res = [res[0]]
        o = res[0]
        s = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
        o.matrix_world = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(math.radians(rot), 4, "Z") @ Matrix.Diagonal((*s, 1)) @ o.matrix_world
        self.objs.append(o)
        return o

    def prim(self, kind, size, loc, rot=(0, 0, 0), mat="Body", color=(0.5, 0.5, 0.5, 1), segs=8):
        o = prim(kind, size, loc, rot, segs)
        o.data.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        for d in o.data.color_attributes["Col"].data: d.color = WHITE if mat == "Team" else color
        o.data.materials.clear()
        for n in MAT_ORDER: o.data.materials.append(self.mats[n])
        for p in o.data.polygons: p.material_index = MAT_ORDER.index(mat)
        self.objs.append(o); return o

    def glowbox(self, size, loc, rot=(0, 0, 0), kind="cube", segs=6):
        return self.prim(kind, size, loc, rot, mat="Glow", color=self.glow, segs=segs)

    def finish(self, path, scale=1.0, keep_separate=(), budget=4900, sweeps=(), fit=7.9):
        # apply transforms, join all static into one mesh, scale, centre footprint on origin
        bpy.ops.object.select_all(action="DESELECT")
        stat = [o for o in self.objs if o not in keep_separate]
        for o in stat: o.select_set(True)
        bpy.context.view_layer.objects.active = stat[0]
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.join(); m = bpy.context.view_layer.objects.active
        m.name = os.path.splitext(os.path.basename(path))[0]
        for o in [m] + list(keep_separate):
            o.matrix_world = Matrix.Diagonal((scale, scale, scale, 1)) @ o.matrix_world
        bpy.ops.object.select_all(action="DESELECT"); m.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        # merge doubles lightly & clean
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=0.0005); bpy.ops.object.mode_set(mode="OBJECT")
        allm = [m] + list(keep_separate)
        if tris(allm) > budget:
            bpy.context.view_layer.objects.active = m
            mod = m.modifiers.new("pl", "DECIMATE"); mod.decimate_type = "DISSOLVE"; mod.angle_limit = math.radians(2); mod.delimit = {"MATERIAL", "SHARP"}
            bpy.ops.object.modifier_apply(modifier=mod.name)
            mod = m.modifiers.new("tr", "TRIANGULATE"); bpy.ops.object.modifier_apply(modifier=mod.name)
            extra = tris(allm) - tris([m])
            if tris(allm) > budget:
                print("WARN_COLLAPSE", path, tris(allm)); decimate(m, budget - extra)
        mn, mx = full_bbox(allm, sweeps)
        fp = max(mx.x - mn.x, mx.y - mn.y)
        k = fit / fp if fp > fit else 1.0
        c = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
        for o in allm:
            o.matrix_world = Matrix.Diagonal((k, k, k, 1)) @ Matrix.Translation(-c) @ o.matrix_world
        for a in list(bpy.data.actions):
            if a.name != "Idle": bpy.data.actions.remove(a)
        for o in allm:
            if o.animation_data and not o.animation_data.action and not o.animation_data.nla_tracks: o.animation_data_clear()
        bpy.context.view_layer.update()
        mn, mx = full_bbox(allm, sweeps)
        t = tris(allm)
        exp = allm
        for o in list(bpy.data.objects):
            if o not in exp: bpy.data.objects.remove(o, do_unlink=True)
        size = export_glb(path, exp)
        info = dict(file=os.path.relpath(path, OUT), tris=t, footprint=[round(mx.x - mn.x, 2), round(mx.y - mn.y, 2)], height=round(mx.z - mn.z, 2), bytes=size,
                    clips=[a.name for a in bpy.data.actions])
        print("BUILT", json.dumps(info))
        return info
