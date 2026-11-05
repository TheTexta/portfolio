// One MDX pass supplies both the server-rendered anchors and the sidebar export.
export default function remarkWriteUpContents() {
  return (tree) => {
    const headings = [];
    function visit(node) {
      if (node.type === "heading" && (node.depth === 2 || node.depth === 3))
        headings.push(node);
      node.children?.forEach(visit);
    }
    function text(node) {
      if (
        node.type === "text" ||
        node.type === "inlineCode" ||
        node.type === "inlineMath"
      )
        return node.value;
      if (node.type === "image") return node.alt ?? "";
      return node.children?.map(text).join("") ?? "";
    }
    visit(tree);

    const used = new Set(
      headings.flatMap((node) =>
        node.data?.hProperties?.id ? [String(node.data.hProperties.id)] : [],
      ),
    );
    const entries = headings.map((node) => {
      const title = text(node).replace(/\s+/gu, " ").trim();
      const slug = title
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
        .trim()
        .replace(/[\s-]+/gu, "-");
      const base = `section-${slug || "untitled"}`;
      let id = node.data?.hProperties?.id;
      if (!id) {
        id = base;
        for (let suffix = 2; used.has(id); suffix++) id = `${base}-${suffix}`;
        used.add(id);
      }
      node.data ??= {};
      node.data.hProperties = {
        ...node.data.hProperties,
        id,
        tabIndex: -1,
        "data-write-up-heading": "",
      };
      return { id, title, depth: node.depth };
    });

    tree.children.push({
      type: "mdxjsEsm",
      value: "",
      data: {
        estree: {
          type: "Program",
          sourceType: "module",
          body: [
            {
              type: "ExportNamedDeclaration",
              specifiers: [],
              source: null,
              declaration: {
                type: "VariableDeclaration",
                kind: "const",
                declarations: [
                  {
                    type: "VariableDeclarator",
                    id: { type: "Identifier", name: "writeUpContents" },
                    init: {
                      type: "ArrayExpression",
                      elements: entries.map((entry) => ({
                        type: "ObjectExpression",
                        properties: Object.entries(entry).map(
                          ([name, value]) => ({
                            type: "Property",
                            kind: "init",
                            method: false,
                            shorthand: false,
                            computed: false,
                            key: { type: "Identifier", name },
                            value: { type: "Literal", value },
                          }),
                        ),
                      })),
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    });
  };
}
