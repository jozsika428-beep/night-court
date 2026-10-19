"""bbox/height audit straight from glTF JSON+buffers (bind pose for skinned meshes; node animations sampled)."""
import json, struct, glob, os, sys
import numpy as np
ROOT = "/workspace/game/art3d"
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
def quat_m(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
def trs(n, t=None, r=None, s=None):
    if "matrix" in n: return np.array(n["matrix"]).reshape(4, 4).T
    M = np.eye(4); R = quat_m(r if r is not None else n.get("rotation", [0, 0, 0, 1])); S = np.diag(s if s is not None else n.get("scale", [1, 1, 1]))
    M[:3, :3] = R @ S; M[:3, 3] = t if t is not None else n.get("translation", [0, 0, 0]); return M
def load(f):
    b = open(f, "rb").read(); cl, _ = struct.unpack("<II", b[12:20]); j = json.loads(b[20:20 + cl])
    off = 20 + cl; bl, _ = struct.unpack("<II", b[off:off + 8]); bin_ = b[off + 8: off + 8 + bl]
    def acc(i):
        a = j["accessors"][i]; bv = j["bufferViews"][a["bufferView"]]; n = NC[a["type"]]; dt = CT[a["componentType"]]
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0); stride = bv.get("byteStride", 0) or n * np.dtype(dt).itemsize
        raw = np.frombuffer(bin_, dtype=np.uint8, count=stride * (a["count"] - 1) + n * np.dtype(dt).itemsize, offset=start)
        out = np.lib.stride_tricks.as_strided(raw.view(dt) if stride % np.dtype(dt).itemsize == 0 else raw, shape=(a["count"], n), strides=(stride, np.dtype(dt).itemsize))
        return np.array(out, dtype=np.float64)
    return j, acc
def audit(f):
    j, acc = load(f); nodes = j["nodes"]
    parent = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}
    # animated node TRS samples
    samples = {}  # node -> list of dicts
    for an in j.get("animations", []):
        for ch in an["channels"]:
            t = ch["target"]; 
            if "node" not in t: continue
            s = an["samplers"][ch["sampler"]]; vals = acc(s["output"])
            samples.setdefault(t["node"], {}).setdefault(t["path"], []).extend(list(vals))
    def world_clip(i, clip):
        # node world matrix at first key of named animation (falls back to rest TRS)
        n = nodes[i]; vals = {}
        for an in j.get("animations", []):
            if an["name"] != clip: continue
            for ch in an["channels"]:
                if ch["target"].get("node") == i: vals[ch["target"]["path"]] = acc(an["samplers"][ch["sampler"]]["output"])[0]
        M = trs(n, vals.get("translation"), vals.get("rotation"), vals.get("scale"))
        return (world_clip(parent[i], clip) if i in parent else np.eye(4)) @ M
    def world(i, pick):
        n = nodes[i]; sm = samples.get(i, {})
        M = trs(n, *(sm[p][pick % len(sm[p])] if p in sm else None for p in ("translation", "rotation", "scale")))
        return (world(parent[i], pick) if i in parent else np.eye(4)) @ M
    pts = []; bind = []; ext = []; tris = 0; skinned = False
    for i, n in enumerate(nodes):
        if "mesh" not in n: continue
        skin = "skin" in n; skinned |= skin
        P = np.vstack([acc(p["attributes"]["POSITION"]) for p in j["meshes"][n["mesh"]]["primitives"]])
        for p in j["meshes"][n["mesh"]]["primitives"]:
            tris += (j["accessors"][p["indices"]]["count"] if "indices" in p else len(P)) // 3
        chain = [i]; k = i
        while k in parent: k = parent[k]; chain.append(k)
        nsamp = max([len(v) for c in chain for v in samples.get(c, {}).values()] or [1])
        picks = range(0, nsamp, max(1, nsamp // 64)) if nsamp > 1 else [0]
        for pk in picks:
            M = np.eye(4) if skin else world(i, pk)
            Q = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]
            if not skin: ext.append(Q.min(0)); ext.append(Q.max(0))
            else: bind.append(Q.min(0)); bind.append(Q.max(0))
        if not skin:
            hasidle = any(a["name"] == "Idle" for a in j.get("animations", []))
            M = world_clip(i, "Idle") if hasidle else world(i, 0)
            Q = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]; pts.append(Q.min(0)); pts.append(Q.max(0))
            sw = [nodes[c].get("name") for c in chain if c in samples and "rotation" in samples[c]]
        if skin:
            sk = j["skins"][n["skin"]]; IB = acc(sk["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
            JM = np.array([world_clip(jt, "Idle") for jt in sk["joints"]]) @ IB
            for p in j["meshes"][n["mesh"]]["primitives"]:
                Pp = np.c_[acc(p["attributes"]["POSITION"]), np.ones(j["accessors"][p["attributes"]["POSITION"]]["count"])]
                J = acc(p["attributes"]["JOINTS_0"]).astype(int); W = acc(p["attributes"]["WEIGHTS_0"])
                if W.max() > 1.5: W = W / 255.0
                out = np.zeros((len(Pp), 4))
                for c in range(4): out += W[:, c:c+1] * np.einsum("nij,nj->ni", JM[J[:, c]], Pp)
                pts.append(out[:, :3].min(0)); pts.append(out[:, :3].max(0))
    pts = np.array(pts); mn = pts.min(0); mx = pts.max(0)
    E = np.array(ext) if ext else np.array(pts); emn = E.min(0); emx = E.max(0)
    anim_ext = dict(w=round(float(emx[0]-emn[0]), 2), h=round(float(emx[1]-emn[1]), 2), d=round(float(emx[2]-emn[2]), 2))
    bh = round(float(np.array(bind)[:, 1].max() - np.array(bind)[:, 1].min()), 2) if bind else None
    return dict(tris=tris, bind_height=bh, anim_extent=anim_ext, width_x=round(float(mx[0]-mn[0]), 2), height=round(float(mx[1]-mn[1]), 2), depth_z=round(float(mx[2]-mn[2]), 2), min_y=round(float(mn[1]), 3),
                center_xz=[round(float(mx[0]+mn[0])/2, 2), round(float(mx[2]+mn[2])/2, 2)], skinned=skinned,
                bones=max([len(s["joints"]) for s in j.get("skins", [])] or [0]), anims={a["name"]: round(float(max(acc(s["input"]).max() for s in a["samplers"])), 2) for a in j.get("animations", [])},
                mats=[m["name"] for m in j.get("materials", [])], bytes=os.path.getsize(f))
if __name__ == "__main__":
    res = {os.path.relpath(f, ROOT): audit(f) for f in sorted(glob.glob(f"{ROOT}/*/*.glb"))}
    json.dump(res, open("/tmp/audit.json", "w"), indent=1)
    for k, v in res.items(): print(f"{k:32s} tris {v['tris']:5d} h {v['height']:6.2f} (bind {v['bind_height']}) ext {v['anim_extent']} w {v['width_x']:5.2f} d {v['depth_z']:5.2f} miny {v['min_y']:6.2f} c {v['center_xz']} b {v['bones']} {v['anims']}")
