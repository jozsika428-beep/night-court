import sys; sys.path.insert(0, "/workspace/tools3d/lib")
from render import *
args = sys.argv[sys.argv.index("--") + 1:]
outdir = args[0]; clip = args[1]; files = args[2:]
for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    render_glb(f, os.path.join(outdir, f"{name}_{clip}.png"), clip=None if clip == "none" else clip, res=320, samples=16)
