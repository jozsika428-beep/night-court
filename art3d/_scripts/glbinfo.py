import json, struct, glob, os, sys
root = "/workspace/game/art3d"; out = {}
for f in sorted(glob.glob(f"{root}/*/*.glb")):
    b = open(f, "rb").read(); magic, ver, ln = struct.unpack("<III", b[:12]); assert magic == 0x46546C67 and ver == 2
    cl, ct = struct.unpack("<II", b[12:20]); j = json.loads(b[20:20 + cl])
    tris = 0
    for m in j["meshes"]:
        for p in m["primitives"]:
            tris += (j["accessors"][p["indices"]]["count"] if "indices" in p else j["accessors"][p["attributes"]["POSITION"]]["count"]) // 3
    mins = [1e9]*3; maxs = [-1e9]*3
    for m in j["meshes"]:
        for p in m["primitives"]:
            a = j["accessors"][p["attributes"]["POSITION"]]
            mins = [min(x, y) for x, y in zip(mins, a["min"])]; maxs = [max(x, y) for x, y in zip(maxs, a["max"])]
    out[os.path.relpath(f, root)] = dict(tris=tris, bones=max([len(s["joints"]) for s in j.get("skins", [])] or [0]),
        anims=[a["name"] for a in j.get("animations", [])], mats=[m["name"] for m in j.get("materials", [])],
        images=len(j.get("images", [])), ext=j.get("extensionsUsed", []), mesh_min=[round(x, 2) for x in mins], mesh_max=[round(x, 2) for x in maxs],
        weights4=all(len([k for k in p["attributes"] if k.startswith("JOINTS_")]) <= 1 for m in j["meshes"] for p in m["primitives"]), bytes=len(b))
json.dump(out, open("/tmp/glbinfo.json", "w"), indent=1)
for k, v in out.items(): print(k, v["tris"], v["bones"], v["anims"], v["mats"], v["images"], v["ext"], v["mesh_min"], v["mesh_max"], v["weights4"])
