#!/usr/bin/env python3
"""Regenerate data/ and assets/img/ from the source Mordekaiser spreadsheet.

    pip install openpyxl
    python3 tools/build_data.py path/to/Mordekaiser_Matchup_Spreadsheet.xlsx

Reads the workbook, extracts all six sheets plus the embedded icon media, and
writes data/matchups.json, data/guides.json and assets/img/. The writeups are
copied verbatim; nothing here rewrites or summarises the author's prose.
"""
import openpyxl, re, json, collections, os, shutil, sys, zipfile, tempfile

if len(sys.argv) < 2:
    sys.exit("usage: build_data.py <workbook.xlsx> [output_dir]")
SRC = sys.argv[1]
OUT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2
                      else os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
UNZ = tempfile.mkdtemp(prefix="morde-xlsx-")
with zipfile.ZipFile(SRC) as z:
    z.extractall(UNZ)

def dm(i):
    dp=f"{UNZ}/xl/drawings/drawing{i}.xml"; rp=f"{UNZ}/xl/drawings/_rels/drawing{i}.xml.rels"
    if not os.path.exists(dp): return {}
    x=open(dp,encoding="utf8").read()
    rels=dict(re.findall(r'Id="(rId\d+)"[^>]*Target="\.\./media/([^"]+)"', open(rp,encoding="utf8").read()))
    out={}
    for a in re.findall(r'<xdr:(?:two|one)CellAnchor.*?</xdr:(?:two|one)CellAnchor>', x, re.S):
        f=re.search(r'<xdr:from>\s*<xdr:col>(\d+)</xdr:col>.*?<xdr:row>(\d+)</xdr:row>', a, re.S)
        e=re.search(r'r:embed="(rId\d+)"', a)
        if f and e: out[(int(f.group(2))+1,int(f.group(1))+1)]=rels.get(e.group(1))
    return out

wb=openpyxl.load_workbook(SRC, read_only=True, data_only=True)
def grid(sheet, maxr, maxc):
    ws=wb[sheet]; return list(ws.iter_rows(min_row=1,max_row=maxr,max_col=maxc,values_only=True))
def cell(rows,r,c):
    v=rows[r-1][c-1] if 0<r<=len(rows) and c<=len(rows[r-1]) else None
    return str(v).strip() if v not in (None,"") else ""

CANON={"Ganglank":"Gangplank","Cho'gath":"Cho'Gath","Bel'veth":"Bel'Veth","K'sante":"K'Sante",
 "Kai'sa":"Kai'Sa","Rek'sai":"Rek'Sai","Vel'koz":"Vel'Koz","Kog'maw":"Kog'Maw","Leblanc":"LeBlanc",
 "Trundle ":"Trundle","Dr. Mundo":"Dr. Mundo","Jarvan IV":"Jarvan IV","Aurelion Sol":"Aurelion Sol"}
ALIAS={"Gangplank":["gp","ganglank"],"Cho'Gath":["chogath","cho"],"Bel'Veth":["belveth"],
 "K'Sante":["ksante"],"Kai'Sa":["kaisa"],"Rek'Sai":["reksai"],"Vel'Koz":["velkoz"],
 "Kog'Maw":["kogmaw"],"LeBlanc":["leblanc","lb"],"Dr. Mundo":["mundo","drmundo"],
 "Jarvan IV":["jarvan","j4"],"Aurelion Sol":["asol","aurelionsol"],"Master Yi":["yi"],
 "Twisted Fate":["tf"],"Xin Zhao":["xin"],"Tahm Kench":["tahm","kench"],"Lee Sin":["lee"],
 "Mordekaiser":["morde"],"Nunu & Willump":["nunu"],"Renata Glasc":["renata"],
 "Miss Fortune":["mf"],"Wukong":["monkeyking"]}

def slug(s):
    return re.sub(r'[^a-z0-9]+','-', s.lower()).strip('-')

