import { useId, useMemo, useState } from "react";
import type { FlowchartData } from "../../types/types";
import { stemImageBraille, brfFileName, downloadBrf } from "../../braille/stemImage";
import "./styles/Braille.css";

type Props = {
  data: FlowchartData;
  title?: string | null;
  shortAlt?: string | null;
  summary?: string | null;
  /** Include the numbered tactile graphic's key. */
  includeKey: boolean;
  /** Shared page address, for the transcriber's note. */
  shareUrl?: string | null;
};

/**
 * Braille view: a .brf file of the STEM image's text for braille displays, notetakers and
 * embossers, plus a page-by-page preview for proofreading.
 */
export default function BrailleView({ data, title, shortAlt, summary, includeKey, shareUrl }: Props) {
  const doc = useMemo(
    () => stemImageBraille({ data, title, shortAlt, summary, includeKey, source: shareUrl }),
    [data, title, shortAlt, summary, includeKey, shareUrl]
  );
  const [status, setStatus] = useState("");
  const id = useId();
  const pages = doc.pages.length;

  const parts = ["the title", "a transcriber’s note"];
  if (shortAlt?.trim()) parts.push("the alt text");
  if (summary?.trim()) parts.push("the long description");
  if (includeKey && data.nodes.length) parts.push("the key to the tactile graphic");
  const contents = parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];

  return (
    <div className="braille-view">
      <p>
        A braille file (.brf) for a braille display, braille notetaker or embosser. It has {contents},
        in uncontracted Unified English Braille, 40 cells by 25 lines per page.
      </p>
      <div className="braille-view__actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            downloadBrf(brfFileName(title), doc.brf);
            setStatus(`Downloaded ${brfFileName(title)}, ${pages} braille ${pages === 1 ? "page" : "pages"}.`);
          }}
        >
          Download braille file (.brf)
        </button>
        <span role="status" aria-live="polite">
          {status}
        </span>
      </div>
      <p className="braille-view__note">
        Made automatically and not yet checked by a braille transcriber. If something reads wrong,
        please report it.
        {doc.unknown.length > 0 &&
          ` ${doc.unknown.length === 1 ? "One character" : `${doc.unknown.length} characters`} (${doc.unknown.join(" ")}) could not be shown in braille and appear as a full cell.`}
      </p>

      <details className="braille-view__preview">
        <summary>
          Preview ({pages} {pages === 1 ? "page" : "pages"})
        </summary>
        {doc.pages.map((lines, i) => (
          <figure key={i} className="braille-view__page">
            <figcaption id={`${id}-page-${i}`}>
              Page {i + 1} of {pages}
            </figcaption>
            {/* Focusable so keyboard users can scroll a page that is wider than the screen. */}
            <pre tabIndex={0} aria-labelledby={`${id}-page-${i}`}>
              {lines.join("\n")}
            </pre>
          </figure>
        ))}
      </details>
    </div>
  );
}
