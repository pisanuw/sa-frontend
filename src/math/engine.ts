// Math to Nemeth braille, without a page: TeX → MathML with MathJax 4's TeX input (no DOM
// needed), then MathML → Nemeth with the Speech Rule Engine that MathJax itself uses.
// Loaded on demand; it is a few hundred kilobytes and only needed when there is math.

import { isSafeTex } from "./segments";

export type MathEngine = {
  /** Nemeth braille (Unicode) for a TeX expression, or null if it cannot be converted. */
  nemeth(tex: string): string | null;
  /** MathML for a TeX expression, or null on a TeX error. */
  mathml(tex: string, display?: boolean): string | null;
};

/** Where the browser finds the engine's rule files; served by the mathjaxAssets Vite plugin. */
const MATHMAPS_URL = `${import.meta.env?.BASE_URL ?? "/"}mathjax/sre/mathmaps`;

let loading: Promise<MathEngine> | null = null;

export function loadMathEngine(): Promise<MathEngine> {
  loading ??= create().catch((e) => {
    loading = null; // let a later call try again
    throw e;
  });
  return loading;
}

async function create(): Promise<MathEngine> {
  const [{ mathjax }, { TeX }, { liteAdaptor }, { RegisterHTMLHandler }, { SerializedMmlVisitor }] =
    await Promise.all([
      import("@mathjax/src/mjs/mathjax.js"),
      import("@mathjax/src/mjs/input/tex.js"),
      import("@mathjax/src/mjs/adaptors/liteAdaptor.js"),
      import("@mathjax/src/mjs/handlers/html.js"),
      import("@mathjax/src/mjs/core/MmlTree/SerializedMmlVisitor.js"),
    ]);
  await Promise.all([
    import("@mathjax/src/mjs/input/tex/base/BaseConfiguration.js"),
    import("@mathjax/src/mjs/input/tex/ams/AmsConfiguration.js"),
  ]);
  RegisterHTMLHandler(liteAdaptor());
  const doc = mathjax.document("", { InputJax: new TeX({ packages: ["base", "ams"] }) });
  const visitor = new SerializedMmlVisitor();

  const inBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  if (inBrowser) {
    // In a browser the engine fetches its rule files from jsDelivr unless told otherwise, and it
    // starts loading them as soon as it is imported, so the path has to be set before the import.
    const g = globalThis as { SREfeature?: Record<string, unknown> };
    g.SREfeature = { ...g.SREfeature, json: MATHMAPS_URL };
  }
  // A CommonJS package: bundlers expose it as the default export, Node as the namespace.
  type Sre = typeof import("speech-rule-engine");
  const mod = (await import("speech-rule-engine")) as Sre & { default?: Sre };
  const SRE: Sre = mod.default ?? mod;
  await SRE.setupEngine({
    locale: "nemeth",
    modality: "braille",
    domain: "default",
    ...(inBrowser ? { json: MATHMAPS_URL } : {}),
  });
  await SRE.engineReady();

  const mathml = (tex: string, display = false): string | null => {
    if (!isSafeTex(tex)) return null;
    try {
      const mml = visitor.visitTree(doc.convert(tex, { display }));
      return mml.includes("<merror") ? null : mml;
    } catch {
      return null;
    }
  };

  return {
    mathml,
    nemeth(tex) {
      const mml = mathml(tex);
      if (!mml) return null;
      try {
        const braille = SRE.toSpeech(mml).trim();
        return /^[⠀-⣿\s]+$/.test(braille) ? braille : null;
      } catch {
        return null;
      }
    },
  };
}