# ---------- confirmed icon identities ----------
ITEM_NAMES={
 "image97.jpg":"Bramble Vest","image116.jpg":"Doran's Helm","image91.jpg":"Doran's Shield",
 "image237.jpg":"Doran's Ring","image99.png":None,"image143.png":None,
 "image63.jpg":"Plated Steelcaps","image255.png":"Plated Steelcaps","image219.png":"Plated Steelcaps",
 "image107.png":"Hextech Rocketbelt","image84.jpg":"Hextech Rocketbelt","image108.png":"Hextech Rocketbelt",
 "image189.jpg":"Hextech Rocketbelt","image115.png":"Dusk & Dawn",
 "image106.png":"Riftmaker","image134.png":"Riftmaker","image83.jpg":"Riftmaker",
 "image85.jpg":"Mercury's Treads","image114.jpg":"Mercury's Treads",
 "image135.png":"Nashor's Tooth","image144.png":"Rylai's Crystal Scepter","image25.png":"Rylai's Crystal Scepter",
 "image113.png":"Experimental Hexplate","image146.png":"Oblivion Orb",
 "image165.png":"Bloodletter's Curse","image167.png":"Bloodletter's Curse","image172.png":"Bloodletter's Curse",
 "image280.png":"Gluttonous Greaves","image159.png":"Kaenic Rookern","image347.png":"Kaenic Rookern",
 "image101.jpg":"Cosmic Drive","image149.png":"Cosmic Drive",
 "image218.jpg":"Boots of Swiftness","image226.png":"Liandry's Torment","image263.png":"Zhonya's Hourglass",
 "image188.png":"Spirit Visage","image69.png":"Kaenic Rookern","image46.png":"Sterak's Gage",
 "image70.png":"Death's Dance","image77.png":"Randuin's Omen","image73.png":"Force of Nature",
 "image64.png":"Abyssal Mask","image109.png":"Frozen Heart","image93.png":"Jak'Sho, The Protean",
 "image82.png":"Unending Despair","image96.png":"Dead Man's Plate","image127.png":"Dark Seal",
 "image88.png":"Mejai's Soulstealer","image105.png":"Verdant Barrier","image104.png":"Guardian Angel",
 "image100.png":"Serpent's Fang","image72.png":"Bramble Vest",
}
PLACEHOLDER={"image99.png":"Build Variety Items","image143.png":"Flex Boots"}
SUMMONERS={"image78.jpg":"Flash","image94.jpg":"Ignite","image118.jpg":"Ghost","image204.jpg":"Teleport"}

# ---------- matchups ----------
rows=grid("Reformatted Spreadsheet",1124,27)
IMG=dm(2)
def g(i,c): return cell(rows,i+1,c)
anchors=[i for i,r in enumerate(rows) if r[0] and str(r[0]).startswith("c:")]
def rating(s):
    m=re.search(r'(\d+)\s*/\s*5', s); return int(m.group(1)) if m else None

SECT=["Early Game:","How to trade:","What to watch out for:","Tips:"]
def split_sections(txt):
    idx=[]
    for s in SECT:
        p=txt.find("\n"+s) if txt.find("\n"+s)>=0 else (0 if txt.startswith(s) else -1)
        if p>=0: idx.append((p,s))
    if not idx: return [{"heading":None,"body":txt.strip()}]
    idx.sort()
    out=[]
    if idx[0][0]>0:
        pre=txt[:idx[0][0]].strip()
        if pre: out.append({"heading":None,"body":pre})
    for k,(p,s) in enumerate(idx):
        start=txt.find(s,p)+len(s)
        end=idx[k+1][0] if k+1<len(idx) else len(txt)
        out.append({"heading":s.rstrip(":"),"body":txt[start:end].strip()})
    return out

def bullets(body):
    """Split a section body into bullet items (lines starting with -) and paragraphs."""
    items=[]; buf=[]
    for ln in body.split("\n"):
        s=ln.rstrip()
        if s.strip().startswith("- "):
            if buf: items.append(" ".join(buf).strip()); buf=[]
            buf=[s.strip()[2:]]
        elif not s.strip():
            if buf: items.append(" ".join(buf).strip()); buf=[]
        else:
            buf.append(s.strip())
    if buf: items.append(" ".join(buf).strip())
    return [i for i in items if i]

