# Digital twins for perioperative medicine — team website

Static site for **Digital twins for perioperative medicine**, **Team 3** of Inserm Unit U942 —
**MASCOT** (*Cardiovascular MArkers in Stressed COndiTions*) — under AP-HP · Université Paris
Cité · Inserm.

The site is the team's, not the unit's: the team name is the site's identity, and MASCOT/U942
is a parent affiliation. The MASCOT wordmark (`assets/img/mascot-logo.png`) belongs in the
affiliation row, not the hero.

A single scrolling page with anchor navigation, hosted on GitHub Pages. No server-side code.

## Layout

```
index.html                 the whole site
src/input.css              Tailwind entry point + design tokens (@theme)
src/fonts.css              generated @font-face rules for the self-hosted fonts
assets/css/site.css        built stylesheet — committed, do not edit by hand
assets/fonts/              self-hosted woff2 (Source Serif 4, IBM Plex Mono)
assets/img/                logos, marks and illustrations
assets/js/waveform.js      the hero trace
assets/js/publications.js  client-side rendering of the publication list
data/publications.json     generated from the team's PubMed RSS feed
scripts/fetch_pubmed.py    RSS -> data/publications.json
```

## Working on it

```sh
npm install
npm run dev      # rebuild assets/css/site.css on change
npm run build    # one-off minified build
python3 -m http.server   # then open http://localhost:8000
```

`assets/css/site.css` is a build artifact but is committed on purpose, so the page renders
from a plain `file://` open and from a branch-served Pages setup. Rerun `npm run build` and
commit the result whenever `index.html` or `src/input.css` changes.

## Design

One rule holds the page together, and it is worth knowing before editing:

> **Red is measured. Purple is modelled.**

Red marks the patient — the signal, the observed fact, the burden statistics. Purple marks the
team's own work — the twin, the method, the patents, the targets. The team's science is one
picture repeated (a measured trace and a simulated one, converging), so the site encodes that
distinction in colour and keeps to it everywhere, down to the medical/technology split in the
team roster. Both hexes are sampled from the parent unit's logo — the red heart and the purple
wordmark — since the team has no palette of its own. Tokens live once in `src/input.css` under
`@theme`, as `--color-measured` and `--color-modelled` (so, `text-modelled`, `bg-measured-light`
and friends).

The hero canvas (`assets/js/waveform.js`) is that picture, live: a schematic arterial trace with
a model-driven twin re-fitting onto it. It is **not patient data**, and the panel says so —
keep that label. It honours `prefers-reduced-motion` by rendering a settled frame instead.

Type is Source Serif 4 (display and body) with IBM Plex Mono (labels, data, nav) — the journal
register and the instrument register, which is the medical/technical duo the team is built on.
Both are self-hosted in `assets/fonts/`: no CDN, no network dependency, no request to Google
from a visitor's browser. To change or re-subset them, refetch the woff2 files and regenerate
`src/fonts.css`.

## Source material

`resources/` holds the presentations, logos and notes the content came from. It is
deliberately untracked — see `.gitignore`.
