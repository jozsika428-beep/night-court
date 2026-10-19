import bpy, sys, glob, os, json, mathutils
root = "/workspace/game/art3d"; res = {}
for f in sorted(glob.glob(f"{root}/*/*.glb")):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try: bpy.ops.import_scene.gltf(filepath=f)
    except Exception as e: res[os.path.relpath(f, root)] = dict(error=str(e)); continue
    tris = 0; mats = set(); bones = 0; maxw = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.data.objects:
        if o.type == "MESH":
            m = o.evaluated_get(dg).to_mesh(); m.calc_loop_triangles(); tris += len(m.loop_triangles)
            mats |= {s.material.name for s in o.material_slots if s.material}
            for v in o.data.vertices: maxw = max(maxw, sum(1 for g in v.groups if g.weight > 0))
        if o.type == "ARMATURE": bones += len(o.data.bones)
    pts = [o.matrix_world @ mathutils.Vector(c) for o in bpy.data.objects if o.type == "MESH" for c in o.bound_box]
    mn = [min(p[i] for p in pts) for i in range(3)]; mx = [max(p[i] for p in pts) for i in range(3)]
    res[os.path.relpath(f, root)] = dict(tris=tris, bones=bones, maxw=maxw, mats=sorted(mats), imgs=len(bpy.data.images),
        size=[round(mx[0]-mn[0],2), round(mx[1]-mn[1],2), round(mx[2]-mn[2],2)], minz=round(mn[2],3), cx=round((mx[0]+mn[0])/2,2), cy=round((mx[1]+mn[1])/2,2),
        clips={a.name: round((a.frame_range[1]-a.frame_range[0])/24,2) for a in bpy.data.actions}, bytes=os.path.getsize(f))
json.dump(res, open("/tmp/inspect.json", "w"), indent=1)
