// A rehype plugin that turns the math tokens left by `maskMath` into
// `<span class="stem-math" data-tex="…" data-display="…">` elements, which AccessibleMarkdown
// draws with MathFormula. Markdown never sees the TeX, so it cannot turn `_` into emphasis or
// `\$` into a dollar that is then read as math. Inside code, and in attributes such as an
// image's alt text, the tokens become the original `$…$` again.

import type { Element, ElementContent, Properties, Root, RootContent } from "hast";
import { splitMasked, unmaskMath, type MathSegment } from "./segments";

const SKIP = new Set(["code", "pre", "script", "style"]);

type Options = { math: MathSegment[] };

export default function rehypeMath({ math }: Options) {
  const restoreProperties = (props: Properties | undefined) => {
    if (!props) return;
    for (const [k, v] of Object.entries(props)) {
      if (typeof v === "string") props[k] = unmaskMath(v, math);
      else if (Array.isArray(v)) props[k] = v.map((x) => (typeof x === "string" ? unmaskMath(x, math) : x));
    }
  };

  /** Inside code: the tokens become the source text again. */
  const restore = (nodes: ElementContent[]) => {
    for (const node of nodes) {
      if (node.type === "text") node.value = unmaskMath(node.value, math);
      else if (node.type === "element") {
        restoreProperties(node.properties);
        restore(node.children);
      }
    }
  };

  const expand = (children: (ElementContent | RootContent)[]): (ElementContent | RootContent)[] => {
    const out: (ElementContent | RootContent)[] = [];
    for (const child of children) {
      if (child.type === "text") {
        for (const p of splitMasked(child.value, math)) {
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
        const el = child as Element;
        restoreProperties(el.properties);
        if (SKIP.has(el.tagName)) restore(el.children);
        else el.children = expand(el.children) as ElementContent[];
        out.push(el);
      } else out.push(child);
    }
    return out;
  };

  return (tree: Root) => {
    tree.children = expand(tree.children) as RootContent[];
  };
}
