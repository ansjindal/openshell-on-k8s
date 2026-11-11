"""Tiny helper for hand-laid-out SVG diagrams (coordinates are chosen by hand)."""
import os, re
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))  # symbols.txt lives here
SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

INK = "#1f2328"; SUB = "#57606a"; GREY = "#3d4652"; MID = "#8a94a3"; LINE = "#c3c9d1"
BG = "#f4f5f7"; GREEN = "#76b900"; GREEN_D = "#4a7a00"; GREEN_T = "#f3f9e8"; GREEN_L = "#b7dc7a"
RED = "#d62d2d"; RED_T = "#fdf0f0"
# near-white variants so the training site can theme them apart from boxes (#fff)
AREA = "#fefefe"; LBG = "#fffffe"

EXTRA_SYMBOLS = {
 "i-term": '<symbol id="i-term" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M6.5 9.5l3 2.5-3 2.5M12 15h5"/></symbol>',
 "i-route": '<symbol id="i-route" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h6M9 12l5-6h7M9 12l5 6h7M18 3l3 3-3 3M18 15l3 3-3 3"/></symbol>',
 "i-server": '<symbol id="i-server" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="18" height="7" rx="1.5"/><rect x="3" y="13.5" width="18" height="7" rx="1.5"/><path d="M7 7h.01M7 17h.01"/></symbol>',
 "i-bot": '<symbol id="i-bot" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 17h5"/><circle cx="12" cy="3.5" r="1"/></symbol>',
 "i-ban": '<symbol id="i-ban" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></symbol>',
 "i-user": '<symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.8"/><path d="M4.5 21c0-4.2 3.4-7 7.5-7s7.5 2.8 7.5 7"/></symbol>',
 "i-browser": '<symbol id="i-browser" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M2.5 8.5h19M5.5 6.3h.01M8 6.3h.01"/></symbol>',
}


def load_symbols():
    syms = {}
    for line in open(os.path.join(HERE, "symbols.txt")):
        m = re.match(r'<symbol id="([^"]+)"', line.strip())
        if m:
            syms[m.group(1)] = line.strip()
    syms.update(EXTRA_SYMBOLS)
    return syms


def tw(text, size, mono=False, bold=False):
    """Rough text width estimate (conservative)."""
    if mono:
        return len(text) * size * 0.61
    w = 0
    for ch in text:
        if ch in "il.,:;|'!·()/[]{} ": w += 0.32
        elif ch in "mwMW@": w += 0.85
        elif ch.isupper() or ch.isdigit(): w += 0.66
        else: w += 0.56
    return w * size * (1.06 if bold else 1.0)


