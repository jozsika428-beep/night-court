import sys, math, json, os
sys.path.insert(0, "/workspace/tools3d/lib")
from lib3d import *
from mathutils import Vector, Quaternion, Matrix

CAND = "/workspace/tools3d/cand"
OUT = "/workspace/game/art3d"

def srgb(h, a=1.0):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (lin[0], lin[1], lin[2], a)

TEAM = {"night": srgb("#b3122e"), "dawn": srgb("#e0b030")}
WHITE = (1, 1, 1, 1)

def materials(faction):
    return {
        "Body": make_material("Body", rough=0.85),
        "Team": make_material("Team", color=TEAM[faction], rough=0.7),
        "Metal": make_material("Metal", rough=0.35, metal=0.85),
        "Glow": make_material("Glow", rough=0.5, emit=(1, 1, 1, 1), emit_strength=0.0),
    }

def fix_glow(m, color, strength=4.0):
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Emission Color"].default_value = color; b.inputs["Emission Strength"].default_value = strength

MAT_ORDER = ["Body", "Team", "Metal", "Glow"]

class Rig:
    def __init__(self, src, faction, colors, team_mats=(), bone_protect=(), base_height=1.8, glow_mats={}, ground_clip=None):
        reset()
        objs = import_glb(src)
        self.arm, ms = normalize_rig(objs)
        bpy.ops.object.select_all(action="DESELECT")
        for m in ms: m.select_set(True)
        bpy.context.view_layer.objects.active = ms[0]
        if len(ms) > 1: bpy.ops.object.join()
        self.body = bpy.context.view_layer.objects.active
        for o in list(bpy.data.objects):
            if o not in (self.arm, self.body): bpy.data.objects.remove(o, do_unlink=True)
        self.base_scale = rescale_rig(self.arm, [self.body], base_height)
        mn, mx = rest_bbox([self.body])
        if ground_clip:
            act = next(a for a in bpy.data.actions if ground_clip in a.name)
            ad = self.arm.animation_data or self.arm.animation_data_create()
            prev = ad.action; ad.action = act
            bpy.context.scene.frame_set(int(act.frame_range[0])); bpy.context.view_layer.update()
            mn, _ = bbox([self.body]); ad.action = prev
            bpy.context.scene.frame_set(0)
        if abs(mn.z) > 0.005:
            self.arm.location = (0, 0, -mn.z); bpy.context.view_layer.update()
            bpy.ops.object.select_all(action="DESELECT"); self.arm.select_set(True); self.body.select_set(True)
            bpy.context.view_layer.objects.active = self.arm
            bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
        self.faction = faction
        self.mats = materials(faction)
        # colours per source material
        def rc(name, c):
            if name in colors: return colors[name]
            return c
        bake_to_vcol(self.body, rc)
        me = self.body.data
        slotnames = [sl.material.name if sl.material else "" for sl in self.body.material_slots]
        target = [("Team" if slotnames[p.material_index] in team_mats else glow_mats.get(slotnames[p.material_index], "Body")) for p in me.polygons]
        me.materials.clear()
        for n in MAT_ORDER: me.materials.append(self.mats[n])
        for p, t in zip(me.polygons, target): p.material_index = MAT_ORDER.index(t)
        set_corner_color(self.body, lambda p: p.material_index == 1, WHITE)

    def _order_mats(self):
        me = self.body.data
        cur = [m.name for m in me.materials]
        want = [n for n in MAT_ORDER]
        for n in want:
            if n not in cur: me.materials.append(self.mats[n])
        cur = [m.name for m in me.materials]
        remap = [want.index(n) for n in cur]
        idx = [p.material_index for p in me.polygons]
        me.materials.clear()
        for n in want: me.materials.append(self.mats[n])
        for p, i in zip(me.polygons, idx): p.material_index = remap[i]

    def bonepos(self, b, tail=False):
        bb = self.arm.data.bones[b]; return (bb.tail_local if tail else bb.head_local).copy()

    def part(self, o, bone, mat="Body", color=(0.5, 0.5, 0.5, 1), weights=None, keep=False):
        """join helper object o into body, skinned 100% to bone (or weights dict bone->w)."""
        if "Col" not in o.data.color_attributes:
            o.data.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        if not keep:
            for d in o.data.color_attributes["Col"].data: d.color = WHITE if mat == "Team" else color
        if weights is None: weights = {bone: 1.0}
        for bn, w in weights.items():
            vg = o.vertex_groups.new(name=bn); vg.add(list(range(len(o.data.vertices))), w, "REPLACE")
        if keep:
            names = [m.name.split(".")[0] if m else "Body" for m in o.data.materials]
            idx = [MAT_ORDER.index(names[p.material_index]) if names[p.material_index] in MAT_ORDER else 0 for p in o.data.polygons]
        o.data.materials.clear()
        for n in MAT_ORDER: o.data.materials.append(self.mats[n])
        mi = MAT_ORDER.index(mat)
        for i, p in enumerate(o.data.polygons): p.material_index = idx[i] if keep else mi
        for vg in list(o.vertex_groups):
            if vg.name not in weights: o.vertex_groups.remove(vg)
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True); self.body.select_set(True)
        bpy.context.view_layer.objects.active = self.body
        bpy.ops.object.join()
        return self.body

    def scale_verts(self, groups, sx, sy, sz, center=None, thresh=0.5):
        """scale vertices dominated by vertex groups around their centroid / given centre (rest pose)."""
        me = self.body.data; ids = [self.body.vertex_groups[g].index for g in groups if g in self.body.vertex_groups]
        sel = [v for v in me.vertices if sum(g.weight for g in v.groups if g.group in ids) >= thresh]
        if not sel: return
        c = center or sum((v.co for v in sel), Vector()) / len(sel)
        for v in sel:
            d = v.co - c; v.co = c + Vector((d.x * sx, d.y * sy, d.z * sz))

    def offset_bone_rotation(self, bone, axis, deg):
        """add constant local rotation to a bone in every action (e.g. hunch)."""
        q_off = Quaternion(axis, math.radians(deg))
        for a in bpy.data.actions:
            fcs = {fc.array_index: fc for fc in a.fcurves if fc.data_path == f'pose.bones["{bone}"].rotation_quaternion'}
            if len(fcs) != 4:
                # create constant curves
                for i in range(4):
                    if i not in fcs:
                        fcs[i] = a.fcurves.new(f'pose.bones["{bone}"].rotation_quaternion', index=i, action_group=bone)
                        fcs[i].keyframe_points.insert(a.frame_range[0], 1.0 if i == 0 else 0.0)
            frames = sorted({round(k.co[0], 3) for fc in fcs.values() for k in fc.keyframe_points})
            vals = {f: Quaternion([fcs[i].evaluate(f) for i in range(4)]) for f in frames}
            for i in range(4):
                fcs[i].keyframe_points.clear()
            for f in frames:
                q = vals[f] @ q_off
                for i in range(4): fcs[i].keyframe_points.insert(f, q[i], options={"FAST"})
            for fc in fcs.values(): fc.update()

    def finish(self, key, height_factor, clips, tri_budget, max_bones=30, path=None, protect=()):
        # bone reduction, scale, decimate body only portions? decimate whole body mesh
        nb = reduce_bones(self.arm, [self.body], max_bones, protect)
        f = height_factor
        if abs(f - 1) > 1e-4:
            self.arm.scale = (f, f, f); bpy.context.view_layer.update()
            bpy.ops.object.select_all(action="DESELECT"); self.arm.select_set(True); self.body.select_set(True)
            bpy.context.view_layer.objects.active = self.arm
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            scale_actions_location(f)
        t = decimate(self.body, tri_budget)
        limit_weights(self.body, 4)
        # drop unused material slots
        self.body.data.materials  # keep order; exporter skips unused
        names = set_clips(self.arm, clips)
        for o in list(bpy.data.objects):
            if o not in (self.arm, self.body): bpy.data.objects.remove(o, do_unlink=True)
        self.body.name = key; self.arm.name = key + "_rig"
        path = path or f"{OUT}/units/{key}.glb"
        size = export_glb(path, [self.arm, self.body])
        mn, mx = rest_bbox([self.body])
        info = dict(file=os.path.relpath(path, OUT), tris=t, bones=nb, clips=names, height=round(mx.z - mn.z, 2), bytes=size)
        print("BUILT", json.dumps(info))
        return info

    # ---------- landmarks / helpers ----------
    def group_verts(self, groups, thresh=0.5):
        me = self.body.data; ids = [self.body.vertex_groups[g].index for g in groups if g in self.body.vertex_groups]
        return [v for v in me.vertices if sum(g.weight for g in v.groups if g.group in ids) >= thresh]

    def group_bounds(self, groups, thresh=0.3):
        vs = self.group_verts(groups, thresh)
        if not vs: return None
        mn = Vector((min(v.co.x for v in vs), min(v.co.y for v in vs), min(v.co.z for v in vs)))
        mx = Vector((max(v.co.x for v in vs), max(v.co.y for v in vs), max(v.co.z for v in vs)))
        return mn, mx

    def part_w(self, o, wfn, mat="Body", color=(0.5, 0.5, 0.5, 1)):
        """join with per-vertex weights: wfn(world_co)->{bone:w}"""
        if "Col" not in o.data.color_attributes:
            o.data.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        for d in o.data.color_attributes["Col"].data: d.color = WHITE if mat == "Team" else color
        groups = {}
        for v in o.data.vertices:
            for bn, w in wfn(v.co).items():
                if bn not in groups: groups[bn] = o.vertex_groups.new(name=bn)
                groups[bn].add([v.index], w, "REPLACE")
        o.data.materials.clear()
        for n in MAT_ORDER: o.data.materials.append(self.mats[n])
        mi = MAT_ORDER.index(mat)
        for p in o.data.polygons: p.material_index = mi
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True); self.body.select_set(True)
        bpy.context.view_layer.objects.active = self.body
        bpy.ops.object.join()

    def recolor_group(self, groups, color, thresh=0.5, mat=None):
        ids = [self.body.vertex_groups[g].index for g in groups if g in self.body.vertex_groups]
        me = self.body.data; col = me.color_attributes["Col"]
        vset = {v.index for v in me.vertices if sum(g.weight for g in v.groups if g.group in ids) >= thresh}
        for p in me.polygons:
            if all(me.loops[l].vertex_index in vset for l in p.loop_indices):
                if mat: p.material_index = MAT_ORDER.index(mat)
                for l in p.loop_indices: col.data[l].color = WHITE if mat == "Team" else color

    def delete_group(self, groups, thresh=0.5):
        import bmesh
        ids = [self.body.vertex_groups[g].index for g in groups if g in self.body.vertex_groups]
        me = self.body.data
        vset = {v.index for v in me.vertices if sum(g.weight for g in v.groups if g.group in ids) >= thresh}
        bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in vset], context="VERTS"); bm.to_mesh(me); bm.free()
