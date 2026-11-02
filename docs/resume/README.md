# Editing the public CV

`resume.json` is the editable source for `public/Dexter_Young_CV.pdf`.
`build_resume.py` recreates its A4 layout with the original Carlito typeface,
10 pt body text and 11.6 pt line spacing. It refuses content that would exceed
one page; shorten or select content instead of shrinking the type.

Install ReportLab (`python3 -m pip install reportlab`) and the open-source
Carlito regular, bold and italic TrueType fonts, then run from the repository:

```bash
python3 docs/resume/build_resume.py --font-dir /path/to/carlito
```

The generator also checks common Linux font locations and the Codex bundled
LibreOffice fonts. `RESUME_FONT_DIR` can supply another location. Use `--output`
to render a review copy without replacing the public file.

`variants.json` selects and orders the same source projects for software, applied
ML and interactive-media applications. It changes the opening and ordering, not
graduation, contribution, skill level or evaluation claims. Generate the two
role-specific downloads with the same type size and one-page overflow guard:

```bash
python3 docs/resume/build_resume.py --variant ml
python3 docs/resume/build_resume.py --variant interactive
```

These write `public/Dexter_Young_CV_ml.pdf` and
`public/Dexter_Young_CV_interactive.pdf`. The default software selection still
writes `public/Dexter_Young_CV.pdf`. Choose the appropriate file in an application;
the site keeps one coherent default. Skills such as C/C++ and Java are background
claims, not evidence of a shipped lower-level graphics system. Tailor them only
to existing coursework or projects the owner can discuss; do not invent a source
link or new experience to match a posting.

After editing, render the PDF to an image with Poppler and inspect it at normal
reading size. Check page count, links and text extraction before publishing:

```bash
pdftoppm -scale-to 1800 -png -singlefile public/Dexter_Young_CV.pdf /tmp/dexter-cv
pdfinfo public/Dexter_Young_CV.pdf
pdftotext public/Dexter_Young_CV.pdf -
```

The October 2026 revision uses the owner's confirmed Summer 2027 availability
and expected June 2028 graduation. It leads with the extension and bot, points
project titles to portfolio explanations, and removes obsolete image-cache and
reload-resumability wording. The former Bot or Not practice F1 values remain in
their original run artifacts and are contextualised on the project page; they
are not presented as independent generalisation results on this CV.

The November route update changes only project hyperlink destinations to the
canonical `/write-ups/` namespace; the former `/projects/` URLs remain redirects.
Regenerate all three downloads when changing these links in `resume.json`.

This is a software-focused selection. Secondary school, the Coursera course and
the combined Arnaud/Elliot entry were shortened or omitted to make room for the
bot and current engineering evidence. The original PDF had no editable source
in this repository. The replacement preserves its contact details, typography
and section hierarchy while making future changes reproducible.