def parse_runes(txt):
    groups=[p.strip() for p in re.split(r'\n\s*\n', txt) if p.strip()]
    def toks(p): return [t.strip(" ^") for t in re.split(r'-\s*>|\+', p.replace("\n"," ")) if t.strip(" ^")]
    return {"primary": toks(groups[0]) if len(groups)>0 else [],
            "secondary": toks(groups[1]) if len(groups)>1 else [],
            "shards": toks(groups[2]) if len(groups)>2 else [],
            "raw": txt}

def parse_build_text(txt):
    """-> [{item, note}] preserving author's exact words."""
    out=[]; cur=None; pre=[]
    for ln in txt.split("\n"):
        s=ln.strip()
        if not s: continue
        if set(s)<=set("-–— "): continue
        if s.startswith("("):
            note=s.strip("()").strip()
            if cur: cur["note"]=(cur["note"]+" "+note).strip()
            continue
        if s.endswith(")") and "(" not in s:
            if cur: cur["note"]=(cur["note"]+" "+s.rstrip(")").strip()).strip()
            continue
        if s.startswith("[") or s.lower().startswith("if ") or s.endswith("then go:"):
            pre.append(s.strip("[]").strip()); continue
        if cur: out.append(cur)
        cur={"item":s,"note":""}
    if cur: out.append(cur)
    return out, pre

matchups=[]
used_media=set()
for a in anchors:
    r0=a+1
    raw_name=g(a,2)
    name=CANON.get(raw_name, raw_name.strip())
    gp=g(a,18)
    builds=[]
    for off_lbl, off_icon, off_txt in ((0,1,2),(3,4,5)):
        icons=[IMG.get((r0+off_icon,c)) for c in range(8,14)]
        txt=g(a+off_txt,8)
        if not any(icons) and not txt: continue
        steps,pre=parse_build_text(txt)
        used_media.update(m for m in icons if m)
        builds.append({
            "condition": g(a+off_lbl,8) if g(a+off_lbl,8).lower().startswith("if") else "",
            "prelude": pre,
            "icons":[{"file":m,"name":ITEM_NAMES.get(m),"placeholder":PLACEHOLDER.get(m)} for m in icons if m],
            "steps":steps, "raw":txt})
    port=IMG.get((r0,3)); key=IMG.get((r0,5))
    s1=IMG.get((r0+1,16)); s2=IMG.get((r0+1,14))
    used_media.update(x for x in (port,key,s1,s2) if x)
    secs=[{**s,"items":bullets(s["body"])} for s in split_sections(gp)]
    runes=parse_runes(g(a+4,5))
    matchups.append({
        "name":name,"slug":slug(name),"sourceName":raw_name.strip(),
        "aliases":ALIAS.get(name,[]),
        "portrait":port,"keystoneIcon":key,
        "summoners":[{"file":s1,"name":SUMMONERS.get(s1)},{"file":s2,"name":SUMMONERS.get(s2)}] if s1 else [],
        "ratings":{"early":rating(g(a,14)),"mid":rating(g(a,15)),"late":rating(g(a,16)),"overall":rating(g(a,17))},
        "keystone": runes["primary"][0] if runes["primary"] else None,
        "runes":runes,"builds":builds,
        "sections":secs,"gameplayRaw":gp,
        "tldr":bullets(g(a+2,14)) if g(a+2,14) else [],
        "video":g(a,25) or g(a,26) or g(a,27),
    })

# ---------- introduction ----------
irows=grid("Introduction",25,16)
intro={"title":cell(irows,1,1),"subtitle":cell(irows,2,1),
       "toc":[cell(irows,r,3) for r in range(4,10) if cell(irows,r,3)],
       "betaNote":cell(irows,3,9),"todo":cell(irows,4,9),
       "wikiLabel":cell(irows,10,1),"buglist":cell(irows,10,9),"skinNote":cell(irows,12,9)}
patches=[]; cur=None
for r in range(12,26):
    a,b=cell(irows,r,1),cell(irows,r,2)
    if re.match(r'^V\d+\.\d+$',a):
        if cur: patches.append(cur)
        cur={"version":a,"changes":[]}
    elif a.startswith("- ") and cur is not None:
        cur["changes"].append({"ability":a[2:],"text":""})
    elif b and cur is not None and cur["changes"]:
        cur["changes"][-1]["text"]=b
