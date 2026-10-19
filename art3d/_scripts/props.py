import sys, math, random
sys.path.insert(0, "/workspace/tools3d/lib")
from build import *
P = f"{OUT}/props"; os.makedirs(P, exist_ok=True)

def simple(name, items, scale):
    B = Build("neutral", "fords")
    for kit, piece, loc, rot, sc in items: B.add(kit, piece, loc, rot, sc)
    return B.finish(f"{P}/{name}.glb", scale=scale, budget=500)

def dead_tree(name, seed):
    random.seed(seed); B = Build("neutral", "fords")
    bark = srgb("#3a3430"); dark = srgb("#2a2522")
    B.prim("cone", (0.5, 0.5, 4.2), (0, 0, 2.1), color=bark, segs=6).data  # trunk (cone, r2 0)
    B.prim("cyl", (0.62, 0.62, 0.35), (0, 0, 0.17), color=dark, segs=6)
    for i in range(6):
        z = 1.6 + i * 0.45; a = random.uniform(0, 6.28) + i * 2.1; L = 1.6 - i * 0.18; tilt = random.uniform(0.7, 1.1)
        cx, cy = math.cos(a) * L * 0.45 * math.sin(tilt), math.sin(a) * L * 0.45 * math.sin(tilt)
        B.prim("cone", (0.16, 0.16, L), (cx, cy, z + L * 0.45 * math.cos(tilt)), rot=(tilt * math.cos(a + 1.5708) * -1, tilt * math.sin(a + 1.5708) * -1, 0)
               if False else (0, tilt, a), color=bark, segs=4)
    for a in (0.5, 2.6, 4.4):
        B.prim("cone", (0.22, 0.22, 0.9), (math.cos(a) * 0.38, math.sin(a) * 0.38, 0.12), rot=(0, 1.35, a), color=dark, segs=4)
    return B.finish(f"{P}/{name}.glb", scale=1.0, budget=500)

def reeds(name, seed):
    random.seed(seed); B = Build("neutral", "fords")
    for i in range(16):
        r = random.uniform(0, 0.55); a = random.uniform(0, 6.28); x, y = math.cos(a) * r, math.sin(a) * r
        h = random.uniform(0.8, 1.5); lean = random.uniform(-0.18, 0.18)
        col = srgb(random.choice(["#4b5a2c", "#3e4d27", "#5d6233", "#6b6438"]))
        B.prim("cone", (0.05, 0.05, h), (x, y, h / 2), rot=(lean, random.uniform(-0.15, 0.15), a), color=col, segs=3)
        if i % 4 == 0: B.prim("cyl", (0.045, 0.045, 0.16), (x + lean * 0.0, y, h * 0.8), rot=(lean, 0, 0), color=srgb("#3b2618"), segs=4)
    return B.finish(f"{P}/{name}.glb", scale=1.0, budget=500)

N = "nature"
JOBS = {
 "pine_a": lambda: simple("pine_a", [(N, "tree_pineTallA_detailed", (0, 0, 0), 0, 1)], 4.6),
 "pine_b": lambda: simple("pine_b", [(N, "tree_pineDefaultA", (0, 0, 0), 30, 1)], 4.0),
 "oak": lambda: simple("oak", [(N, "tree_oak_dark", (0, 0, 0), 0, 1)], 4.4),
 "dead_tree": lambda: dead_tree("dead_tree", 3),
 "rock_large": lambda: simple("rock_large", [(N, "rock_largeA", (0, 0, 0), 0, 1)], 3.0),
 "rocks_small": lambda: simple("rocks_small", [(N, "rock_smallA", (0, 0, 0), 0, 1), (N, "rock_smallC", (0.25, 0.15, 0), 70, 1), (N, "rock_smallFlatA", (-0.2, 0.2, 0), 20, 1)], 3.0),
 "rock_tall": lambda: simple("rock_tall", [(N, "rock_tallA", (0, 0, 0), 0, 1)], 3.0),
 "reeds": lambda: reeds("reeds", 7),
 "stump": lambda: simple("stump", [(N, "stump_oldTall", (0, 0, 0), 0, 1)], 3.0),
}
if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:]
    for k in (JOBS if args == ["all"] else args): JOBS[k]()
    json.dump(sorted(USED), open(f"/tmp/used_props.json", "w"))
