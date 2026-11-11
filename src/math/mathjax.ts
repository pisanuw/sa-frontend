// MathJax 4 in the page, loaded the first time a formula needs drawing. It comes from this
// site (see the mathjaxAssets plugin in vite.config.ts), with its accessibility features:
// spoken text, Nemeth braille for braille displays, and keyboard exploration of a formula.

export type MathJaxGlobal = {
  startup: { promise: Promise<void> };
  typesetPromise: (elements: Element[]) => Promise<void>;
  typesetClear: (elements: Element[]) => void;
};

/** Tell MathJax a formula's element is going away (no-op before MathJax has loaded). */
export function typesetClear(el: Element): void {
  const mj = window.MathJax as Partial<MathJaxGlobal> | undefined;
  mj?.typesetClear?.([el]);
}

declare global {
  interface Window {
    MathJax?: MathJaxGlobal | Record<string, unknown>;
  }
}

const ROOT = `${import.meta.env.BASE_URL}mathjax`;

let loading: Promise<MathJaxGlobal> | null = null;

export function loadMathJax(): Promise<MathJaxGlobal> {
  loading ??= new Promise<MathJaxGlobal>((resolve, reject) => {
    window.MathJax = {
      loader: {
        paths: { mathjax: ROOT, fonts: `${ROOT}/fonts` },
        // `ui/safe` filters links, classes and styles out of rendered math; isSafeTex also
        // refuses those commands before anything reaches MathJax.
        load: ["ui/safe"],
      },
      // Only formulas we hand to typesetPromise are drawn; nothing else on the page is scanned.
      startup: { typeset: false },
    };
    const script = document.createElement("script");
    script.src = `${ROOT}/tex-chtml.js`;
    script.async = true;
    script.onerror = () => reject(new Error("MathJax did not load"));
    script.onload = () => {
      const mj = window.MathJax as MathJaxGlobal;
      mj.startup.promise.then(() => resolve(mj), reject);
    };
    document.head.appendChild(script);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}
