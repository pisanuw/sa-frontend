import { useId, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import QRCodeGenerator from "./QRCode";
import type { FlowchartData } from "../../types/types";
import type { DiagramType } from "../../arboretum/diagramTypes";
import { isDataStructure } from "../../arboretum/diagramTypes";
import { canRenderBrailleLabels } from "./typed/TypedViews";
import { brfFileName, downloadBrf, stemImageBrailleWithMath } from "../../braille/stemImage";
import { toUeb } from "../../braille/ueb";
import { jsonToMermaid } from "../../services/utils";
import {
  buildDiagramVisualForExport,
  buildPermalinkLinkedHtmlSnippet,
  buildPlainTextFromMarkdown,
  buildSelfHostedLongDescriptionPageHtml,
  copyToClipboard,
  downloadHtmlFile,
  downloadTextFile,
  markdownToBasicHtml,
} from "../exports/export-utils";
import "./styles/ShareToolbar.css";

type Format = "html" | "markdown" | "text" | "braille";

type Props = {
  title: string;
  shortAlt: string;
  /** Long description as Markdown. */
  summary: string;
  json: FlowchartData;
  /** Image type; decides whether the braille file includes the tactile graphic's key. */
  diagramType?: DiagramType;
  /** Absolute address of the shared page; enables the embed code and QR code. */
  publicUrl?: string | null;
};

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "html", label: "HTML", hint: "Alt text and long description as HTML paragraphs and headings." },
  { value: "markdown", label: "Markdown", hint: "Plain alt text; long description with headings." },
  { value: "text", label: "Text", hint: "Plain text, no markup." },
  {
    value: "braille",
    label: "Braille (.brf)",
    hint: "Uncontracted Unified English Braille for braille displays, notetakers and embossers. Copy gives Unicode braille; Download gives a .brf file with the title, alt text, long description and tactile key.",
  },
];

const escapeHtmlText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fileBase = (title: string) =>
  (title || "stem-image").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "") ||
  "stem-image";

/**
 * Export: copy and download the accessible text of a STEM image in HTML, Markdown, or text, plus
 * embed code and a QR code for the shared page. Lives in the editor, under Accessibility.
 */
