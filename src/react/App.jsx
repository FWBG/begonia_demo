import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

// Injected at build time: window.__DATA__ (plants) and window.__LOGO__ (svg markup)
const DATA = window.__DATA__;
const LOGO = window.__LOGO__;

const ORIGIN = { G: "Cultivated (garden origin)", W: "Wild-collected", Z: "Grown from wild-collected plant", U: "Origin unknown" };
const FACETS = [
  { k: "h", title: "Growth habit", multi: true },
  { k: "o", title: "Origin", label: (v) => ORIGIN[v], order: ["G", "U", "W", "Z"] },
  { k: "m", title: "How it arrived" },
  { k: "t", title: "Type of name" },
  { k: "c", title: "Country" },
  { k: "r", title: "Native range" },
  { k: "y", title: "Year added" },
];
const FACET = Object.fromEntries(FACETS.map((f) => [f.k, f]));
const COLS = [
  { k: "n", t: "Name" }, { k: "h", t: "Growth habit" }, { k: "o", t: "Origin" },
  { k: "c", t: "Country" }, { k: "r", t: "Native range" }, { k: "y", t: "Added" },
];
const PAGE = 50;

const fmt = (n) => n.toLocaleString();
const valuesOf = (d, f) => (f.multi ? d[f.k] : [d[f.k]]);
const labelOf = (k, v) => (FACET[k].label ? FACET[k].label(v) : v);
const emptySel = () => Object.fromEntries(FACETS.map((f) => [f.k, []]));

const SEARCH = DATA.map((d) => [d.n, d.s, d.c, d.a, d.h.join(" ")].join(" ").toLowerCase());
const Y0 = Math.min(...DATA.map((d) => d.y));
const Y1 = Math.max(...DATA.map((d) => d.y));

function matches(d, i, q, sel, skip) {
  for (const w of q.split(/\s+/).filter(Boolean)) if (!SEARCH[i].includes(w)) return false;
  for (const f of FACETS) {
    if (f.k === skip || !sel[f.k].length) continue;
    if (!valuesOf(d, f).some((v) => sel[f.k].includes(String(v)))) return false;
  }
  return true;
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const sel = emptySel();
  FACETS.forEach((f) => { if (p.get(f.k)) sel[f.k] = p.get(f.k).split("|"); });
  return { q: p.get("q") || "", sel };
}

/* ---------- presentational components ---------- */

function Kpi({ value, label }) {
  return <div className="kpi"><b>{value}</b><span>{label}</span></div>;
}

