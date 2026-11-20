import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeMath from "./rehypeMath";
import { maskMath } from "./segments";

const render = (md: string) => {
  const { text, math } = maskMath(md);
  return renderToStaticMarkup(
    <ReactMarkdown
      rehypePlugins={[[rehypeMath, { math }]]}
      components={{
        span: ({ node, ...props }) =>
          node?.properties?.dataTex !== undefined ? (
            <span data-math={String(node.properties.dataTex)} data-display={String(node.properties.dataDisplay)} />
          ) : (
            <span {...props} />
          ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
};

describe("math in rendered Markdown", () => {
  it("passes TeX through Markdown untouched", () => {
    const html = render("Sum: $a_1 + b_2$ and **bold**");
    expect(html).toContain('data-math="a_1 + b_2"');
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<em>");
  });

  it("marks displayed math and leaves code and money alone", () => {
    const html = render("$$\\frac{a}{b}$$\n\nRun `echo $x$` for $5 or $10.");
    expect(html).toContain('data-math="\\frac{a}{b}" data-display="true"');
    expect(html).toContain("<code>echo $x$</code>");
    expect(html).toContain("for $5 or $10.");
  });

  it("keeps an escaped dollar as a dollar instead of reading it as math", () => {
    const html = render("Price \\$5 and $x$.");
    expect(html).toContain("Price $5 and ");
    expect(html).toContain('data-math="x"');
    expect(html).not.toContain('data-math="5');
  });

  it("draws math inside emphasis and links, and keeps code blocks as written", () => {
    const html = render("**bold $y^2$** and [see $x$](https://example.com)\n\n    total = $a_1$\n");
    expect(html).toMatch(/<strong>bold <span data-math="y\^2"/);
    expect(html).toMatch(/<a href="https:\/\/example.com">see <span data-math="x"/);
    expect(html).toContain("<pre><code>total = $a_1$");
  });

  it("puts the source back in attributes such as alt text", () => {
    const html = render("![area $r^2$](pic.png)");
    expect(html).toContain('alt="area $r^2$"');
  });

  it("keeps a multi-line displayed formula whole, even with a line that looks like a list", () => {
    const html = render("$$\na\n- b\n$$");
    expect(html).toContain('data-display="true"');
    expect(html).not.toContain("<li>");
  });
});
