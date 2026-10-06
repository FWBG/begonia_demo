#!/usr/bin/env python3
"""Build begonia_dashboard.html: one self-contained file (data, fonts, logo, CSS, JS inlined).

    python3 build.py

Reads  data/source/2026_05_28_Begonia_Item_Report_2_TmpExpItem02.xlsx
       src/template.html, fwbg/tokens/*.css, fwbg/assets/*
Writes begonia_dashboard.html
Only public-safe fields are exported: staff names, source contacts, bench/greenhouse
locations, and free-text comments never leave this script.
"""
import base64, json, re
from pathlib import Path
import openpyxl

ROOT = Path(__file__).parent
XLSX = ROOT / "data/source/2026_05_28_Begonia_Item_Report_2_TmpExpItem02.xlsx"

COUNTRIES = {
    "BRA": "Brazil", "CHN": "China", "MYS": "Malaysia", "IND": "India", "VNM": "Vietnam",
    "MEX": "Mexico", "PHL": "Philippines", "GAB": "Gabon", "IDN": "Indonesia", "MDG": "Madagascar",
    "ECU": "Ecuador", "CMR": "Cameroon", "THA": "Thailand", "PNG": "Papua New Guinea",
    "TZA": "Tanzania", "CRI": "Costa Rica", "BOL": "Bolivia", "LAO": "Laos", "TWN": "Taiwan",
    "VEN": "Venezuela", "PRI": "Puerto Rico",
}
MATERIAL = {"Existing (plant)": "Plant", "Plant (plant)": "Plant", "Seedling (plant)": "Plant",
            "Rooted cutting (plant)": "Plant", "Cutting (prop. mat.)": "Cutting",
            "Seed (prop. mat.)": "Seed", "Bulbil": "Cutting"}


def name_type(n):
    if "×" in n:
        return "Hybrid"
    if re.match(r"^Begonia [a-z][a-z-]+\b(?! ?\d)", n) and not re.match(r"^Begonia sp\b", n):
        return "Species"
    if re.match(r"^Begonia ['‘]", n):
        return "Cultivar"
    return "Unidentified"


def species(n):
    m = re.match(r"^Begonia ([a-z][a-z-]+)", n)
    return m.group(1) if m and m.group(1) != "sp" else ""


def load():
    ws = openpyxl.load_workbook(XLSX, read_only=True).active
    rows = list(ws.values)
    head = rows[0]
    out = []
    for r in rows[1:]:
        d = dict(zip(head, r))
        if d["ItemStatusCode"] != "I":  # in the living collection only
            continue
        n = d["TaxonName"].strip()
        nat = d["AtrT_Native_Status"] or ""
        out.append({
            "n": n,
            "t": name_type(n),
            "s": species(n),
            "h": [x.strip() for x in (d["AtrT_Begonia_Habit"] or "").split("·") if x.strip()] or ["Unspecified"],
            "o": d["ProvenanceCode"] or "U",
            "m": MATERIAL.get(d["MaterialType"] or "", "Unknown"),
            "r": ("Outside North America" if nat == "Not North American native"
                  else "North America" if nat.startswith("North American native (but not Texas)") and "·" not in nat
                  else "Unspecified"),
            "y": int(d["AccYear"]),
            "c": (d["LocalityFull"] or "").split(":")[0] and COUNTRIES.get(d["LocalityFull"].split(":")[0], ""),
            "a": d["AccNoFull"],
        })
    return out


def b64(p):
    return base64.b64encode(Path(p).read_bytes()).decode()


def fonts_and_tokens():
    """Return (font CSS with Satoshi embedded, design-token CSS)."""
    css = ""
    for f in ("colors", "typography", "spacing", "shape"):
        css += (ROOT / f"fwbg/tokens/{f}.css").read_text() + "\n"
    font = ("@import url('https://use.typekit.net/pgm0cqm.css');\n"
            "@font-face{font-family:Satoshi;src:url(data:font/woff2;base64,%s) format('woff2');"
            "font-weight:300 900;font-display:swap}\n" % b64(ROOT / "fwbg/assets/fonts/Satoshi-Variable.woff2"))
    return font, css


def main():
    data = load()
    font, css = fonts_and_tokens()
    logo = (ROOT / "fwbg/assets/logo-primary.svg").read_text()
    html = (ROOT / "src/template.html").read_text()
    html = (html.replace("/*__FONTS__*/", font).replace("/*__TOKENS__*/", css)
                .replace("<!--__LOGO__-->", logo)
                .replace("__DATA__", json.dumps(data, ensure_ascii=False, separators=(",", ":"))))
    out = ROOT / "begonia_dashboard.html"
    out.write_text(html)
    print(f"{len(data)} plants -> {out.name} ({out.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
