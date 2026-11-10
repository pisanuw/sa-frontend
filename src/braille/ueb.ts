// Uncontracted (grade 1) Unified English Braille, translated in the browser.
//
// Covers what STEM-Accessibility's own text uses: letters (with accents), Greek letters,
// capitals (letter, word and passage), numbers with the numeric indicator, the grade 1
// indicator before a-j after a digit, and common punctuation, math signs and arrows.
// Output is Unicode braille (U+2800 block) with ordinary spaces and newlines kept, so a
// formatter can wrap it. The expected outputs in ueb.test.ts come from liblouis 3.29
// (`en-ueb-g1.ctb`), the reference translator used by most braille software.
//
// Contracted (grade 2) braille needs a full rule engine; use liblouis for that.

/** Cells from dot numbers, one cell per space-separated group: c("6 36") is ⠠⠤. */
function c(spec: string): string {
  return spec
    .split(" ")
    .map((g) =>
      String.fromCharCode(0x2800 + [...g].reduce((mask, d) => mask | (1 << (Number(d) - 1)), 0))
    )
    .join("");
}

export const CELL = {
  capital: c("6"),
  capsWord: c("6 6"),
  capsPassage: c("6 6 6"),
  capsTerminator: c("6 3"),
  numeric: c("3456"),
  grade1: c("56"),
  greek: c("46"),
  superscript: c("56 35"),
  subscript: c("56 26"),
  unknown: c("123456"),
} as const;

const LETTER_DOTS: Record<string, string> = {
  a: "1", b: "12", c: "14", d: "145", e: "15", f: "124", g: "1245", h: "125", i: "24", j: "245",
  k: "13", l: "123", m: "134", n: "1345", o: "135", p: "1234", q: "12345", r: "1235", s: "234",
  t: "2345", u: "136", v: "1236", w: "2456", x: "1346", y: "13456", z: "1356",
};
const LETTER: Record<string, string> = Object.fromEntries(
  Object.entries(LETTER_DOTS).map(([k, v]) => [k, c(v)])
);

/** Digits are the letters a-j after the numeric indicator. */
const DIGIT: Record<string, string> = Object.fromEntries(
  "1234567890".split("").map((d, i) => [d, LETTER["abcdefghij"[i]]])
);

/** Greek letters: the Greek indicator, then this cell. */
const GREEK: Record<string, string> = {
  α: LETTER.a, β: LETTER.b, γ: LETTER.g, δ: LETTER.d, ε: LETTER.e, ζ: LETTER.z, η: c("156"),
  θ: c("1456"), ι: LETTER.i, κ: LETTER.k, λ: LETTER.l, μ: LETTER.m, ν: LETTER.n, ξ: LETTER.x,
  ο: LETTER.o, π: LETTER.p, ρ: LETTER.r, σ: LETTER.s, ς: LETTER.s, τ: LETTER.t, υ: LETTER.u,
  φ: LETTER.f, χ: c("12346"), ψ: LETTER.y, ω: LETTER.w,
};

/** Accents, as combining marks after NFD; the modifier is written before the letter. */
const MODIFIER: Record<string, string> = {
  "\u0301": c("45 34"), // acute
  "\u0300": c("45 16"), // grave
  "\u0302": c("45 146"), // circumflex
  "\u0303": c("45 12456"), // tilde
  "\u0308": c("45 25"), // diaeresis
  "\u0327": c("45 12346"), // cedilla
  "\u030A": c("45 1246"), // ring
  "\u030C": c("45 346"), // caron
  "\u0304": c("4 36"), // macron
};

const SYMBOL: Record<string, string> = {
  ",": c("2"), ".": c("256"), "?": c("236"), "!": c("235"), ";": c("23"), ":": c("25"),
  "'": c("3"), "-": c("36"), "\u2010": c("36"), "\u2011": c("36"),
  "\u2013": c("6 36"), "\u2014": c("6 36"),
  "(": c("5 126"), ")": c("5 345"), "[": c("46 126"), "]": c("46 345"),
  "{": c("456 126"), "}": c("456 345"),
  "/": c("456 34"), "\\": c("456 16"), "*": c("5 35"), _: c("46 36"), "~": c("4 35"),
  "^": c("4 26"), "|": c("456 1256"), "&": c("4 12346"), "@": c("4 1"), "#": c("456 1456"),
  $: c("4 234"), "%": c("46 356"), "+": c("5 235"), "=": c("5 2356"), "<": c("4 126"),
  ">": c("4 345"), "×": c("5 236"), "÷": c("5 34"), "\u2212": c("5 36"),
  "≤": c("456 4 126"), "≥": c("456 4 345"), "≠": c("5 2356 4 156"), "≈": c("45 35"),
  "±": c("456 235"), "°": c("45 245"), "…": c("256 256 256"), "•": c("456 256"),
  "·": c("4 16"),
  "→": c("56 1256 135"), "←": c("56 1256 246"), "↑": c("56 1256 346"), "↓": c("56 1256 146"),
  "⇒": c("56 1256 2356 135"),
};

