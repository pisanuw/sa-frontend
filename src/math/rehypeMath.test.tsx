import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeMath from "./rehypeMath";
import { protectMathInMarkdown } from "./segments";

const render = (md: string) =>
  renderToStaticMarkup(
    <ReactMarkdown
      rehypePlugins={[rehypeMath]}
      components={{
        span: ({ node, ...props }) =>
          node?.properties?.dataTex !== undefined ? (
            <span data-math={String(node.properties.dataTex)} data-display={String(node.properties.dataDisplay)} />
          ) : (
            <span {...props} />
          ),
      }}
    >
      {protectMathInMarkdown(md)}
    </ReactMarkdown>
  );

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
});
