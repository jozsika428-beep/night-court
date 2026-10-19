import bpy, bmesh, math, mathutils, os, json
from mathutils import Vector, Matrix, Quaternion, Euler

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def scale_actions_location(factor, actions=None):
    for a in (actions or bpy.data.actions):
        for fc in a.fcurves:
            if fc.data_path.endswith("location"):
                for k in fc.keyframe_points:
                    k.co[1] *= factor; k.handle_left[1] *= factor; k.handle_right[1] *= factor

def normalize_rig(objs, keep_meshes=None):
    """Return (armature, [meshes]) with clean transforms: armature at origin, scale 1, meshes parented to it."""
    arm = next(o for o in objs if o.type == "ARMATURE")
    meshes = [o for o in objs if o.type == "MESH" and (o.find_armature() == arm or (keep_meshes and o.name in keep_meshes))]
    for o in objs:
        if o not in meshes and o is not arm:
            bpy.data.objects.remove(o, do_unlink=True)
    # world scale of armature
    mw = arm.matrix_world.copy()
    s = mw.to_scale()[0]
    for m in meshes:
        wm = m.matrix_world.copy(); m.parent = arm; m.matrix_world = wm
    arm.parent = None
    arm.matrix_world = mw
    bpy.context.view_layer.update()
    # apply transforms on armature and meshes
    bpy.ops.object.select_all(action="DESELECT")
    for o in [arm] + meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    scale_actions_location(s)
    return arm, meshes

def bbox(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        if o.type != "MESH": continue
        e = o.evaluated_get(dg); m = e.to_mesh()
        pts += [e.matrix_world @ v.co for v in m.vertices]
        e.to_mesh_clear()
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

def rest_bbox(meshes):
    pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

def rescale_rig(arm, meshes, height):
    mn, mx = rest_bbox(meshes)
    f = height / (mx.z - mn.z)
    arm.scale = (f, f, f)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    for o in [arm] + meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    scale_actions_location(f)
    return f

def tris(objs):
    dg = bpy.context.evaluated_depsgraph_get(); n = 0
    for o in objs:
        if o.type == "MESH":
            m = o.evaluated_get(dg).to_mesh(); m.calc_loop_triangles(); n += len(m.loop_triangles)
    return n

def mat_color(mat):
    if mat and mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                inp = n.inputs["Base Color"]
                if inp.is_linked:
                    return None
                return tuple(inp.default_value)
    if mat: return tuple(mat.diffuse_color)
    return (0.8, 0.8, 0.8, 1)

def bake_to_vcol(obj, recolor=None):
    """Write material colour (or sampled texture colour) into a 'Col' corner attribute. recolor(matname, rgba)->rgba"""
    me = obj.data
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    col = me.color_attributes["Col"]
    uv = me.uv_layers.active
    texcache = {}
    for poly in me.polygons:
        mat = obj.material_slots[poly.material_index].material if obj.material_slots else None
        c = mat_color(mat)
        for li in poly.loop_indices:
            cc = c
            if cc is None:
                img = tex_of(mat)
                if img is not None and uv is not None:
                    if img.name not in texcache:
                        texcache[img.name] = (img.size[0], img.size[1], list(img.pixels))
                    w, h, px = texcache[img.name]
                    # sample at polygon centre UV for flat atlas swatches
                    u = sum(uv.data[l].uv.x for l in poly.loop_indices) / poly.loop_total
                    v = sum(uv.data[l].uv.y for l in poly.loop_indices) / poly.loop_total
                    x = int((u % 1) * (w - 1)); y = int((v % 1) * (h - 1)); i = (y * w + x) * 4
                    cc = tuple(px[i:i + 4])
                else:
                    cc = (0.8, 0.8, 0.8, 1)
            if recolor: cc = recolor(mat.name if mat else "", cc)
            col.data[li].color = cc
    return col

def tex_of(mat):
    if not (mat and mat.use_nodes): return None
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image: return n.image
    return None

def make_material(name, color=(1, 1, 1, 1), vcol=True, rough=0.8, metal=0.0, emit=None, emit_strength=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if vcol:
        a = nt.nodes.new("ShaderNodeVertexColor"); a.layer_name = "Col"
        if color[:3] != (1, 1, 1):
            mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"
            mul.inputs["Factor"].default_value = 1.0
            nt.links.new(a.outputs["Color"], mul.inputs[6]); mul.inputs[7].default_value = color
            nt.links.new(mul.outputs[2], b.inputs["Base Color"])
        else:
            nt.links.new(a.outputs["Color"], b.inputs["Base Color"])
    if emit:
        b.inputs["Emission Color"].default_value = emit
        b.inputs["Emission Strength"].default_value = emit_strength
    nt.links.new(b.outputs[0], out.inputs[0])
    return m

def set_corner_color(obj, poly_filter, color):
    col = obj.data.color_attributes["Col"]
    for p in obj.data.polygons:
        if poly_filter(p):
            for li in p.loop_indices: col.data[li].color = color

def remap_materials(obj, mapping):
    """mapping: old material name -> new material (bpy Material); unmapped -> mapping['*']"""
    me = obj.data
    newmats = []
    for slot in obj.material_slots:
        nm = mapping.get(slot.material.name if slot.material else "", mapping.get("*"))
        newmats.append(nm)
    uniq = []
    for m in newmats:
        if m not in uniq: uniq.append(m)
    idx = [uniq.index(m) for m in newmats]
    for p in me.polygons: p.material_index = idx[p.material_index]
    me.materials.clear()
    for m in uniq: me.materials.append(m)

def decimate(obj, target_tris):
    t = tris([obj])
    if t <= target_tris: return t
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("dec", "DECIMATE"); mod.ratio = target_tris / t
    mod.use_collapse_triangulate = True
    # move to first
    while obj.modifiers[0] != mod: bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return tris([obj])

def reduce_bones(arm, meshes, max_bones=30, protect=()):
    """Remove leaf bones (merging weights into parent) until <= max_bones. Unweighted bones go first."""
    def weight_count(bname):
        n = 0
        for m in meshes:
            vg = m.vertex_groups.get(bname)
            if vg:
                gi = vg.index
                n += sum(1 for v in m.data.vertices for g in v.groups if g.group == gi and g.weight > 0.01)
        return n
    while len(arm.data.bones) > max_bones:
        leaves = [b for b in arm.data.bones if not b.children and b.parent and b.name not in protect]
        leaves.sort(key=lambda b: (weight_count(b.name), b.length))
        victim = leaves[0].name; parent = leaves[0].parent.name
        for m in meshes:
            vg = m.vertex_groups.get(victim)
            if vg:
                pg = m.vertex_groups.get(parent) or m.vertex_groups.new(name=parent)
                for v in m.data.vertices:
                    for g in v.groups:
                        if g.group == vg.index and g.weight > 0:
                            pg.add([v.index], g.weight, "ADD")
                m.vertex_groups.remove(vg)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode="EDIT")
        eb = arm.data.edit_bones[victim]; arm.data.edit_bones.remove(eb)
        bpy.ops.object.mode_set(mode="OBJECT")
        for a in bpy.data.actions:
            for fc in list(a.fcurves):
                if f'pose.bones["{victim}"]' in fc.data_path: a.fcurves.remove(fc)
    return len(arm.data.bones)

def limit_weights(obj, n=4):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True)
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=n)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")