if cur: patches.append(cur)
intro["patches"]=patches

# ---------- itemization guide ----------
grows=grid("Itemization Guide",46,8); d3=dm(3)
SLOTC={1:"First",3:"Second",5:"Third",7:"Fourth+"}
sections=[]; cursec=None
for r in range(4,46):
    head=cell(grows,r,1)
    if head and not d3.get((r,1)) and head not in ("General\nItemization\nGuide:",):
        if cursec: sections.append(cursec)
        cursec={"title":head,"entries":[]}
    ent=[]
    for c,lab in SLOTC.items():
        med=d3.get((r,c)); txt=cell(grows,r,c+1)
        if med or txt: ent.append({"slot":lab,"icon":med,"text":txt})
    if ent and cursec is not None:
        cursec["entries"].append({"row":r,"slots":ent})
        used_media.update(e["icon"] for e in ent if e["icon"])
if cursec: sections.append(cursec)
itemguide=sections

# ---------- rune guide ----------
rrows=grid("Rune Guide",28,8); d4=dm(4)
runeguide=[]; cur=None
for r in range(1,29):
    if cell(rrows,r,1)=="Rune":
        cur={"row":r,"entries":[]}; runeguide.append(cur)
        continue
    if cur is None: continue
    for c in (1,3,5,7):
        med=d4.get((r,c)); txt=cell(rrows,r,c+1)
        if med or txt:
            cur["entries"].append({"icon":med,"text":txt})
            if med: used_media.add(med)

# ---------- alternative setups ----------
arows=grid("Alternative Mordekaiser Setups",17,7)
alts=[]; group=None
for r in range(4,18):
    a=cell(arows,r,1)
    if a.endswith("entries:"):
        group=a.replace(" entries:","" ); continue
    if a and a!="Build Concept" and cell(arows,r,3):
        alts.append({"group":group,"name":a,"runes":cell(arows,r,3),"items":cell(arows,r,4),
                     "example":cell(arows,r,5),"comments":cell(arows,r,7)})

# ---------- creators ----------
crows=grid("Mordekaiser Content  References",35,11)
creators=[]
for r in range(3,36):
    if cell(crows,r,2):
        creators.append({"region":cell(crows,r,1),"name":cell(crows,r,2),"peak":cell(crows,r,3),
                         "twitter":cell(crows,r,4),"youtube":cell(crows,r,5),"twitch":cell(crows,r,6),
                         "alt":cell(crows,r,7),"opgg":cell(crows,r,8)})
credits=[{"name":cell(crows,r,10),"role":cell(crows,r,11)} for r in range(3,36) if cell(crows,r,10)]

# ---------- emit ----------
os.makedirs(f"{OUT}/assets/img", exist_ok=True)
for m in sorted(used_media):
    src=f"{UNZ}/xl/media/{m}"
    if os.path.exists(src): shutil.copy(src, f"{OUT}/assets/img/{m}")
os.makedirs(f"{OUT}/data", exist_ok=True)
json.dump(matchups, open(f"{OUT}/data/matchups.json","w"), indent=0, ensure_ascii=False)
json.dump({"intro":intro,"itemguide":itemguide,"runeguide":runeguide,"alts":alts,
           "creators":creators,"credits":credits},
          open(f"{OUT}/data/guides.json","w"), indent=0, ensure_ascii=False)
shutil.rmtree(UNZ, ignore_errors=True)
print("matchups:",len(matchups),"| media copied:",len(used_media))
print("patches:",[p["version"] for p in patches])
print("itemguide sections:",[s["title"][:30] for s in itemguide])
print("alts:",len(alts),"creators:",len(creators),"credits:",len(credits))
print("runeguide groups:",len(runeguide))
m=matchups[0]
print("\nAatrox sections:",[s["heading"] for s in m["sections"]])
print("Aatrox runes:",m["runes"]["primary"], "|", m["runes"]["secondary"], "|", m["runes"]["shards"])
print("Aatrox build0 steps:",[s["item"] for s in m["builds"][0]["steps"]])
print("Aatrox build0 icons:",[ (i['name'] or i['placeholder']) for i in m["builds"][0]["icons"]])
print("summoners:",m["summoners"])
wb.close()
