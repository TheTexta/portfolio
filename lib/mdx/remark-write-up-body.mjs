// Keep authored headers separate from measured content without rewriting MDX.
export default function remarkWriteUpBody() {
  return (tree) => {
    const headerIndex = tree.children.findIndex(
      (node) =>
        node.type === "mdxJsxFlowElement" &&
        node.name === "header" &&
        node.attributes?.some(
          (attribute) => attribute.name === "data-write-up-header",
        ),
    );
    if (headerIndex < 0) return;

    const afterHeader = tree.children.splice(headerIndex + 1);
    tree.children.push(
      {
        type: "mdxJsxFlowElement",
        name: "WriteUpBody",
        attributes: [],
        children: afterHeader.filter((node) => node.type !== "mdxjsEsm"),
      },
      ...afterHeader.filter((node) => node.type === "mdxjsEsm"),
    );
  };
}