const QUOTE = {
  doubleOpen: c("236"),
  doubleClose: c("356"),
  singleOpen: c("6 236"),
  singleClose: c("6 356"),
  apostrophe: c("3"),
};

const SUPERSCRIPT_DIGIT: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};
const SUBSCRIPT_DIGIT: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

type Item =
  | { kind: "letter"; base: string; upper: boolean; greek: boolean; marks: string[]; raw: string }
  | { kind: "digit"; digit: string }
  | { kind: "level"; level: "sup" | "sub"; digit: string }
  | { kind: "other"; ch: string };

function classify(ch: string): Item[] {
  if (/[0-9]/.test(ch)) return [{ kind: "digit", digit: ch }];
  if (SUPERSCRIPT_DIGIT[ch]) return [{ kind: "level", level: "sup", digit: SUPERSCRIPT_DIGIT[ch] }];
  if (SUBSCRIPT_DIGIT[ch]) return [{ kind: "level", level: "sub", digit: SUBSCRIPT_DIGIT[ch] }];
  // Vulgar fractions (½) decompose to digits around a fraction slash.
  if (/[¼-¾⅐-⅞]/.test(ch)) {
    return [...ch.normalize("NFKD")].flatMap(classify);
  }
  const lower = ch.toLowerCase();
  if (GREEK[lower]) {
    return [{ kind: "letter", base: lower, upper: lower !== ch, greek: true, marks: [], raw: ch }];
  }
  const [base, ...marks] = [...lower.normalize("NFD")];
  if (base && LETTER[base] && marks.every((m) => MODIFIER[m])) {
    return [{ kind: "letter", base, upper: lower !== ch, greek: false, marks, raw: ch }];
  }
  return [{ kind: "other", ch }];
}

const isLetter = (it: Item | undefined): it is Extract<Item, { kind: "letter" }> =>
  it?.kind === "letter";
const isDigit = (it: Item | undefined) => it?.kind === "digit";

/** Letters in the word are all capitals, and there is at least one. */
function wordCase(word: string): "caps" | "lower" | "none" {
  const letters = [...word].flatMap(classify).filter(isLetter);
  if (!letters.length) return "none";
  return letters.every((l) => l.upper) ? "caps" : "lower";
}

type LineState = { openSingle: number };

