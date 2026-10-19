import json, math, numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
ART="/workspace/game/art"; SRC=f"{ART}/_src"; M=[]
def save(im, rel, **meta):
    im.save(f"{ART}/{rel}", optimize=True); M.append(dict(file=rel, width=im.width, height=im.height, **meta))

# ---------- portraits ----------
P = {"night_vael":525, "night_grimfang":612, "night_gravecaller":562, "night_banshee_queen":637,
     "dawn_ashen":375, "dawn_iron_inquisitor":625, "dawn_sun_priestess":637}
import os; os.makedirs(f"{ART}/portraits", exist_ok=True)
for name, cx in P.items():
    im = Image.open(f"{SRC}/p_{name.split('_',1)[1]}.jpg").convert("RGB")
    s = im.height; x0 = max(0, min(im.width - s, cx - s//2))
    save(im.crop((x0, 0, x0+s, s)).resize((512,512), Image.LANCZOS), f"portraits/{name}.png",
         kind="hero_portrait", faction=name.split("_")[0], notes="square, opaque painted background; frame/mask in UI")

# ---------- seamless terrain tiles ----------
os.makedirs(f"{ART}/terrain", exist_ok=True)
def seamless(im):
    a = np.asarray(im).astype(np.float32); h, w, _ = a.shape
    b = np.roll(np.roll(a, h//2, 0), w//2, 1)
    wy = np.sin(np.linspace(0, math.pi, h))[:,None]; wx = np.sin(np.linspace(0, math.pi, w))[None,:]
    wgt = (wy*wx)[...,None]**0.6
    return Image.fromarray((a*wgt + b*(1-wgt)).clip(0,255).astype(np.uint8))
for t in ["water","ford","grass","mud"]:
    im = Image.open(f"{SRC}/t_{t}.jpg").convert("RGB"); s = im.height; x0 = (im.width - s)//2
    tile = seamless(im.crop((x0, 0, x0+s, s)).resize((512,512), Image.LANCZOS))
    save(tile.resize((256,256), Image.LANCZOS), f"terrain/tile_{t}_256.png", kind="terrain_tile", tileable=True, notes="seamless repeat; Blackwater Fords")
    save(tile.resize((128,128), Image.LANCZOS), f"terrain/tile_{t}.png", kind="terrain_tile", tileable=True, notes="seamless repeat 128px; Blackwater Fords")

# ---------- UI icons (drawn at 256, downsampled to 64) ----------
os.makedirs(f"{ART}/ui", exist_ok=True)
S=256
def canvas(): return Image.new("RGBA",(S,S),(0,0,0,0))
def finish(im, outline=(12,8,10)):
    a = im.getchannel("A"); ring = a.filter(ImageFilter.MaxFilter(13))
    base = Image.new("RGBA",(S,S),outline+(0,)); base.putalpha(ring)
    sh = Image.new("RGBA",(S,S),(0,0,0,0)); sh.putalpha(ring.filter(ImageFilter.GaussianBlur(6)).point(lambda v:int(v*0.6)))
    out = Image.new("RGBA",(S,S)); out.alpha_composite(sh,(4,6)); out.alpha_composite(base); out.alpha_composite(im)
    return out.resize((64,64), Image.LANCZOS)
def grad_fill(mask, top, bot, hl=None):
    g = Image.new("RGBA",(S,S))
    arr = np.zeros((S,S,4),np.uint8)
    t = np.linspace(0,1,S)[:,None]
    for i in range(3): arr[...,i] = (top[i]*(1-t)+bot[i]*t).astype(np.uint8)
    arr[...,3]=255; g = Image.fromarray(arr,"RGBA"); g.putalpha(mask); return g
def poly_mask(pts): m=Image.new("L",(S,S),0); ImageDraw.Draw(m).polygon(pts,fill=255); return m
def ell_mask(b): m=Image.new("L",(S,S),0); ImageDraw.Draw(m).ellipse(b,fill=255); return m

def blood():
    pts=[]
    for k in range(200):
        t=k/200*2*math.pi; x=math.sin(t); y=-math.cos(t)
        r = 1.0
        px = 128 + 78*x*(0.55+0.45*(y+1)/2)**0.9 * (1 if y>-0.2 else (1+y*0.9 if y<-0.2 else 1))
        pts.append((px, 0))
    # simpler: teardrop = circle + triangle
    m = ell_mask((52,96,204,248)); ImageDraw.Draw(m).polygon([(128,14),(58,150),(198,150)],fill=255)
    im = canvas(); im.alpha_composite(grad_fill(m,(225,40,50),(110,0,12)))
    d=ImageDraw.Draw(im); d.ellipse((82,150,118,200),fill=(255,170,170,170)); d.ellipse((96,120,112,140),fill=(255,200,200,140))
    return finish(im)
def gold():
    im=canvas(); d=ImageDraw.Draw(im)
    for i,(cx,cy) in enumerate([(92,170),(164,176),(128,120)]):
        for k in range(3):
            y=cy-k*16; d.ellipse((cx-56,y-24,cx+56,y+24),fill=(150,100,20,255)); d.ellipse((cx-56,y-30,cx+56,y+18),fill=(240,190,60,255))
            d.ellipse((cx-40,y-22,cx+40,y+10),outline=(170,120,25,255),width=5)
    d.ellipse((108,70,130,84),fill=(255,250,210,220))
    return finish(im)
def shield_pts(cx=128,cy=128,w=170,h=200):
    pts=[(cx-w/2,cy-h/2),(cx+w/2,cy-h/2)]
    for k in range(31):
        t=k/30; pts.append((cx+w/2*(1-t)**0.6*math.cos(t*math.pi/2) if False else cx+w/2*math.cos(t*math.pi/2), cy-h/2+40+ (h-40)*math.sin(t*math.pi/2)))
    pts += [(cx-x+cx- cx*1 + cx - cx, y) for (x,y) in []]
    right = pts[2:]; left=[(2*cx-x,y) for (x,y) in reversed(right)]
    return pts[:2]+right+left
def silver_armor():
    im=canvas(); m=poly_mask(shield_pts()); im.alpha_composite(grad_fill(m,(245,248,255),(120,130,150)))
    d=ImageDraw.Draw(im); d.line([(128,40),(128,222)],fill=(90,100,120,255),width=8)
    d.polygon([(60,46),(110,46),(70,130)],fill=(255,255,255,120))
    d.ellipse((104,104,152,152),fill=(240,195,70,255),outline=(150,105,20,255),width=5)
    return finish(im)
def fangs():
    im=canvas(); d=ImageDraw.Draw(im)
    d.chord((26,40,230,170),0,180,fill=(150,15,30,255)); d.rectangle((26,40,230,105),fill=(150,15,30,255))
    d.rounded_rectangle((26,30,230,80),20,fill=(110,8,20,255))
    for x0 in (52,152):
        m=poly_mask([(x0,70),(x0+52,70),(x0+26,232)]); im.alpha_composite(grad_fill(m,(255,252,240),(205,195,170)))
        d.line([(x0+12,80),(x0+24,200)],fill=(255,255,255,200),width=5)
    for x in (110,128,146): d.polygon([(x-9,72),(x+9,72),(x,112)],fill=(240,232,210,255))
    return finish(im)
def faster_recruit():
    im=canvas(); d=ImageDraw.Draw(im)
    for i,y in enumerate((70,120,170)): d.rounded_rectangle((12,y,90-i*14,y+14),7,fill=(240,200,90,200))
    m=poly_mask([(100,30),(220,30),(166,128),(220,226),(100,226),(154,128)]); im.alpha_composite(grad_fill(m,(200,225,255),(110,140,190)))
    d=ImageDraw.Draw(im); d.polygon([(118,48),(202,48),(160,118)],fill=(220,60,60,255)); d.polygon([(160,150),(206,210),(114,210)],fill=(220,60,60,255))
    d.rectangle((90,18,230,40),fill=(120,80,40,255)); d.rectangle((90,216,230,238),fill=(120,80,40,255))
    return finish(im)
def bone_armor():
    im=canvas(); m=poly_mask(shield_pts()); im.alpha_composite(grad_fill(m,(70,20,25),(25,8,10)))
    d=ImageDraw.Draw(im)
    for y in (70,110,150,190):
        w=70-max(0,y-150)*0.9; d.rounded_rectangle((128-w,y-10,128+w,y+10),10,fill=(235,225,200,255),outline=(140,120,90,255),width=4)
    d.rounded_rectangle((120,40,136,215),8,fill=(215,205,180,255))
    return finish(im)
def silver_weapons():
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(118,170),(138,170),(138,240),(118,240)],fill=(110,70,35,255))
    d.rectangle((84,160,172,176),fill=(200,160,60,255))
    m=poly_mask([(128,14),(150,60),(146,162),(110,162),(106,60)]); im.alpha_composite(grad_fill(m,(255,255,255),(150,165,190)))
    d=ImageDraw.Draw(im); d.line([(128,30),(128,155)],fill=(120,135,160,255),width=4)
    for (x,y,r) in [(170,50,16),(190,90,9),(80,70,10)]:
        d.polygon([(x,y-r*2),(x+r/2,y-r/2),(x+r*2,y),(x+r/2,y+r/2),(x,y+r*2),(x-r/2,y+r/2),(x-r*2,y),(x-r/2,y-r/2)],fill=(235,245,255,255))
    return finish(im)
FONT="/usr/share/fonts/truetype/sand-box/google/Cinzel/Cinzel-VariableFont_wght.ttf"
def badge(n):
    cols={1:((215,140,80),(110,55,20)),2:((240,245,255),(120,130,150)),3:((255,225,110),(170,110,15))}[n]
    im=canvas(); m=poly_mask(shield_pts(w=200,h=226)); im.alpha_composite(grad_fill(m,*cols))
    inner=poly_mask(shield_pts(w=160,h=184)); im.alpha_composite(grad_fill(inner,(40,30,35),(15,10,12)))
    d=ImageDraw.Draw(im)
    try: f=ImageFont.truetype(FONT,120); f.set_variation_by_axes([900])
    except Exception: f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",120)
    txt=["I","II","III"][n-1]
    bb=d.textbbox((0,0),txt,font=f); tw=bb[2]-bb[0]
    if tw>140: f=f.font_variant(size=int(120*140/tw)) ; bb=d.textbbox((0,0),txt,font=f); tw=bb[2]-bb[0]
    d.text((128-tw/2-bb[0],128-(bb[3]-bb[1])/2-bb[1]-6),txt,font=f,fill=cols[0]+(255,),stroke_width=3,stroke_fill=(0,0,0,255))
    for k in range(n): x=128+(k-(n-1)/2)*30; d.polygon([(x-10,24),(x+10,24),(x,6)],fill=cols[0]+(255,))
    return finish(im)
ICONS = {"res_blood":(blood,"resource: Blood (Night Court)"),"res_gold":(gold,"resource: Gold (Dawn Order)"),
 "upg_silver_armor":(silver_armor,"upgrade: silver armor"),"upg_fangs":(fangs,"upgrade: sharper fangs"),
 "upg_faster_recruit":(faster_recruit,"upgrade: faster recruitment"),"upg_bone_armor":(bone_armor,"upgrade: bone armor"),
 "upg_silver_weapons":(silver_weapons,"upgrade: silver-tipped weapons")}
for name,(fn,desc) in ICONS.items(): save(fn(), f"ui/{name}.png", kind="ui_icon", notes=desc)
for n in (1,2,3): save(badge(n), f"ui/badge_level_{n}.png", kind="ui_badge", level=n, notes="overlay at top-right of a building/unit (bronze I, silver II, gold III)")
# team rings
for side,col in {"night":(200,25,40),"dawn":(240,195,70)}.items():
    big=Image.new("RGBA",(256,128),(0,0,0,0)); d=ImageDraw.Draw(big)
    d.ellipse((8,8,248,120),fill=col+(60,),outline=col+(235,),width=12)
    save(big.resize((64,32),Image.LANCZOS), f"ui/team_ring_{side}.png", kind="ui_overlay", faction=side, anchor="centre", notes="draw under a unit at its feet anchor for ownership/selection")
json.dump(M, open(f"{ART}/tools/_other.json","w"), indent=1); print(len(M))
