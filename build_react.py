#!/usr/bin/env python3
"""Build begonia_dashboard_react.html: the React version, still one self-contained file.

    npm install          # once: React + esbuild
    python3 build_react.py

Pipeline: esbuild compiles src/react/App.jsx (JSX -> JS) and bundles React + ReactDOM into one
minified script. That is the same job Babel does in the browser, done once at build time.
Data and CSS are shared with the vanilla version (build.py / src/template.html), so both
dashboards always show the same plants in the same styling.
"""
import json, re, subprocess
from pathlib import Path
import build  # data loading and tokens/fonts inlining from the vanilla build

ROOT = Path(__file__).parent
EXTRA_CSS = ".facet.wide .row{grid-template-columns:minmax(0,14rem) 1fr auto}\n"


def bundle():
    r = subprocess.run(
        ["node_modules/.bin/esbuild", "src/react/App.jsx", "--bundle", "--minify", "--format=iife",
         "--target=es2019", "--jsx=transform", '--define:process.env.NODE_ENV="production"'],
        cwd=ROOT, capture_output=True, text=True, check=True)
    return r.stdout


def script_safe(s):
    return s.replace("</script", "<\\/script")


def main():
    data = build.load()
    tpl = (ROOT / "src/template.html").read_text()
    css = re.search(r"<style>(.*?)</style>", tpl, re.S).group(1)
    # same placeholder substitution the vanilla build uses
    fonts, tokens = build.fonts_and_tokens()
    css = css.replace("/*__FONTS__*/", fonts).replace("/*__TOKENS__*/", tokens) + EXTRA_CSS
    logo = (ROOT / "fwbg/assets/logo-primary.svg").read_text()
    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Begonia Collection Explorer (React)</title>
<meta name="description" content="Explore the living Begonia collection at Fort Worth Botanic Garden: search, filter and chart the plants by growth habit, origin and more.">
<style>{css}</style>
</head>
<body>
<div id="root"></div>
<script>window.__DATA__={script_safe(json.dumps(data, ensure_ascii=False, separators=(",", ":")))};window.__LOGO__={script_safe(json.dumps(logo))};</script>
<script>{script_safe(bundle())}</script>
</body>
</html>
"""
    out = ROOT / "begonia_dashboard_react.html"
    out.write_text(page)
    print(f"{len(data)} plants -> {out.name} ({out.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
