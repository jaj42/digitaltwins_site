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
index.html              the whole site
src/input.css           Tailwind entry point + brand tokens (@theme)
assets/css/site.css     built stylesheet — committed, do not edit by hand
assets/img/             logos, marks and illustrations
assets/js/              client-side rendering of the publication list
data/publications.json  generated from the team's PubMed RSS feed
scripts/fetch_pubmed.py RSS -> data/publications.json
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

Brand colours are inherited from the parent unit's logo (the team has none of its own), sampled
from it and defined once in `src/input.css` under `@theme`
(`--color-brand-purple`, `--color-brand-red`), which makes them available as Tailwind
utilities such as `text-brand-purple`.

## Source material

`resources/` holds the presentations, logos and notes the content came from. It is
deliberately untracked — see `.gitignore`.
