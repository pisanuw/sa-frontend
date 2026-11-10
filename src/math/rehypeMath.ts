// A rehype plugin that turns `$…$` and `$$…$$` in rendered Markdown text into
// `<span class="stem-math" data-tex="…" data-display="…">` elements, which AccessibleMarkdown
// draws with MathFormula. Run `protectMathInMarkdown` on the source first, so Markdown does not
// read the TeX's `_` and `*` as emphasis.

import type { Element, ElementContent, Root, RootContent } from "hast";
import { splitMath } from "./segments";

const SKIP = new Set(["code", "pre", "script", "style"]);

function expand(children: (ElementContent | RootContent)[]): (ElementContent | RootContent)[] {
  const out: (ElementContent | RootContent)[] = [];
  for (const child of children) {
    if (child.type === "text") {
      const parts = splitMath(child.value);
      if (!parts.some((p) => p.kind === "math")) {
        out.push(child);
        continue;
      }
      for (const p of parts) {
        if (p.kind === "text") out.push({ type: "text", value: p.text });
        else
          out.push({
            type: "element",
            tagName: "span",
            properties: { className: ["stem-math"], dataTex: p.tex, dataDisplay: p.display ? "true" : "false" },
            children: [{ type: "text", value: p.tex }],
          });
      }
    } else if (child.type === "element") {
      if (!SKIP.has(child.tagName)) (child as Element).children = expand(child.children) as ElementContent[];
      out.push(child);
    } else out.push(child);
  }
  return out;
}

export default function rehypeMath() {
  return (tree: Root) => {
    tree.children = expand(tree.children) as RootContent[];
  };
}
