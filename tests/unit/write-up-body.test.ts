import { describe, expect, it } from "vitest";

import remarkWriteUpBody from "@/lib/mdx/remark-write-up-body.mjs";
import remarkWriteUpContents from "@/lib/mdx/remark-write-up-contents.mjs";

describe("write-up content boundary", () => {
  it("separates the article header from its prose and preview, preserving module declarations", () => {
    const imports = {
      type: "mdxjsEsm",
      value: 'import Example from "./example";',
    };
    const header = {
      type: "mdxJsxFlowElement",
      name: "header",
      attributes: [
        { type: "mdxJsxAttribute", name: "data-write-up-header", value: null },
      ],
      children: [
        {
          type: "heading",
          depth: 1,
          children: [{ type: "text", value: "Project title" }],
        },
      ],
    };
    const preview = {
      type: "mdxJsxFlowElement",
      name: "ProjectPreview",
      attributes: [],
      children: [],
    };
    const section = {
      type: "heading",
      depth: 2,
      children: [{ type: "text", value: "A section" }],
    };
    const lateExport = { type: "mdxjsEsm", value: "export const example = 1;" };
    const tree = {
      type: "root",
      children: [imports, header, preview, section, lateExport],
    };

    remarkWriteUpContents()(tree);
    remarkWriteUpBody()(tree);

    expect(tree.children.slice(0, 2)).toEqual([imports, header]);
    expect(tree.children[2]).toMatchObject({
      type: "mdxJsxFlowElement",
      name: "WriteUpBody",
      children: [preview, section],
    });
    expect(tree.children[3]).toBe(lateExport);
    expect(tree.children[4]).toMatchObject({ type: "mdxjsEsm" });
    expect(section).toMatchObject({
      data: { hProperties: { id: "section-a-section" } },
    });
  });

  it("does not wrap unrelated MDX without an authored write-up header", () => {
    const paragraph = {
      type: "paragraph",
      children: [{ type: "text", value: "Content" }],
    };
    const tree = { type: "root", children: [paragraph] };
    remarkWriteUpBody()(tree);
    expect(tree.children).toEqual([paragraph]);
  });
});
