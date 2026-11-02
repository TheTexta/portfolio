"""Build the public one-page CV from resume.json using ReportLab and Carlito.

Run from any directory: python3 docs/resume/build_resume.py --font-dir /path/to/Carlito
The default output is public/Dexter_Young_CV.pdf. See README.md beside this script.
"""

from argparse import ArgumentParser
from html import escape
import json
import os
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).with_name("resume.json")
NAVY = colors.HexColor("#213F68")
MARGIN = 35.1
WIDTH, HEIGHT = A4
CONTENT_WIDTH = WIDTH - 2 * MARGIN


def font_directory(explicit):
    candidates = [
        Path(explicit) if explicit else None,
        Path(os.environ["RESUME_FONT_DIR"]) if os.environ.get("RESUME_FONT_DIR") else None,
        Path("/usr/share/fonts/truetype/crosextra"),
        Path("/usr/share/fonts/truetype/carlito"),
        Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/native/"
        "libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype",
    ]
    for candidate in candidates:
        if candidate and all((candidate / name).exists() for name in (
            "Carlito-Regular.ttf", "Carlito-Bold.ttf", "Carlito-Italic.ttf"
        )):
            return candidate
    raise SystemExit("Carlito fonts not found. Set --font-dir or RESUME_FONT_DIR; see docs/resume/README.md.")


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--font-dir")
    parser.add_argument("--variant", choices=("software", "ml", "interactive"), default="software")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.output is None:
        filename = "Dexter_Young_CV.pdf" if args.variant == "software" else f"Dexter_Young_CV_{args.variant}.pdf"
        args.output = ROOT / "public" / filename
    fonts = font_directory(args.font_dir)
    for name, filename in (
        ("Carlito", "Carlito-Regular.ttf"),
        ("Carlito-Bold", "Carlito-Bold.ttf"),
        ("Carlito-Italic", "Carlito-Italic.ttf"),
    ):
        pdfmetrics.registerFont(TTFont(name, str(fonts / filename)))
    pdfmetrics.registerFontFamily("Carlito", normal="Carlito", bold="Carlito-Bold", italic="Carlito-Italic")
    data = json.loads(SOURCE.read_text())
    variant = json.loads(SOURCE.with_name("variants.json").read_text())[args.variant]
    projects = {project["title"]: project for project in data["projects"]}
    if len(set(variant["projects"])) != len(variant["projects"]) or any(
        title not in projects for title in variant["projects"]
    ):
        raise SystemExit("Variant contains duplicate or unknown project titles")
    data["profile"] = variant["profile"]
    data["projects"] = [projects[title] for title in variant["projects"]]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas = Canvas(str(args.output), pagesize=A4, pageCompression=1, invariant=1)
    canvas.setTitle(f"Dexter Young - {variant['title']} CV")
    canvas.setAuthor("Dexter Young")
    canvas.setSubject("Summer 2027 internships; expected graduation June 2028")
    body = ParagraphStyle("body", fontName="Carlito", fontSize=10, leading=11.6, alignment=TA_LEFT)
    y = HEIGHT - 43

    def paragraph(text, *, font="Carlito", size=10, leading=11.6, indent=0):
        nonlocal y
        style = ParagraphStyle("line", parent=body, fontName=font, fontSize=size, leading=leading)
        item = Paragraph(text, style)
        _, height = item.wrap(CONTENT_WIDTH - indent, HEIGHT)
        item.drawOn(canvas, MARGIN + indent, y - height + size)
        y -= height

    def section(title):
        nonlocal y
        y -= 7
        canvas.setFillColor(NAVY)
        canvas.setFont("Carlito-Bold", 10.5)
        canvas.drawString(MARGIN, y, title)
        canvas.setStrokeColor(NAVY)
        canvas.setLineWidth(0.4)
        canvas.line(MARGIN, y - 4, WIDTH - MARGIN, y - 4)
        canvas.setFillColor(colors.black)
        y -= 16.2

    def heading(item):
        nonlocal y
        canvas.setFillColor(colors.black)
        canvas.setFont("Carlito-Bold", 10)
        canvas.drawString(MARGIN, y, item["title"])
        if item.get("href"):
            title_width = pdfmetrics.stringWidth(item["title"], "Carlito-Bold", 10)
            canvas.linkURL(item["href"], (MARGIN, y - 2, MARGIN + title_width, y + 9), relative=0)
        canvas.setFont("Carlito", 10)
        canvas.drawRightString(WIDTH - MARGIN, y, item["date"])
        y -= 11.6
        paragraph(escape(item["subtitle"]), font="Carlito-Italic")

    def bullet(text, *, markup=False):
        nonlocal y
        canvas.setFont("Carlito", 10)
        canvas.drawString(MARGIN + 2.5, y, "\u2022")
        paragraph(text if markup else escape(text), indent=10)
        y -= 0.6

    canvas.setFillColor(NAVY)
    canvas.setFont("Carlito-Bold", 17)
    canvas.drawString(MARGIN, y, data["name"])
    y -= 15.3
    contact = []
    for item in data["contact"]:
        label = escape(item["label"])
        if item.get("href"):
            label = f'<link href="{escape(item["href"], quote=True)}" color="#213F68"><u>{label}</u></link>'
        contact.append(label)
    paragraph("  |  ".join(contact), size=9, leading=10.4)
    canvas.setStrokeColor(NAVY)
    canvas.setLineWidth(0.8)
    canvas.line(MARGIN, y + 2, WIDTH - MARGIN, y + 2)
    y -= 7

    section("PROFILE")
    paragraph(escape(data["profile"]))
    section("EDUCATION")
    heading(data["education"])
    section("TECHNICAL EXPERIENCE")
    heading(data["experience"])
    for text in data["experience"]["bullets"]:
        bullet(text)
    section("SOFTWARE AND CREATIVE TECHNOLOGY PROJECTS")
    for index, project in enumerate(data["projects"]):
        if index:
            y -= 3
        heading(project)
        for text in project["bullets"]:
            bullet(text)
    section("ADDITIONAL EXPERIENCE AND LEADERSHIP")
    for item in data["additional"]:
        bullet(f'<b>{escape(item["label"])}:</b> {escape(item["text"])}', markup=True)
    section("TECHNICAL SKILLS")
    for item in data["skills"]:
        paragraph(f'<b>{escape(item["label"])}:</b> {escape(item["text"])}')
    if y < MARGIN:
        raise SystemExit(f"Resume exceeds one-page content area by {MARGIN - y:.1f}pt. Shorten content; do not shrink type.")
    canvas.showPage()
    canvas.save()
    print(f"Wrote {args.output} (one A4 page; bottom text baseline approximately {y:.1f}pt)")


if __name__ == "__main__":
    main()