function translateWord(
  word: string,
  inPassage: boolean,
  state: LineState,
  unknown: Set<string>
): string {
  const items = [...word].flatMap(classify);

  // Capital indicators, worked out per letters-sequence (a run of letters).
  const before: string[] = items.map(() => "");
  const after: string[] = items.map(() => "");
  if (!inPassage) {
    for (let s = 0; s < items.length; ) {
      if (!isLetter(items[s])) {
        s++;
        continue;
      }
      let e = s;
      while (isLetter(items[e])) e++;
      for (let a = s; a < e; ) {
        const upper = (items[a] as Extract<Item, { kind: "letter" }>).upper;
        let b = a;
        while (b < e && (items[b] as Extract<Item, { kind: "letter" }>).upper === upper) b++;
        if (upper) {
          if (b - a === 1) before[a] = CELL.capital;
          else {
            before[a] = CELL.capsWord;
            if (b < e) after[b - 1] = CELL.capsTerminator;
          }
        }
        a = b;
      }
      s = e;
    }
  }

  let out = "";
  let numeric = false;
  let level: "sup" | "sub" | null = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const next = items[i + 1];
    if (it.kind !== "level") level = null;

    if (it.kind === "digit") {
      if (!numeric) out += CELL.numeric;
      numeric = true;
      out += DIGIT[it.digit];
    } else if (it.kind === "level") {
      if (level !== it.level) {
        out += it.level === "sup" ? CELL.superscript : CELL.subscript;
        out += CELL.numeric;
        level = it.level;
      }
      out += DIGIT[it.digit];
      numeric = false;
    } else if (it.kind === "letter") {
      // After a digit, a-j would read as more digits unless the grade 1 indicator comes first.
      if (numeric && !before[i] && !it.greek && !it.marks.length && "abcdefghij".includes(it.base)) {
        out += CELL.grade1;
      }
      numeric = false;
      out += before[i];
      out += it.marks.map((m) => MODIFIER[m]).join("");
      out += it.greek ? CELL.greek + GREEK[it.base] : LETTER[it.base];
      out += after[i];
    } else {
      const ch = it.ch;
      if ((ch === "." || ch === "," || ch === "\u2044") && isDigit(next)) {
        // Decimal point, digit-group comma and fraction line keep numeric mode.
        if (ch === "\u2044") out += c("34");
        else {
          if (!numeric) out += CELL.numeric;
          out += SYMBOL[ch];
        }
        numeric = true;
        continue;
      }
      numeric = false;
      if (ch === '"' || ch === "\u201C" || ch === "\u201D") {
        const opening =
          ch === "\u201C" || (ch === '"' && (i === 0 || /[([{\u2018]/.test(word[i - 1] ?? "")));
        out += opening ? QUOTE.doubleOpen : QUOTE.doubleClose;
      } else if (ch === "\u2018") {
        state.openSingle++;
        out += QUOTE.singleOpen;
      } else if (ch === "\u2019") {
        const endsWord = !items.slice(i + 1).some(isLetter);
        if (endsWord && state.openSingle > 0) {
          state.openSingle--;
          out += QUOTE.singleClose;
        } else out += QUOTE.apostrophe;
      } else if (SYMBOL[ch]) {
        out += SYMBOL[ch];
      } else {
        unknown.add(ch);
        out += CELL.unknown;
      }
    }
  }
  return out;
}

function translateLine(line: string, unknown: Set<string>): string {
  const parts = line.split(/( +)/);
  const words = parts.map((p, i) => (i % 2 === 0 ? p : null));
  const kinds = words.map((w) => (w === null || w === "" ? null : wordCase(w)));

  // A capitals passage covers three or more capitalised words in a row; words with no letters
  // (numbers, symbols) can sit inside it.
  const inPassage = new Array(parts.length).fill(false);
  const passageStart = new Set<number>();
  const passageEnd = new Set<number>();
  let i = 0;
  while (i < parts.length) {
    if (kinds[i] !== "caps") {
      i++;
      continue;
    }
    let j = i;
    let last = i;
    let count = 0;
    while (j < parts.length && (kinds[j] === null || kinds[j] === "caps" || kinds[j] === "none")) {
      if (kinds[j] === "caps") {
        count++;
        last = j;
      }
      j++;
    }
    if (count >= 3) {
      for (let k = i; k <= last; k++) inPassage[k] = true;
      passageStart.add(i);
      passageEnd.add(last);
    }
    i = last + 1;
  }

  const state: LineState = { openSingle: 0 };
  return parts
    .map((p, k) => {
      if (k % 2 === 1) return p;
      if (!p) return "";
      let b = translateWord(p, inPassage[k], state, unknown);
      if (passageStart.has(k)) {
        // The indicator goes right before the first letter, after any opening punctuation.
        const firstLetter = [...p].findIndex((ch) => classify(ch).some(isLetter));
        const lead = translateWord([...p].slice(0, firstLetter).join(""), true, { openSingle: 0 }, new Set());
        b = b.slice(0, lead.length) + CELL.capsPassage + b.slice(lead.length);
      }
      if (passageEnd.has(k)) b += CELL.capsTerminator;
      return b;
    })
    .join("");
}

export type UebResult = {
  /** Unicode braille; spaces and newlines are kept as-is. */
  braille: string;
  /** Characters with no braille equivalent here, each shown as a full cell (⠿). */
  unknown: string[];
};

/** Translate print text to uncontracted UEB. */
export function translateUeb(text: string): UebResult {
  const unknown = new Set<string>();
  const braille = text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00A0]/g, " ")
    .split("\n")
    .map((line) => translateLine(line, unknown))
    .join("\n");
  return { braille, unknown: [...unknown] };
}

/** Shorthand when the unknown-character list is not needed. */
export const toUeb = (text: string): string => translateUeb(text).braille;

/** A number as braille, with the numeric indicator: 12 → ⠼⠁⠃. */
export const brailleNumber = (n: number): string =>
  CELL.numeric + String(n).split("").map((d) => DIGIT[d] ?? "").join("");
