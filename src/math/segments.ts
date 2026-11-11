// Finding math in text: `$…$` inline and `$$…$$` displayed, with Pandoc's rules so that money
// ("$5 and $10") is left alone. A `$` opens inline math only when a non-space follows it, and
// closes it only when a non-space precedes it and no digit follows. `\$` is a literal dollar.

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "math"; tex: string; display: boolean };

/** Longest expression we convert; longer ones stay as text. */
export const MAX_TEX_LENGTH = 2000;

/**
 * TeX commands that can add links, classes, styles or load other extensions. Descriptions on
 * public pages can be written by anyone, so math using them is shown as source, not rendered.
 */
const UNSAFE_TEX = /\\(?:href|url|class|cssId|style|data|attr|require|html\w*|mmlToken|unicode)\b/;

export function isSafeTex(tex: string): boolean {
  return tex.length > 0 && tex.length <= MAX_TEX_LENGTH && !UNSAFE_TEX.test(tex);
}

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);

/** Index of the `$` (or `$$`) that closes math opened just before `from`, or -1. */
function findClose(text: string, from: number, display: boolean): number {
  for (let j = from; j < text.length; j++) {
    const ch = text[j];
    if (ch === "\\") {
      j++; // skip the escaped character (TeX commands such as \$ or \{)
      continue;
    }
    if (ch !== "$") continue;
    if (display) {
      if (text[j + 1] === "$") return j;
      continue;
    }
    if (text[j + 1] === "$") return -1; // `$$` inside inline math: not ours
    if (!isSpace(text[j - 1]) && !/[0-9]/.test(text[j + 1] ?? "")) return j;
  }
  return -1;
}

type Options = {
  /** Leave `code spans` and ``` fenced blocks alone (for Markdown source). */
  skipCode?: boolean;
};

/** Split text into plain text and math. Unclosed or empty delimiters stay as text. */
export function splitMath(text: string, options: Options = {}): Segment[] {
  const out: Segment[] = [];
  let buf = "";
  const pushText = (s: string) => {
    buf += s;
  };
  const flush = () => {
    if (buf) out.push({ kind: "text", text: buf });
    buf = "";
  };

  let i = 0;
  let inFence = false;
  while (i < text.length) {
    const ch = text[i];

    if (options.skipCode) {
      const lineStart = i === 0 || text[i - 1] === "\n";
      if (lineStart && /^ {0,3}(```|~~~)/.test(text.slice(i, i + 6))) {
        inFence = !inFence;
      }
      if (inFence) {
        const end = text.indexOf("\n", i);
        const stop = end === -1 ? text.length : end + 1;
        pushText(text.slice(i, stop));
        i = stop;
        continue;
      }
      if (ch === "`") {
        let n = 0;
        while (text[i + n] === "`") n++;
        const fence = "`".repeat(n);
        const close = text.indexOf(fence, i + n);
        if (close !== -1) {
          pushText(text.slice(i, close + n));
          i = close + n;
          continue;
        }
      }
    }

    if (ch === "\\" && text[i + 1] === "$") {
      pushText("\\$");
      i += 2;
      continue;
    }

    if (ch === "$") {
      const display = text[i + 1] === "$";
      const start = i + (display ? 2 : 1);
      if (display || !isSpace(text[start])) {
        const close = findClose(text, start, display);
        const tex = close === -1 ? "" : text.slice(start, close).trim();
        if (close !== -1 && tex) {
          flush();
          out.push({ kind: "math", tex, display });
          i = close + (display ? 2 : 1);
          continue;
        }
      }
      // Not math: keep the dollar sign(s) as text.
      pushText(display ? "$$" : "$");
      i += display ? 2 : 1;
      continue;
    }

    pushText(ch);
    i++;
  }
  flush();
  return out;
}

export const hasMath = (text: string | null | undefined): boolean =>
  !!text && splitMath(text, { skipCode: true }).some((s) => s.kind === "math");

/**
 * Markdown source with every ASCII punctuation mark inside math backslash-escaped, so Markdown
 * passes the TeX through untouched (`a_1 b_2` would otherwise become emphasis, `\{` a brace).
 */
export function protectMathInMarkdown(markdown: string): string {
  return splitMath(markdown, { skipCode: true })
    .map((s) => {
      if (s.kind === "text") return s.text;
      const d = s.display ? "$$" : "$";
      return d + s.tex.replace(/[!-/:-@[-`{-~]/g, (c) => "\\" + c) + d;
    })
    .join("");
}
