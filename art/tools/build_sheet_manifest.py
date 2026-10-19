import json, glob, os
from PIL import Image, ImageDraw, ImageFont
ART="/workspace/game/art"; os.chdir(ART)
items = json.load(open("tools/_sprites.json")) + json.load(open("tools/_other.json"))
for it in items: it["bytes"] = os.path.getsize(it["file"])
FB=ImageFont.truetype("/usr/share/fonts/truetype/sand-box/google/Cinzel/Cinzel-VariableFont_wght.ttf",34)
FS=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",13)
W=2560; rows=[]
def section(title, files, cell, cols=None, bg=None, tile=False):
    rows.append((title, files, cell, bg, tile))
U=lambda side: sorted(glob.glob(f"units/src/{side}_*_128.png"))
section("NIGHT COURT units (128px source; 64px in units/)", U("night"), 150, bg=(52,58,52))
section("DAWN ORDER units", U("dawn"), 150, bg=(52,58,52))
section("Heroes (160px source; 80px in heroes/)", sorted(glob.glob("heroes/src/night_*"))+sorted(glob.glob("heroes/src/dawn_*")), 180, bg=(52,58,52))
section("Hero portraits (512px)", sorted(glob.glob("portraits/night_*"))+sorted(glob.glob("portraits/dawn_*")), 300)
NB=sorted(set(f.rsplit("_l",1)[0] for f in glob.glob("buildings/night_*_l1.png")))
DB=sorted(set(f.rsplit("_l",1)[0] for f in glob.glob("buildings/dawn_*_l1.png")))
section("NIGHT COURT buildings, levels 1-3 (256px)", [f"{b}_l{l}.png" for b in NB for l in (1,2,3)], 205, bg=(52,58,52))
section("DAWN ORDER buildings, levels 1-3 (256px)", [f"{b}_l{l}.png" for b in DB for l in (1,2,3)], 205, bg=(52,58,52))
section("Neutral outposts + Blackwater Fords props", sorted(glob.glob("buildings/neutral_*.png"))+sorted(glob.glob("terrain/props/*.png")), 205, bg=(52,58,52))
section("Terrain tiles (shown 2x2 to prove seamless)", sorted(glob.glob("terrain/tile_*_256.png")), 260, tile=True)
section("UI icons 64px (shown 2x)", sorted(glob.glob("ui/*.png")), 150, bg=(40,40,48))
H=40+sum(70+((len(f)*c + W-81)//(W-80) )*(c+22) for _,f,c,_,_ in rows)+20
sheet=Image.new("RGBA",(W,H),(18,14,20,255)); d=ImageDraw.Draw(sheet)
d.text((40,8),"NIGHT COURT RTS - art pack v1 - concept / contact sheet",font=FB,fill=(230,210,200))
y=70
for title, files, cell, bg, tile in rows:
    d.text((40,y),title,font=FB,fill=(200,60,60) if "NIGHT" in title else (235,195,90) if "DAWN" in title else (180,190,210)); y+=52
    per=(W-80)//cell; x=40
    for i,f in enumerate(files):
        if i and i%per==0: y+=cell+22; x=40
        if bg: d.rectangle((x+2,y,x+cell-4,y+cell-4),fill=bg)
        im=Image.open(f).convert("RGBA")
        if tile:
            t=Image.new("RGBA",(im.width*2,im.height*2)); [t.paste(im,(a,b)) for a in (0,im.width) for b in (0,im.height)]; im=t
        if "ui/" in f: im=im.resize((im.width*2,im.height*2),Image.LANCZOS)
        sc=min((cell-10)/im.width,(cell-10)/im.height); im=im.resize((max(1,int(im.width*sc)),max(1,int(im.height*sc))),Image.LANCZOS)
        sheet.alpha_composite(im,(x+(cell-im.width)//2,y+(cell-4-im.height)//2))
        lab=os.path.basename(f).replace("_128.png","").replace("_160.png","").replace(".png","").replace("_256","")
        d.text((x+4,y+cell-2),lab[:int(cell/7.5)],font=FS,fill=(170,170,180)); x+=cell
    y+=cell+30
sheet=sheet.crop((0,0,W,y+10)).convert("RGB"); sheet.save("concept_sheet.png", optimize=True)
items.append(dict(file="concept_sheet.png",width=sheet.width,height=sheet.height,kind="contact_sheet",bytes=os.path.getsize("concept_sheet.png")))
ENGINE_UNIT_KEYS = {"ghoul":"night_ghoul","archer":"night_bone_archer","thrall":"night_vampire_thrall","werewolf":"night_werewolf","bat":"night_bat_swarm","catapult":"night_bone_catapult",
 "brute":"night_alpha_brute","bloodknight":"night_blood_knight","banshee":"night_banshee","wraith":"night_wraith_rider","gargoyle":"night_gargoyle","abomination":"night_flesh_abomination","cultist":"night_blood_cultist",
 "torch":"dawn_torchbearer","crossbow":"dawn_crossbowman","priest":"dawn_priest","knight":"dawn_silver_knight","ballista":"dawn_fire_ballista","witchhunter":"dawn_witch_hunter"}
HERO_KEYS = {"vael":"night_vael","grimfang":"night_grimfang","gravecaller":"night_gravecaller","bansheequeen":"night_banshee_queen","ashen":"dawn_ashen","inquisitor":"dawn_iron_inquisitor","sunpriestess":"dawn_sun_priestess"}
B_KEYS = {"fortress":"night_fortress","crypt":"night_crypt","wolfden":"night_wolf_den","altar":"night_blood_altar","bloodfarm":"night_blood_farm","slaughter":"night_slaughterhouse","charnel":"night_charnel_house","ntower":"night_tower",
 "keep":"dawn_keep","barracks":"dawn_barracks","stables":"dawn_stables","forge":"dawn_forge","chapel":"dawn_chapel","mill":"dawn_mill","granary":"dawn_granary","dtower":"dawn_tower"}
sprites = {k: f"units/{v}.png" for k,v in ENGINE_UNIT_KEYS.items()}
sprites.update({k: f"heroes/{v}.png" for k,v in HERO_KEYS.items()})
sprites.update({"village":"buildings/neutral_village_plot.png","graveyard":"buildings/neutral_graveyard_plot.png","shrine":"buildings/neutral_shrine.png","ruin":"buildings/neutral_watchtower_ruin.png"})
sprites.update({f"prop_{os.path.basename(f)[:-4]}": f for f in sorted(glob.glob("terrain/props/*.png"))})
sprites.update({f"tile_{t}": f"terrain/tile_{t}.png" for t in ("water","ford","grass","mud")})
buildings = {k: {"l1":f"buildings/{v}_l1.png","l2":f"buildings/{v}_l2.png","l3":f"buildings/{v}_l3.png"} for k,v in B_KEYS.items()}
portraits = {k: f"portraits/{v}.png" for k,v in HERO_KEYS.items()}
icons = {"blood":"ui/res_blood.png","gold":"ui/res_gold.png","armor":"ui/upg_silver_armor.png","armor_night":"ui/upg_bone_armor.png",
 "melee":"ui/upg_fangs.png","melee_dawn":"ui/upg_silver_weapons.png","recruit":"ui/upg_faster_recruit.png",
 "badge_1":"ui/badge_level_1.png","badge_2":"ui/badge_level_2.png","badge_3":"ui/badge_level_3.png","ring_night":"ui/team_ring_night.png","ring_dawn":"ui/team_ring_dawn.png"}
for p in list(sprites.values()) + [x for b in buildings.values() for x in b.values()] + list(portraits.values()) + list(icons.values()):
    assert os.path.exists(p), p
man = {"base":"art/", "sprites":sprites, "buildings":buildings, "portraits":portraits, "icons":icons,
 "pack":"night-court-art-v1","generated":"2026-10-19","root":"/workspace/game/art",
 "conventions":{
  "units":"units/<faction>_<unit>.png 64x64 RGBA, 1px faction outline baked in; units/src/*_128.png clean 128px sources",
  "heroes":"heroes/<faction>_<hero>.png 80x80 RGBA (+ heroes/src 160px)",
  "buildings":"buildings/<faction>_<building>_l<1|2|3>.png 256x256 RGBA (+ buildings/src 512px); neutral outposts buildings/neutral_*.png",
  "anchor":"all sprites are bottom-centre anchored: draw at (x - w/2, y - h*0.96) for units, (x - w/2, y - h*0.97) for buildings",
  "facing":"Night Court sprites face down-right, Dawn Order sprites face down-left (they face each other across the map). Mirror with scaleX(-1) for the other direction.",
  "portraits":"portraits/<faction>_<hero>.png 512x512 opaque",
  "ui":"ui/*.png 64x64 RGBA icons; badge_level_N overlays; team_ring_<faction>.png 64x32 drawn under units",
  "terrain":"terrain/tile_<water|ford|grass|mud>.png 128px seamless (256px variants too); terrain/props/*.png 128px bottom-anchored"},
 "files":items}
json.dump(man, open("manifest.json","w"), indent=1)
print(len(items),"files", sheet.size)
