import { describe, expect, it } from "vitest";

import remarkWriteUpContents from "@/lib/mdx/remark-write-up-contents.mjs";

type Node = {
  type: string;
  depth?: number;
  value?: string;
  alt?: string;
  children?: Node[];
  data?: { hProperties?: Record<string, unknown> };
};

function heading(title: string, depth = 2): Node {
  return { type: "heading", depth, children: [{ type: "text", value: title }] };
}

describe("write-up contents MDX transform", () => {
  it("gives only section headings server-rendered, focusable anchors and exports their outline", () => {
    const title = heading("Project title", 1);
    const section = heading("A design decision");
    const subsection = heading("The detail", 3);
    const minor = heading("Not in the outline", 4);
    const tree = {
      type: "root",
      children: [title, section, subsection, minor],
    };

    remarkWriteUpContents()(tree);

    expect(title.data).toBeUndefined();
    expect(minor.data).toBeUndefined();
    expect(section.data?.hProperties).toEqual({
      id: "section-a-design-decision",
      tabIndex: -1,
      "data-write-up-heading": "",
    });
    expect(subsection.data?.hProperties?.id).toBe("section-the-detail");
    expect(tree.children.at(-1)).toMatchObject({
      type: "mdxjsEsm",
      data: {
        estree: {
          body: [
            {
              declaration: {
                declarations: [
                  {
                    id: { name: "writeUpContents" },
                    init: {
                      elements: [
                        {
                          properties: [
                            {
                              key: { name: "id" },
                              value: { value: "section-a-design-decision" },
                            },
                            {
                              key: { name: "title" },
                              value: { value: "A design decision" },
                            },
                            { key: { name: "depth" }, value: { value: 2 } },
                          ],
                        },
                        expect.objectContaining({ type: "ObjectExpression" }),
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    });
  });

  it("handles repeated titles, punctuation, Unicode and empty slugs deterministically", () => {
    const headings = [
      heading("Colour & composition"),
      heading("Colour & composition"),
      heading("Colour composition-2"),
      heading("Colour & composition"),
      heading("Éclairage 日本語"),
      heading("!!!"),
      heading("???"),
    ];
    remarkWriteUpContents()({ type: "root", children: [...headings] });
    expect(headings.map((node) => node.data?.hProperties?.id)).toEqual([
      "section-colour-composition",
      "section-colour-composition-2",
      "section-colour-composition-2-2",
      "section-colour-composition-3",
      "section-éclairage-日本語",
      "section-untitled",
      "section-untitled-2",
    ]);
  });

  it("reads formatted titles, ignores embedded UI, and preserves authored IDs", () => {
    const formatted: Node = {
      type: "heading",
      depth: 3,
      children: [
        { type: "text", value: "Reading " },
        { type: "strong", children: [{ type: "text", value: "colour" }] },
        { type: "text", value: " with " },
        { type: "inlineCode", value: "LAB" },
      ],
    };
    const generated = heading("Custom");
    const authored = heading("Another title");
    authored.data = {
      hProperties: { id: "section-custom", className: "existing" },
    };
    const tree = {
      type: "root",
      children: [
        formatted,
        generated,
        authored,
        { type: "mdxJsxFlowElement", name: "InteractivePreview" },
      ],
    };
    remarkWriteUpContents()(tree);
    expect(formatted.data?.hProperties?.id).toBe(
      "section-reading-colour-with-lab",
    );
    expect(generated.data?.hProperties?.id).toBe("section-custom-2");
    expect(authored.data?.hProperties).toMatchObject({
      id: "section-custom",
      className: "existing",
    });
  });

  it("exports an empty outline for content without sections", () => {
    const tree = { type: "root", children: [heading("Title", 1)] };
    remarkWriteUpContents()(tree);
    expect(JSON.stringify(tree.children.at(-1))).toContain('"elements":[]');
  });
});