def set_clips(arm, mapping, loop=("Idle", "Walk", "Run")):
    """mapping: ClipName -> source action name (substring match). Creates NLA tracks named ClipName."""
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = None
    for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
    made = {}
    for clip, src in mapping.items():
        act = src if isinstance(src, bpy.types.Action) else next((a for a in bpy.data.actions if src in a.name), None)
        if act is None: print("WARN missing", clip, src); continue
        new = act.copy(); new.name = clip; new.use_fake_user = True
        tr = ad.nla_tracks.new(); tr.name = clip
        st = tr.strips.new(clip, int(new.frame_range[0]), new)
        made[clip] = new
    for a in list(bpy.data.actions):
        if a.name not in made: bpy.data.actions.remove(a)
    return list(made)

def ensure_vcol_all(objs):
    for o in objs:
        if o.type == "MESH" and "Col" not in o.data.color_attributes:
            bake_to_vcol(o)

def add_part(target, verts_world_obj, bone=None, mat_index=0, color=None):
    """Join a helper mesh object into target (skinned mesh). Weight fully to bone."""
    o = verts_world_obj
    if "Col" not in o.data.color_attributes:
        o.data.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    if color:
        for d in o.data.color_attributes["Col"].data: d.color = color
    if bone:
        vg = o.vertex_groups.new(name=bone); vg.add(list(range(len(o.data.vertices))), 1.0, "REPLACE")
    o.data.materials.clear()
    for m in target.data.materials: o.data.materials.append(m)
    for p in o.data.polygons: p.material_index = mat_index
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True); target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()

def prim(kind, size=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0), segs=8, name="part", **kw):
    if kind == "cube": bpy.ops.mesh.primitive_cube_add(size=1)
    elif kind == "cyl": bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=0.5, depth=1, **kw)
    elif kind == "cone": bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=0.5, radius2=kw.get("r2", 0), depth=1)
    elif kind == "sphere": bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=max(3, segs // 2), radius=0.5)
    elif kind == "ico": bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5)
    o = bpy.context.active_object; o.name = name
    o.scale = size; o.rotation_euler = rot; o.location = loc
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o

def bone_matrix(arm, bname):
    """Armature-space rest matrix of a bone (world, armature has identity transform)."""
    return arm.matrix_world @ arm.data.bones[bname].matrix_local

def export_glb(path, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
        export_apply=False, export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
        export_frame_step=2, export_optimize_animation_size=True, export_def_bones=True, export_all_influences=False,
        export_vertex_color="ACTIVE", export_normals=True, export_texcoords=False, export_materials="EXPORT",
        export_image_format="AUTO", export_skins=True, export_morph=False, export_lights=False, export_cameras=False)
    return os.path.getsize(path)
