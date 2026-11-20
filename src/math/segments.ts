// Finding math in text: `$…$` inline and `$$…$$` displayed, with Pandoc's rules so that money
// ("$5 and $10") is left alone:
// - A `$` opens inline math only when a non-space follows it.
// - The first `$` after that closes it, and only if a non-space precedes it and no digit follows;
//   otherwise it is not math at all (Pandoc does not look further for another closing `$`).
// - Math never runs across a blank line (a new paragraph).
// - `\$` is a literal dollar.

export type MathSegment = { kind: "math"; tex: string; display: boolean };
export type Segment = { kind: "text"; text: string } | MathSegment;

/** Longest expression we convert; longer ones stay as text. */
export const MAX_TEX_LENGTH = 2000;

/**
 * TeX commands that can add links, classes, styles or load other extensions, or draw boxes of
 * any size (`\bbox`). Descriptions on public pages can be written by anyone, so math using
 * them is shown as source, not rendered. A TeX command name is letters only, so `\href0`
 * is `\href` followed by `0`: the name must not be followed by another letter.
 */
const UNSAFE_TEX =
  /\\(?:href|url|class|cssId|style|data|attr|require|html[a-zA-Z]*|mmlToken|unicode|bbox)(?![a-zA-Z])/;

export function isSafeTex(tex: string): boolean {
  return tex.length > 0 && tex.length <= MAX_TEX_LENGTH && !UNSAFE_TEX.test(tex);
}

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);

/** Does a run of whitespace (from `from` up to `to`) contain a blank line? */
const hasBlankLine = (text: string, from: number, to: number) => /\n[^\S\n]*\n/.test(text.slice(from, to));

/** Index of the `$` (or `$$`) that closes math opened just before `from`, or -1. */
function findClose(text: string, from: number, display: boolean): number {
  for (let j = from; j < text.length; j++) {
    const ch = text[j];
    if (ch === "\\") {
      j++; // skip the escaped character (TeX commands such as \$ or \{)
      continue;
    }
    if (isSpace(ch)) {
      let k = j;
      while (k < text.length && isSpace(text[k])) k++;
      if (hasBlankLine(text, j, k)) return -1; // a new paragraph ends the attempt
      if (!display && text[k] === "$") return -1; // a closing `$` must follow a non-space
      j = k - 1;
      continue;
    }
    if (ch !== "$") continue;
    if (display) {
      if (text[j + 1] === "$") return j;
      continue;
    }
    if (text[j + 1] === "$") return -1; // `$$` inside inline math: not ours
    return /[0-9]/.test(text[j + 1] ?? "") ? -1 : j; // `$5`: money, not a closing `$`
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

/** The expression written back as `$…$` or `$$…$$`. */
export const mathSource = (m: MathSegment): string => (m.display ? `$$${m.tex}$$` : `$${m.tex}$`);

// Tokens from Unicode's private use area, which Markdown treats as ordinary text.
const OPEN = "";
const CLOSE = "";
const TOKEN = /(\d+)/g;

/**
 * Markdown with each expression replaced by a token, so Markdown cannot touch the TeX (its `_`
 * and `*` are not emphasis, its `$` are not re-read later) and multi-line `$$…$$` stays in
 * one piece. Code is left as written. Put the math back with `unmaskMath`.
 */
export function maskMath(markdown: string): { text: string; math: MathSegment[] } {
  const math: MathSegment[] = [];
  const text = splitMath(markdown.replace(/[]/g, ""), { skipCode: true })
    .map((s) => (s.kind === "text" ? s.text : `${OPEN}${math.push(s) - 1}${CLOSE}`))
    .join("");
  return { text, math };
}

/** Split masked text into text and the math its tokens stand for. */
export function splitMasked(text: string, math: MathSegment[]): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const seg = math[Number(m[1])];
    if (!seg) continue;
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    out.push(seg);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Put the math back into masked text, written as `$…$` (or another way with `write`). */
export function unmaskMath(
  text: string,
  math: MathSegment[],
  write: (m: MathSegment) => string = mathSource
): string {
  return text.replace(TOKEN, (token, i) => (math[Number(i)] ? write(math[Number(i)]) : token));
}
