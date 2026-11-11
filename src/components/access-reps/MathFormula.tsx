import { useEffect, useRef, useState } from "react";
import { isSafeTex } from "../../math/segments";
import { loadMathJax, typesetClear } from "../../math/mathjax";
import "./styles/Math.css";

type Props = { tex: string; display: boolean };

/**
 * One formula drawn by MathJax. React leaves the span's contents to MathJax; until MathJax is
 * ready the LaTeX source shows, and it stays as source if MathJax cannot load or the TeX uses
 * commands we do not allow.
 */
export default function MathFormula({ tex, display }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const safe = isSafeTex(tex);

  useEffect(() => {
    const el = ref.current;
    if (!el || !safe) return;
    let live = true;
    el.textContent = display ? `\\[${tex}\\]` : `\\(${tex}\\)`;
    loadMathJax()
      .then((mj) => (live ? mj.typesetPromise([el]) : undefined))
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
      typesetClear(el);
    };
  }, [tex, display, safe]);

  const className = display ? "math math--display" : "math";
  if (!safe || loadFailed) {
    return <code className={className}>{display ? `$$${tex}$$` : `$${tex}$`}</code>;
  }
  return <span ref={ref} className={className} />;
}
