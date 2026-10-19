"""Cut generated chroma-key sheets into transparent, trimmed, anchored sprites."""
import json, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi

ART = "/workspace/game/art"; SRC = f"{ART}/_src"
MANIFEST = []

def key(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    border = np.concatenate([a[:8].reshape(-1,3), a[-8:].reshape(-1,3), a[:, :8].reshape(-1,3), a[:, -8:].reshape(-1,3)])
    bg = np.median(border, 0)
    r, g, b = a[...,0], a[...,1], a[...,2]
    if bg[1] > bg[0] and bg[1] > bg[2]:          # green screen
        cs = g - np.maximum(r, b); bgc = bg[1] - max(bg[0], bg[2]); mode = "g"
    else:                                         # magenta screen
        cs = np.minimum(r, b) - g; bgc = min(bg[0], bg[2]) - bg[1]; mode = "m"
    lo, hi = 0.38*bgc, 0.70*bgc
    alpha = 1 - np.clip((cs - lo)/(hi - lo), 0, 1)
    # remove specks / keep meaningful blobs, fill holes-free
    solid = alpha > 0.5
    lab, n = ndi.label(solid)
    if n:
        sizes = ndi.sum(solid, lab, range(1, n+1))
        keep = np.isin(lab, 1 + np.where(sizes >= 150)[0])
        near = ndi.binary_dilation(keep, iterations=3)
        alpha = alpha * near
    # despill near edges
    edge = ndi.binary_dilation(alpha < 0.98, iterations=3) & (alpha > 0)
    out = a.copy()
    if mode == "g":
        lim = np.maximum(r, b) * 1.02
        out[...,1] = np.where(edge, np.minimum(g, lim), g)
        # pure-hue green spill anywhere (smoke, glows over the screen); yellow-green grass (hue<~100deg) is untouched
        mx = np.maximum(r, b); den = np.maximum(g - np.minimum(r, b), 1)
        hue = 60*(2 + (b - r)/den)
        spill = (g > mx + 12) & (hue > 104) & (hue < 140) & (alpha > 0)
        out[...,1] = np.where(spill, mx + 4, out[...,1])
    else:
        m = g * 1.02 + 6
        out[...,0] = np.where(edge, np.minimum(r, np.maximum(m, b*0 + np.minimum(r, m))), r)
        out[...,2] = np.where(edge, np.minimum(b, m), b)
    rgba = np.dstack([out, alpha*255]).clip(0,255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")

def split(rgba, n):
    al = np.asarray(rgba)[...,3] > 128
    occ = al.sum(0).astype(float)
    W = len(occ)
    cols = np.where(occ > 1)[0]
    x0, x1 = cols.min(), cols.max()+1
    empty = occ <= 1
    gaps = []  # interior gaps (start,end)
    i = x0
    while i < x1:
        if empty[i]:
            j = i
            while j < x1 and empty[j]: j += 1
            gaps.append((i, j)); i = j
        else: i += 1
    gaps.sort(key=lambda g: g[1]-g[0], reverse=True)
    cuts = sorted([(g[0]+g[1])//2 for g in gaps[:n-1] if g[1]-g[0] >= 4])
    sm = np.convolve(occ, np.ones(9)/9, "same")
    while len(cuts) < n-1:   # split widest segment at its occupancy minimum
        bounds = [x0] + cuts + [x1]
        segs = [(bounds[k+1]-bounds[k], bounds[k], bounds[k+1]) for k in range(len(bounds)-1)]
        _, s0, s1 = max(segs)
        m0, m1 = s0 + (s1-s0)//4, s1 - (s1-s0)//4
        cuts = sorted(cuts + [m0 + int(np.argmin(sm[m0:m1]))])
    bounds = [0] + cuts + [W]
    return [rgba.crop((bounds[k], 0, bounds[k+1], rgba.height)) for k in range(n)]

def trim(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    return im.crop(bb)

def fit(im, size, pad=0.04, bottom=0.04):
    """Fit into size x size canvas, horizontally centred, resting on bottom margin (feet/base anchor)."""
    S = size if isinstance(size, tuple) else (size, size)
    room = (S[0]*(1-2*pad), S[1]*(1-pad-bottom))
    sc = min(room[0]/im.width, room[1]/im.height)
    r = im.resize((max(1, round(im.width*sc)), max(1, round(im.height*sc))), Image.LANCZOS)
    c = Image.new("RGBA", S, (0,0,0,0))
    c.alpha_composite(r, ((S[0]-r.width)//2, S[1] - round(S[1]*bottom) - r.height))
    return c

TEAM = {"night": (150, 20, 30), "dawn": (235, 190, 70)}
def outline(im, side, strength=0.85):
    """1px faction-coloured outline so ownership reads at phone size."""
    a = np.asarray(im)[...,3] > 90
    ring = ndi.binary_dilation(a, iterations=1) & ~a
    o = Image.new("RGBA", im.size, (0,0,0,0)); arr = np.zeros((im.height, im.width, 4), np.uint8)
    arr[ring] = TEAM[side] + (int(255*strength),)
    o = Image.fromarray(arr, "RGBA"); o.alpha_composite(im); return o

def save(im, rel, **meta):
    p = f"{ART}/{rel}"; os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, optimize=True)
    MANIFEST.append(dict(file=rel, width=im.width, height=im.height, **meta))

UNIT_SHEETS = {
 "sheet_night_a": [("night","ghoul"),("night","vampire_thrall"),("night","werewolf"),("night","bone_archer")],
 "sheet_night_b": [("night","alpha_brute"),("night","blood_knight"),("night","bat_swarm"),("night","banshee")],
 "sheet_night_c": [("night","wraith_rider"),("night","gargoyle"),("night","flesh_abomination"),("night","bone_catapult")],
 "sheet_night_d": [("night","blood_cultist"),("hero:night","vael"),("hero:night","grimfang"),("hero:night","gravecaller")],
 "sheet_dawn_e":  [("dawn","crossbowman"),("dawn","torchbearer"),("dawn","silver_knight"),("dawn","priest")],
 "sheet_dawn_f":  [("dawn","witch_hunter"),("dawn","fire_ballista"),("hero:dawn","ashen"),("hero:dawn","iron_inquisitor")],
 "sheet_mixed_g": [("hero:dawn","sun_priestess"),("hero:night","banshee_queen")],
}
FLYERS = {"bat_swarm","gargoyle","banshee","wraith_rider","banshee_queen"}
for sheet, items in UNIT_SHEETS.items():
    parts = split(key(Image.open(f"{SRC}/{sheet}.jpg")), len(items))
    for (fac, name), part in zip(items, parts):
        t = trim(part)
        hero = fac.startswith("hero")
        side = fac.split(":")[-1]
        facing = "down-right (3/4 view); mirror horizontally for left" if side == "night" else "down-left (3/4 view); mirror horizontally for right"
        anchor = "bottom-centre (x=0.5, y=0.96): feet/base contact point"
        note = "hovering/flying: draw a soft shadow under it" if name in FLYERS else ""
        if hero:
            save(fit(t, 160), f"heroes/src/{side}_{name}_160.png", kind="hero_sprite_source", faction=side, facing=facing, anchor=anchor)
            save(outline(fit(t, 80), side), f"heroes/{side}_{name}.png", kind="hero_sprite", faction=side, facing=facing, anchor=anchor, outline="1px faction colour baked in", notes=("in-game size 80px (heroes read slightly larger than 64px units). " + note).strip())
        else:
            save(fit(t, 128), f"units/src/{side}_{name}_128.png", kind="unit_sprite_source", faction=side, facing=facing, anchor=anchor)
            save(outline(fit(t, 64), side), f"units/{side}_{name}.png", kind="unit_sprite", faction=side, facing=facing, anchor=anchor, outline="1px faction colour baked in", notes=("in-game size 64px. " + note).strip())

BUILDINGS = ["night_fortress","night_crypt","night_wolf_den","night_blood_altar","night_blood_farm","night_slaughterhouse","night_charnel_house","night_tower",
             "dawn_keep","dawn_barracks","dawn_stables","dawn_forge","dawn_chapel","dawn_mill","dawn_granary","dawn_tower"]
for b in BUILDINGS:
    parts = split(key(Image.open(f"{SRC}/b_{b}.jpg")), 3)
    for lv, part in enumerate(parts, 1):
        t = trim(part)
        save(fit(t, 512, pad=0.03, bottom=0.03), f"buildings/src/{b}_l{lv}_512.png", kind="building_source", faction=b.split("_")[0], level=lv)
        save(fit(t, 256, pad=0.03, bottom=0.03), f"buildings/{b}_l{lv}.png", kind="building", faction=b.split("_")[0], level=lv,
             anchor="bottom-centre (x=0.5, y=0.97): front tip of the isometric base", facing="isometric 3/4, entrance faces viewer",
             notes="each level is fitted to fill the 256 canvas; for visible growth draw L1 at ~80%, L2 ~90%, L3 100% scale")

NEUTRAL = ["neutral_village_plot","neutral_graveyard_plot","neutral_watchtower_ruin","neutral_shrine"]
for name, part in zip(NEUTRAL, split(key(Image.open(f"{SRC}/b_neutral.jpg")), 4)):
    t = trim(part)
    save(fit(t, 512, pad=0.03, bottom=0.03), f"buildings/src/{name}_512.png", kind="building_source", faction="neutral")
    save(fit(t, 256, pad=0.03, bottom=0.03), f"buildings/{name}.png", kind="outpost", faction="neutral",
         anchor="bottom-centre (x=0.5, y=0.97)", notes="unclaimed outpost; when captured swap to the owner's Blood Farm/Granary/Charnel House/Tower sprite or overlay a team flag")

PROPS = ["rocks_cluster","rock_flat","tree_pine","tree_oak","tree_dead","reeds"]
for name, part in zip(PROPS, split(key(Image.open(f"{SRC}/t_props.jpg")), 6)):
    t = trim(part)
    save(fit(t, 128), f"terrain/props/{name}.png", kind="prop", faction="neutral", anchor="bottom-centre (x=0.5, y=0.96)", notes="Blackwater Fords map prop")

json.dump(MANIFEST, open(f"{ART}/tools/_sprites.json", "w"), indent=1)
print(len(MANIFEST), "sprites")
