# Editing the public CV

`resume.json` holds shared facts and project bullets; `variants.json` selects four
projects and the opening sentence for each application lane. `template.tex` is
the Jake Gutierrez layout, imported from the owner's editable LaTeX source with
its MIT notice preserved. It keeps the existing US Letter page, Computer Modern
type, 11 pt document size, and visibly underlined project links.

`build_resume.py` escapes JSON content into that single template and compiles it
with pdfLaTeX twice in a temporary directory. It rejects multiple pages and
overfull boxes before atomically replacing the requested output. Shorten or select
content instead of shrinking the type. ReportLab and Carlito are no longer used.

## Build

Use Python 3 and pdfLaTeX from MacTeX/BasicTeX or TeX Live. A minimal TeX installation
also needs the `preprint` (for `fullpage`), `titlesec`, `marvosym`, `enumitem` and
`fancyhdr` packages, in addition to the standard LaTeX tools, fonts and `hyperref`.
Install missing packages through your TeX package manager, for example
`tlmgr install preprint titlesec marvosym enumitem fancyhdr` with suitable local
permissions. Do not change production or hosting dependencies for this local build.

Run from the repository:

```bash
python3 docs/resume/build_resume.py
python3 docs/resume/build_resume.py --variant ml
python3 docs/resume/build_resume.py --variant interactive
```

The script also works from another directory when invoked by its absolute path.
Use `--output /path/to/review.pdf` to review a build without replacing a public file.

| Variant              | Public output                            | Projects in order                                                      |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `software` (default) | `public/Dexter_Young_CV.pdf`             | Grailed Plus, Discord Shoot Manager, Photo Node-Gallery, Elliot Mairet |
| `ml`                 | `public/Dexter_Young_CV_ml.pdf`          | Bot or Not, Grailed Plus, Photo Node-Gallery, Discord Shoot Manager    |
| `interactive`        | `public/Dexter_Young_CV_interactive.pdf` | bur1alrites, Photo Node-Gallery, Grailed Plus, Discord Shoot Manager   |

The portfolio keeps its existing `/Dexter_Young_CV.pdf` download URL. Regenerate all
three outputs when shared facts, bullets, links or layout change. The six-project
library remains available for tailoring; each application receives four entries.

## Checks

Run the offline generator and content regression tests:

```bash
python3 -m unittest discover -s docs/resume
npx vitest run tests/unit/resume-evidence.test.ts
npm run check
npm run test:e2e -- tests/e2e/resume-download.spec.ts
```

After building, inspect each PDF at normal reading size. Verify one US Letter
page, no clipping, sensible text extraction order and working contact/project
links. Poppler provides an optional inspection workflow (repeat for each variant):

```bash
pdftoppm -scale-to 1800 -png -singlefile public/Dexter_Young_CV.pdf /path/to/review/dexter-cv
pdfinfo public/Dexter_Young_CV.pdf
pdftotext public/Dexter_Young_CV.pdf -
```

## Fact and evidence boundaries

The owner confirmed Summer 2027 availability, expected June 2028 graduation, and
the TVM progression: Assistant Technical Director in March–May 2026, then Technical
Director from June 2026. Contact details match the current Jake-template source,
not the superseded ReportLab JSON.

Project bullets lead with what the software does, followed by specific engineering
behaviour. Photo Graph's 100-photo/seven-search comparison describes the saved
benchmark, not the current catalogue size or a broad retrieval-quality result.
Bot or Not includes the checked-in practice-data overlap audit; historical practice
F1 values remain in their original artifacts and are not independent performance
claims here. Shard-grouped validation does not imply group-aware internal calibration.

Skills such as C/C++ and Java are background claims, not evidence of a shipped
lower-level graphics system. Do not invent experience, adoption, time savings,
performance figures or work authorization to match a posting.