function FacetList({ facet, counts, selected, onToggle, scroll }) {
  const keys = useMemo(() => {
    const all = new Map();
    DATA.forEach((d) => valuesOf(d, facet).forEach((v) => v !== "" && all.set(String(v), (all.get(String(v)) || 0) + 1)));
    return facet.order ? facet.order.filter((k) => all.has(k)) : [...all.keys()].sort((a, b) => all.get(b) - all.get(a));
  }, [facet]);
  const max = Math.max(1, ...keys.map((k) => counts.get(k) || 0));
  return (
    <ul className={"facet" + (scroll ? " scroll" : "") + (facet.k === "o" ? " wide" : "")}>
      {keys.map((k) => {
        const n = counts.get(k) || 0, lab = labelOf(facet.k, k);
        return (
          <li key={k}>
            <button className={"row" + (n ? "" : " zero")} aria-pressed={selected.includes(k)} title={`${lab}: ${fmt(n)}`} onClick={() => onToggle(facet.k, k)}>
              <span className="lbl">{lab}</span>
              <span className="bar"><i style={{ width: `${(n / max) * 100}%` }} /></span>
              <span className="n">{fmt(n)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function YearChart({ counts, selected, onToggle }) {
  const years = [];
  for (let y = Y0; y <= Y1; y++) years.push(y);
  const max = Math.max(1, ...years.map((y) => counts.get(String(y)) || 0));
  return (
    <>
      <div className="years">
        {years.map((y) => {
          const n = counts.get(String(y)) || 0;
          return (
            <button key={y} className="yr" aria-pressed={selected.includes(String(y))} title={`${y}: ${fmt(n)} plants`} aria-label={`${y}: ${fmt(n)} plants`} onClick={() => onToggle("y", String(y))}>
              <span className="cnt">{n || ""}</span>
              <span className="col" style={{ height: (n / max) * 150 }} />
            </button>
          );
        })}
      </div>
      <div className="axis" aria-hidden="true">
        {years.map((y) => <span key={y}>{(y - Y0) % 5 === 0 || y === Y1 ? y : ""}</span>)}
      </div>
    </>
  );
}

function Name({ n }) {
  const m = n.match(/^(Begonia(?: [a-z][a-z-]+)?)(.*)$/s);
  return m ? <><em>{m[1]}</em>{m[2]}</> : n;
}

function PlantTable({ rows, sort, onSort, shown, onMore }) {
  const sorted = useMemo(() => {
    const key = (d) => (sort.key === "h" ? d.h.join(",") : d[sort.key] === "" ? "￿" : d[sort.key]);
    return rows.slice().sort((a, b) => {
      const x = key(a), y = key(b);
      return (x < y ? -1 : x > y ? 1 : a.n.localeCompare(b.n)) * sort.dir;
    });
  }, [rows, sort]);
  const page = sorted.slice(0, shown);
  return (
    <section className="results" aria-label="Plant list">
      <div className="rhead"><h2>Plants</h2><span aria-live="polite">Showing {fmt(page.length)} of {fmt(rows.length)} plants</span></div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.k} scope="col" aria-sort={sort.key === c.k ? (sort.dir > 0 ? "ascending" : "descending") : undefined}>
                  <button onClick={() => onSort(c.k)}>{c.t}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.map((d, i) => (
              <tr key={d.a + d.n + i}>
                <td className="name"><Name n={d.n} /></td>
                <td>{d.h.join(", ")}</td>
                <td><span className={"tag " + d.o}>{ORIGIN[d.o]}</span></td>
                <td>{d.c || "—"}</td>
                <td>{d.r}</td>
                <td>{d.y}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">No plants match these filters. Try removing one.</div>}
        {rows.length > shown && (
          <div className="more"><button className="btn" onClick={onMore}>Show more ({fmt(rows.length - shown)} remaining)</button></div>
        )}
      </div>
    </section>
  );
}

/* ---------- app ---------- */

function App() {
  const init = useMemo(readHash, []);
  const [q, setQ] = useState(init.q);
  const [sel, setSel] = useState(init.sel);
  const [sort, setSort] = useState({ key: "n", dir: 1 });
  const [shown, setShown] = useState(PAGE);

  const toggle = (k, v) => {
    setSel((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));
    setShown(PAGE);
  };
  const clearAll = () => { setQ(""); setSel(emptySel()); setShown(PAGE); };

  // rows matching every filter
  const rows = useMemo(() => DATA.filter((d, i) => matches(d, i, q, sel, null)), [q, sel]);

  // per-facet counts: apply every filter except the facet's own, so its options stay visible
  const counts = useMemo(() => {
    const out = {};
    FACETS.forEach((f) => {
      const m = new Map();
      DATA.forEach((d, i) => {
        if (!matches(d, i, q, sel, f.k)) return;
        valuesOf(d, f).forEach((v) => v !== "" && m.set(String(v), (m.get(String(v)) || 0) + 1));
      });
      out[f.k] = m;
    });
    return out;
  }, [q, sel]);

  // shareable URL state
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    FACETS.forEach((f) => sel[f.k].length && p.set(f.k, sel[f.k].join("|")));
    try { history.replaceState(null, "", p.toString() ? "#" + p : location.pathname + location.search); } catch (e) {}
  }, [q, sel]);

  useEffect(() => {
    const onHash = () => { const h = readHash(); setQ(h.q); setSel(h.sel); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const pills = [];
  if (q) pills.push({ id: "q", text: `Search: “${q}”`, remove: () => setQ("") });
  FACETS.forEach((f) => sel[f.k].forEach((v) => pills.push({ id: f.k + v, text: `${f.title}: ${labelOf(f.k, v)}`, remove: () => toggle(f.k, v) })));

  const facetCard = (k, props = {}) => (
    <FacetList facet={FACET[k]} counts={counts[k]} selected={sel[k]} onToggle={toggle} {...props} />
  );

  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="logo" href="https://fwbg.org" aria-label="Fort Worth Botanic Garden" dangerouslySetInnerHTML={{ __html: LOGO }} />
          <div className="eyebrow">Living collection</div>
          <h1>Begonia Collection Explorer</h1>
          <p>Browse the begonias growing in our care. Search by name or country, click any bar or year to filter, and watch every chart and count update.</p>
        </div>
      </header>

      <main className="wrap">
        <section className="kpis" aria-live="polite" aria-label="Summary of the plants shown">
          <Kpi value={fmt(rows.length)} label={rows.length === DATA.length ? "plants in the collection" : `plants shown (of ${fmt(DATA.length)})`} />
          <Kpi value={fmt(new Set(rows.map((d) => d.s).filter(Boolean)).size)} label="different species" />
          <Kpi value={fmt(rows.filter((d) => d.o === "W").length)} label="wild-collected" />
          <Kpi value={fmt(new Set(rows.map((d) => d.c).filter(Boolean)).size)} label="countries of origin on record" />
        </section>

        <div className="toolbar">
          <div className="search">
            <div className="box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <label className="sr" htmlFor="q">Search the collection</label>
              <input id="q" type="search" placeholder="Search names, countries, accession no." autoComplete="off" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />
            </div>
            {pills.length > 0 && <button className="btn ghost" onClick={clearAll}>Clear all filters</button>}
          </div>
          <div className="pills" aria-label="Active filters">
            {pills.map((p) => (
              <button key={p.id} className="pill" onClick={p.remove}>{p.text} <i aria-hidden="true">×</i><span className="sr">remove</span></button>
            ))}
          </div>
        </div>

        <section className="grid" aria-label="Charts and filters">
          <div className="card s4"><h2>Growth habit</h2><p className="sub">How the plant grows. Some plants have more than one.</p>{facetCard("h")}</div>
          <div className="card s8"><h2>When plants joined the collection</h2><p className="sub">Plants added each year. Click a year to filter.</p><YearChart counts={counts.y} selected={sel.y} onToggle={toggle} /></div>
          <div className="card s4"><h2>Where it came from</h2><p className="sub">The history of each plant before it reached us.</p>{facetCard("o")}</div>
          <div className="card s4"><h2>How it arrived</h2>{facetCard("m")}<h2 style={{ marginTop: 18 }}>Type of name</h2>{facetCard("t")}</div>
          <div className="card s4"><h2>Countries of wild origin</h2><p className="sub">Only plants with a recorded collecting country.</p>{facetCard("c", { scroll: true })}<h2 style={{ marginTop: 18 }}>Native range</h2>{facetCard("r")}</div>
        </section>

        <PlantTable rows={rows} sort={sort} shown={shown} onMore={() => setShown((n) => n + 100)}
          onSort={(k) => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : 1 }))} />
      </main>

      <footer className="wrap">
        <p>Source: Fort Worth Botanic Garden Begonia item report, 28 May 2026. Includes plants currently living in the collection.</p>
        <p>Origin codes follow standard botanic-garden practice: <b>wild-collected</b> plants came directly from nature; <b>grown from wild-collected</b> plants descend from a wild source plant in cultivation; <b>cultivated</b> plants have a garden origin.</p>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
