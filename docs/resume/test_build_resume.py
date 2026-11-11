"""Offline generator tests: python3 -m unittest discover -s docs/resume."""

import copy
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from build_resume import SOURCE, build_pdf, latex_escape, render_resume


class ResumeRenderingTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(SOURCE.read_text())
        self.variants = json.loads(SOURCE.with_name("variants.json").read_text())

    def test_escapes_content_without_interpreting_latex(self):
        self.assertEqual(
            latex_escape(r"A&B $15,000 50% #1_{x} \ ~ ^ – —"),
            r"A\&B \$15,000 50\% \#1\_\{x\} \textbackslash{} \textasciitilde{} \textasciicircum{} -- ---",
        )

    def test_each_variant_renders_four_underlined_links_and_current_facts(self):
        for variant in self.variants.values():
            with self.subTest(variant=variant["title"]):
                document = render_resume(self.data, variant)
                self.assertNotIn("@@", document)
                self.assertIn(r"\documentclass[letterpaper,11pt]", document)
                self.assertIn(r"\pdfgentounicode=1", document)
                self.assertIn("Copyright (c) 2020 Jake Gutierrez", document)
                self.assertIn("+1 (438) 407-6487", document)
                self.assertIn("June 2026 -- Present", document)
                self.assertIn("Mar. -- May 2026", document)
                self.assertIn("2024 -- June 2028 (expected)", document)
                previous = -1
                for title in variant["projects"]:
                    position = document.index(r"\underline{" + title + "}")
                    self.assertGreater(position, previous)
                    previous = position
                for project in self.data["projects"]:
                    if project["title"] not in variant["projects"]:
                        self.assertNotIn(project["href"], document)

    def test_rejects_invalid_project_selections(self):
        variant = self.variants["software"]
        for titles in (
            variant["projects"][:3],
            [variant["projects"][0]] * 4,
            [*variant["projects"][:3], "Unknown project"],
        ):
            with self.subTest(titles=titles):
                invalid = copy.deepcopy(variant)
                invalid["projects"] = titles
                with self.assertRaisesRegex(ValueError, "four distinct"):
                    render_resume(self.data, invalid)


class ResumeBuildTests(unittest.TestCase):
    def compile_result(self, log, returncode=0):
        def run(command, *, cwd, **kwargs):
            work = Path(cwd)
            (work / "resume.log").write_text(log)
            (work / "resume.pdf").write_bytes(b"new PDF")
            self.assertIn("-no-shell-escape", command)
            return subprocess.CompletedProcess(command, returncode, "compiler output", "")
        return run

    def test_failed_or_overflowing_build_preserves_existing_download(self):
        cases = (
            ("", 1, "pdfLaTeX failed"),
            ("Output written on resume.pdf (2 pages, 100 bytes).", 0, "one page"),
            ("Output written on resume.pdf (1 page, 100 bytes).\nOverfull \\hbox", 0, "overflowing"),
            ("Output written on resume.pdf (1 page, 100 bytes).\nOverfull \\vbox", 0, "overflowing"),
            ("No page count", 0, "one page"),
        )
        for log, returncode, message in cases:
            with self.subTest(message=message), TemporaryDirectory() as directory:
                output = Path(directory) / "existing.pdf"
                output.write_bytes(b"existing PDF")
                with patch("build_resume.shutil.which", return_value="pdflatex"), patch(
                    "build_resume.subprocess.run", side_effect=self.compile_result(log, returncode)
                ), self.assertRaisesRegex(RuntimeError, message):
                    build_pdf("document", output)
                self.assertEqual(output.read_bytes(), b"existing PDF")
                self.assertEqual(list(Path(directory).iterdir()), [output])

    def test_valid_build_replaces_download_after_both_passes(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "nested" / "resume.pdf"
            with patch("build_resume.shutil.which", return_value="pdflatex"), patch(
                "build_resume.subprocess.run",
                side_effect=self.compile_result("Output written on resume.pdf (1 page, 100 bytes)."),
            ) as compiler:
                build_pdf("document", output)
            self.assertEqual(compiler.call_count, 2)
            self.assertEqual(output.read_bytes(), b"new PDF")
            self.assertEqual(list(output.parent.iterdir()), [output])

    def test_missing_compiler_explains_dependency(self):
        with patch("build_resume.shutil.which", return_value=None), self.assertRaisesRegex(
            RuntimeError, "pdfLaTeX not found"
        ):
            build_pdf("document", Path("unused.pdf"))


if __name__ == "__main__":
    unittest.main()