export default function ShareToolbar({ title, shortAlt, summary, json, diagramType, publicUrl }: Props) {
  const id = useId();
  const [format, setFormat] = useState<Format>("text");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const say = (msg: string) => setStatus(msg);

  const altFor = (f: Format) =>
    f === "html" ? `<p>${escapeHtmlText(shortAlt)}</p>` : f === "braille" ? toUeb(shortAlt) : shortAlt;
  const descriptionFor = (f: Format) =>
    f === "html"
      ? markdownToBasicHtml(summary)
      : f === "markdown"
        ? summary
        : f === "braille"
          ? toUeb(buildPlainTextFromMarkdown(summary))
          : buildPlainTextFromMarkdown(summary);

  async function copy(text: string, what: string) {
    try {
      await copyToClipboard(text);
      say(`Copied ${what}.`);
    } catch {
      say(`Could not copy ${what}. Select the text on the page and copy it instead.`);
    }
  }

  /** Put the QR code on the clipboard as a PNG; download it instead where images can't be copied. */
  async function copyQr() {
    if (!publicUrl) return;
    try {
      const svg = renderToStaticMarkup(
        <QRCodeSVG value={publicUrl} size={512} marginSize={4} bgColor="#ffffff" fgColor="#000000" />
      );
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("QR image failed"));
        img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      canvas.getContext("2d")!.drawImage(img, 0, 0, 512, 512);
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png")
      );
      if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        say("Copied QR code.");
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${fileBase(title)}-qr.png`;
        a.click();
        say("Your browser can't copy images, so the QR code was downloaded.");
      }
    } catch {
      say("Could not copy the QR code. Open Export and use Download QR Code.");
    }
  }

  async function download() {
    const base = fileBase(title);
    if (format === "braille") {
      // The numbered tactile graphic has a key; data structures with short labels print the
      // values themselves and have none.
      const type = diagramType ?? "flowchart";
      setBusy(true);
      try {
        // Waits for the math engine only when there is math to put in Nemeth.
        const doc = await stemImageBrailleWithMath({
          title,
          shortAlt,
          summary,
          data: json,
          includeKey: !(isDataStructure(type) && canRenderBrailleLabels(type, json)),
          source: publicUrl,
        });
        downloadBrf(brfFileName(title), doc.brf);
      } finally {
        setBusy(false);
      }
    } else if (format === "text") {
      downloadTextFile(`${base}-long-description.txt`, descriptionFor("text"));
    } else if (format === "markdown") {
      downloadTextFile(`${base}-long-description.md`, summary, "text/markdown;charset=utf-8");
    } else {
      // A full page, with the diagram drawn into it so it stands on its own.
      setBusy(true);
      try {
        const visual = await buildDiagramVisualForExport({ mermaidCode: jsonToMermaid(json) });
        const html = buildSelfHostedLongDescriptionPageHtml({
          title,
          shortAlt,
          longDescriptionMarkdown: summary,
          svgMarkup: visual.kind === "svg" ? visual.svgMarkup : null,
        });
        downloadHtmlFile(`${base}-long-description.html`, html);
      } finally {
        setBusy(false);
      }
    }
    say(`Downloaded the long description as ${FORMATS.find((f) => f.value === format)?.label}.`);
  }

  const hint = FORMATS.find((f) => f.value === format)?.hint;

  const bodyId = `${id}-body`;

  // Same look and height as the Accessibility header, so the two sit together as a pair.
  return (
    <section
      className={
        open
          ? "accessibility-summary-bar accessibility-summary-bar--open share-toolbar"
          : "accessibility-summary-bar share-toolbar"
      }
      aria-label="Export"
    >
      <div className="accessibility-summary-bar__head">
        <h2 className="accessibility-summary-bar__title">
          <button
            type="button"
            className="accessibility-summary-bar__toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" className="accessibility-summary-bar__chevron">
              {open ? "▾" : "▸"}
            </span>
            Export
          </button>
        </h2>

        <div className="accessibility-summary-bar__stats share-toolbar__chips">
          <button
            type="button"
            className="accessibility-summary-chip share-chip"
            disabled={!shortAlt.trim()}
            onClick={() => copy(altFor(format), "alt text")}
          >
            Copy alt text
          </button>
          <button
            type="button"
            className="accessibility-summary-chip share-chip"
            disabled={!publicUrl}
            title={publicUrl ? undefined : "Share this STEM image to get a QR code."}
            onClick={copyQr}
          >
            Copy QR code
          </button>
          <span className="share-toolbar__status" role="status" aria-live="polite">
            {status}
          </span>
        </div>
      </div>

      <div id={bodyId} className="accessibility-summary-bar__body share-toolbar__body" hidden={!open}>
      <div className="share-toolbar__row">
        <fieldset className="share-toolbar__formats">
          <legend>Export as</legend>
          {FORMATS.map((f) => (
            <label key={f.value} className="share-toolbar__radio">
              <input
                type="radio"
                name={`${id}-format`}
                value={f.value}
                checked={format === f.value}
                onChange={() => setFormat(f.value)}
                aria-describedby={`${id}-hint`}
              />
              {f.label}
            </label>
          ))}
        </fieldset>

        <div className="share-toolbar__actions">
          <button
            type="button"
            className="btn btn--outline"
            disabled={!summary.trim()}
            onClick={() => copy(descriptionFor(format), "long description")}
          >
            Copy long description
          </button>
          <button
            type="button"
            className="btn btn--outline"
            disabled={!summary.trim() || busy}
            onClick={download}
          >
            {busy ? "Preparing…" : "Download"}
          </button>
          {publicUrl && (
            <button
              type="button"
              className="btn btn--outline"
              onClick={() =>
                copy(
                  buildPermalinkLinkedHtmlSnippet({
                    title,
                    shortAlt,
                    imageUrl: null,
                    descriptionHref: publicUrl,
                  }),
                  "embed code"
                )
              }
            >
              Copy embed code
            </button>
          )}
        </div>
      </div>

      <p id={`${id}-hint`} className="share-toolbar__hint">
        {hint}
        {publicUrl ? " Embed code shows your image with its alt text and a link to the shared page; replace YOUR_IMAGE_URL with where the image is hosted." : ""}
      </p>

      {publicUrl && (
        <details className="share-toolbar__qr">
          <summary>QR code for the shared page</summary>
          <QRCodeGenerator permalink={publicUrl} />
        </details>
      )}

      </div>
    </section>
  );
}