class Svg:
    def __init__(self, w, h, title, desc):
        self.w, self.h, self.title, self.desc = w, h, title, desc
        self.body = []
        self.used = set()
        self.colors = set()
        self.texts = []  # (x0,y0,x1,y1,text)
        self.warn = []

    # ---------- primitives
    def raw(self, s):
        self.body.append(s)

    def text(self, x, y, s, size=14, bold=False, color=INK, anchor="start", mono=False, italic=False, check=True):
        fam = MONO if mono else SANS
        size = max(size, 13)
        w = tw(s, size, mono, bold)
        x0 = x if anchor == "start" else (x - w / 2 if anchor == "middle" else x - w)
        if check:
            self.texts.append((x0, y - size * 0.8, x0 + w, y + size * 0.22, s))
        st = ' font-style="italic"' if italic else ''
        self.body.append(
            f'<text x="{x:g}" y="{y:g}" font-family="{fam}" font-size="{size}" font-weight="{"bold" if bold else "normal"}"{st} '
            f'fill="{color}" text-anchor="{anchor}" xml:space="preserve">{escape(s)}</text>')
        return w

    def icon(self, name, x, y, size=22, color=GREY):
        self.used.add(name)
        self.body.append(f'<use href="#{name}" xlink:href="#{name}" x="{x:g}" y="{y:g}" width="{size}" height="{size}" color="{color}"/>')

    def rect(self, x, y, w, h, fill="#fff", stroke=LINE, sw=1, rx=6, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.body.append(f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    # ---------- composites
    def box(self, x, y, w, h, title, lines=(), icon=None, kind="grey", tsize=15.5, lsize=13.5, gap=19, top=None):
        stroke, sw, ic, fill = {
            "grey": (GREY, 1.3, GREY, "#fff"),
            "light": (LINE, 1, GREY, "#fff"),
            "green": (GREEN, 1.8, GREEN_D, "#fff"),
            "red": (RED, 1.6, RED, RED_T),
        }[kind]
        self.body.append(f'<g class="dg-node" data-node="{escape(title)}">')
        self.rect(x, y, w, h, fill=fill, stroke=stroke, sw=sw)
        n = 1 + len(lines)
        block = tsize + (n - 1) * gap
        ty = (y + (h - block) / 2 + tsize * 0.8) if top is None else y + top
        tx = x + 12
        if icon:
            self.icon(icon, x + 10, ty - tsize * 0.8 - 3, 22, ic)
            tx = x + 40
        wt = self.text(tx, ty, title, tsize, True)
        maxw = tx - x + wt
        for i, ln in enumerate(lines):
            mono = False; col = SUB; s = ln
            if isinstance(ln, tuple):
                s, opt = ln
                mono = "m" in opt
                col = RED if "r" in opt else (GREEN_D if "g" in opt else (INK if "k" in opt else SUB))
            sz = lsize - (0.5 if mono else 0)
            wl = self.text(tx, ty + gap * (i + 1), s, sz, False, col, mono=mono)
            maxw = max(maxw, tx - x + wl)
        if maxw > w - 8:
            self.warn.append(f"text overflows box '{title}': need {maxw:.0f} have {w}")
        if ty + gap * (n - 1) + 6 > y + h:
            self.warn.append(f"text overflows box height '{title}'")
        self.body.append('</g>')

    def ns(self, x, y, w, h, label, green=False, sub=None):
        if green:
            self.rect(x, y, w, h, fill=GREEN_T, stroke=GREEN_L, sw=1.2, rx=8)
            col = GREEN_D
        else:
            self.rect(x, y, w, h, fill="#f6f7f9", stroke=LINE, sw=1.2, rx=8)
            col = SUB
        lw = self.text(x + 12, y + 20, "namespace ", 13, False, col)
        lw2 = self.text(x + 12 + lw, y + 20, label, 13.5, True, col, mono=True)
        if sub:
            self.text(x + 12 + lw + lw2 + 8, y + 20, sub, 13, False, col)

    def label(self, x, y, s, color=GREY, anchor="middle", size=13, mono=True, bold=False, bg=LBG):
        size = max(size, 13)
        w = tw(s, size, mono, bold)
        x0 = x if anchor == "start" else (x - w / 2 if anchor == "middle" else x - w)
        self.rect(x0 - 4, y - size * 0.85 - 2, w + 8, size + 5, fill=bg, stroke="none", sw=0, rx=3)
        self.text(x, y, s, size, bold, color, anchor, mono)

    def badge(self, x, y, n, color=GREEN_D, r=11):
        self.body.append(f'<circle cx="{x:g}" cy="{y:g}" r="{r}" fill="{color}"/>')
        self.text(x, y + 4.6, str(n), 13, True, "#fff", "middle", check=False)

    def arrow(self, d, color=GREY, sw=1.6, dash=None, both=False, end=True):
        self.colors.add(color)
        cid = color.lstrip("#")
        ds = f' stroke-dasharray="{dash}"' if dash else ''
        me = f' marker-end="url(#a{cid})"' if end else ''
        ms = f' marker-start="url(#a{cid})"' if both else ''
        self.body.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{ds}{me}{ms} stroke-linejoin="round" stroke-linecap="round"/>')

    # ---------- output
    def check_overlaps(self):
        t = self.texts
        for i in range(len(t)):
            for j in range(i + 1, len(t)):
                a, b = t[i], t[j]
                if a[0] < b[2] - 1 and b[0] < a[2] - 1 and a[1] < b[3] - 1 and b[1] < a[3] - 1:
                    self.warn.append(f"text overlap: '{a[4]}' <-> '{b[4]}'")
            if t[i][2] > self.w - 4 or t[i][0] < 4:
                self.warn.append(f"text off canvas: '{t[i][4]}'")

    def save(self, path):
        syms = load_symbols()
        defs = [syms[n] for n in sorted(self.used)]
        for c in sorted(self.colors):
            cid = c.lstrip("#")
            defs.append(f'<marker id="a{cid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{c}"/></marker>')
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" role="img" aria-label="{escape(self.desc, {chr(34): "&quot;"})}">',
               f'<title>{escape(self.title)}</title>',
               f'<desc>{escape(self.desc)}</desc>',
               '<defs>', *defs, '</defs>',
               f'<rect width="{self.w}" height="{self.h}" fill="#ffffff"/>',
               *self.body, '</svg>']
        open(path, "w").write("\n".join(out) + "\n")
        self.check_overlaps()
        for w in self.warn:
            print("WARN", w)
        print("wrote", path, os.path.getsize(path), "bytes")
