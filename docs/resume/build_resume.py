"""Build a one-page Jake-template CV from the shared JSON content using pdfLaTeX.

Run: python3 docs/resume/build_resume.py [--variant software|ml|interactive]
Use --output /path/to/review.pdf to leave the public download unchanged.
"""

from argparse import ArgumentParser
import json
from pathlib import Path
import re
import shutil
import subprocess
from tempfile import NamedTemporaryFile, TemporaryDirectory


ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).with_name("resume.json")
TEMPLATE = Path(__file__).with_name("template.tex")


def latex_escape(text):
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
        "–": "--",
        "—": "---",
    }
    return "".join(replacements.get(character, character) for character in text)


def item_list(bullets):
    return "\n".join([
        r"\resumeItemListStart",
        *(rf"\resumeItem{{{latex_escape(text)}}}" for text in bullets),
        r"\resumeItemListEnd",
    ])


def render_resume(data, variant):
    projects = {project["title"]: project for project in data["projects"]}
    titles = variant["projects"]
    if len(titles) != 4 or len(set(titles)) != len(titles) or any(
        title not in projects for title in titles
    ):
        raise ValueError("Each variant must select four distinct, existing projects")

    contact = []
    for item in data["contact"]:
        label = latex_escape(item["label"])
        if item.get("href"):
            label = rf"\href{{{latex_escape(item['href'])}}}{{\underline{{{label}}}}}"
        contact.append(label)

    education = data["education"]
    experience = data["experience"]
    roles = []
    for index, role in enumerate(experience["roles"]):
        title, date = latex_escape(role["title"]), latex_escape(role["date"])
        if index == 0:
            roles.append(
                rf"\resumeSubheading{{{latex_escape(experience['title'])}}}"
                rf"{{{latex_escape(experience['location'])}}}{{{title}}}{{{date}}}"
            )
        else:
            roles.append(rf"\resumeSubSubheading{{{title}}}{{{date}}}")
        roles.append(item_list(role["bullets"]))

    entries = []
    for title in titles:
        project = projects[title]
        heading = (
            rf"\textbf{{\href{{{latex_escape(project['href'])}}}"
            rf"{{\underline{{{latex_escape(title)}}}}}}} $|$ "
            rf"\emph{{{latex_escape(project['technologies'])}}}"
        )
        entries.append(rf"\resumeProjectHeading{{{heading}}}{{{latex_escape(project['date'])}}}")
        entries.append(item_list(project["bullets"]))

    values = {
        "NAME": latex_escape(data["name"]),
        "TITLE": latex_escape(variant["title"]),
        "CONTACT": " $|$ ".join(contact),
        "PROFILE": latex_escape(variant["profile"]),
        "EDUCATION": (
            rf"\resumeSubheading{{{latex_escape(education['title'])}}}"
            rf"{{{latex_escape(education['location'])}}}"
            rf"{{{latex_escape(education['subtitle'])}}}{{{latex_escape(education['date'])}}}"
        ),
        "EXPERIENCE": "\n".join(roles),
        "PROJECTS": "\n".join(entries),
        "ADDITIONAL": "\n".join(
            rf"\resumeItem{{\textbf{{{latex_escape(item['label'])}}}, {latex_escape(item['text'])}}}"
            for item in data["additional"]
        ),
        "SKILLS": " \\\\\n".join(
            rf"\textbf{{{latex_escape(item['label'])}}}: {latex_escape(item['text'])}"
            for item in data["skills"]
        ),
    }
    return re.sub(r"@@([A-Z]+)@@", lambda match: values[match[1]], TEMPLATE.read_text())


def build_pdf(document, output):
    compiler = shutil.which("pdflatex")
    if compiler is None:
        raise RuntimeError("pdfLaTeX not found. Install MacTeX/BasicTeX or TeX Live; see docs/resume/README.md.")

    with TemporaryDirectory(prefix="dexter-resume-") as directory:
        work = Path(directory)
        (work / "resume.tex").write_text(document)
        for _ in range(2):
            result = subprocess.run(
                [compiler, "-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error",
                 "-file-line-error", "resume.tex"],
                cwd=work, capture_output=True, text=True, timeout=60,
            )
            if result.returncode:
                raise RuntimeError("pdfLaTeX failed:\n" + result.stdout[-6000:] + result.stderr)

        log = (work / "resume.log").read_text()
        pages = re.search(r"Output written on resume\.pdf \((\d+) pages?\b", log)
        if not pages or int(pages[1]) != 1:
            raise RuntimeError("Resume must fit one page. Shorten content; do not shrink type.")
        if re.search(r"Overfull \\[hv]box", log):
            raise RuntimeError("Resume has overflowing content. Shorten the affected text; do not shrink type.")

        # Replace only after successful compilation and layout checks. Keep a failed
        # build from truncating the existing public download.
        output.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(dir=output.parent, prefix=".resume-", suffix=".pdf", delete=False) as staged:
            staged_path = Path(staged.name)
        try:
            shutil.copyfile(work / "resume.pdf", staged_path)
            staged_path.chmod(0o644)
            staged_path.replace(output)
        finally:
            staged_path.unlink(missing_ok=True)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--variant", choices=("software", "ml", "interactive"), default="software")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or ROOT / "public" / (
        "Dexter_Young_CV.pdf" if args.variant == "software" else f"Dexter_Young_CV_{args.variant}.pdf"
    )
    data = json.loads(SOURCE.read_text())
    variant = json.loads(SOURCE.with_name("variants.json").read_text())[args.variant]
    try:
        build_pdf(render_resume(data, variant), output)
    except (ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
        raise SystemExit(str(error)) from error
    print(f"Wrote {output} (one US Letter page; Jake template)")


if __name__ == "__main__":
    main()
