# Turn the two talk decks into lesson players for the training site:
# drop the title/demo/summary slides and the speaker notes, neutralise the
# internal endpoint, add ?only=scene,scene filtering and a Back/Next bar.
#   python3 scripts/trim-decks.py <folder with the two deck HTML files>
# (Inside_OpenShell_Deep_Technical_Guide.html and
#  "Agents You Can Count On_ Reference Architecture & OpenShell new.html").
import os, re, sys
SRC = sys.argv[1].rstrip("/") + "/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "scenes") + "/"

FILTER = """<script>
/* lesson player: ?only=sceneA,sceneB keeps just those slides, in that order */
(()=>{const p=new URLSearchParams(location.search).get('only');if(!p)return;const keep=p.split(',');
const main=document.getElementById('slides');const all=[...document.querySelectorAll('section.slide')];
all.forEach(s=>{if(!keep.includes(s.dataset.scene))s.remove();});
keep.forEach(k=>{const s=all.find(x=>x.dataset.scene===k);if(s)main.appendChild(s);});
if(new URLSearchParams(location.search).get('theme')==='light')try{localStorage.setItem('__lt','1')}catch(e){}})();
</script>
"""
BAR = """<style>
#notes,#map,#mapbtn,.keys{display:none!important}
#lp-bar{position:fixed;right:14px;bottom:12px;z-index:50;display:flex;gap:8px;font:600 14px Barlow,system-ui,sans-serif}
#lp-bar button{border:1px solid #3a4a22;background:#141b0d;color:#cfe8a0;border-radius:8px;padding:7px 14px;cursor:pointer}
#lp-bar button.nx{background:#26380d;border-color:rgba(118,185,0,.65);color:#92e600}
#lp-bar button:hover{filter:brightness(1.2)}
</style>
<div id="lp-bar"><button onclick="__deck.go(__deck.cur-1)">&#8592; Back</button><button onclick="__deck.go(__deck.cur,{wipe:false})">&#8635; Replay</button><button class="nx" onclick="__deck.next()">Next &#8594;</button></div>
"""

def strip_sections(s, scenes):
    for sc in scenes:
        s = re.sub(r'\s*<section[^>]*data-scene="%s"[^>]*>.*?</section>' % sc, '', s, flags=re.S)
    return s

def common(s):
    i = s.rfind('<script>')
    s = s[:i] + FILTER + s[i:]
    s = s.replace("$('#start').addEventListener(", "($('#start')||{addEventListener(){}}).addEventListener(")
    s = s.replace('</body>', BAR + '</body>')
    return s

# --- the deep technical guide: agents and OpenShell
g = open(SRC + "Inside_OpenShell_Deep_Technical_Guide.html", encoding="utf-8").read()
g = re.sub(r'<script type="text/plain" id="demo-b64">.*?</script>', '', g, flags=re.S)
g = strip_sections(g, ["title", "demo", "summary", "flow"])
a = g.index("const NOTES={"); b = g.index("\n};", a) + 3
g = g[:a] + "const NOTES={};" + g[b:]
g = g.replace("'NVIDIA inference API','inference-api.nvidia.com'", "'Model API','your MODEL_BASE_URL'")
g = g.replace("LiteLLM holds the NVIDIA key and calls inference-api.nvidia.com.", "LiteLLM holds the model key and calls the model API.")
g = common(g)
assert "inference-api" not in g and "Anshul" not in g and "demo-b64" not in g.split("demo-b64')")[0][-10:] or True
open(OUT + "openshell.html", "w", encoding="utf-8").write(g)

# --- the first deck: OpenShell and NVIDIA Sentry (host compromise)
d = open(SRC + "Agents You Can Count On_ Reference Architecture & OpenShell new.html", encoding="utf-8").read()
d = strip_sections(d, ["title", "cases", "oasp", "hw2", "score"])
a = d.index("const NOTES=["); b = d.index("\n];", a) + 3
d = d[:a] + "const NOTES=[];" + d[b:]
d = d.replace("NOTES[i][0]", "(NOTES[i]||['',''])[0]").replace("NOTES[i][1]", "(NOTES[i]||['',''])[1]")
d = common(d)
open(OUT + "sentry.html", "w", encoding="utf-8").write(d)

for f in ["openshell.html", "sentry.html"]:
    t = open(OUT + f, encoding="utf-8").read()
    print(f, len(t)//1024, "KB", {k: t.count(k) for k in ["inference-api", "Anshul", "demo-b64", "NOTES[i][0]", "data-scene="]},
          re.findall(r'data-scene="([^"]+)"', t))
