

// src/components/export/export-utils.ts

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * File name base for downloads: lowercase letters and digits joined by hyphens, so
 * "Lab 2: Loops" becomes "lab-2-loops". Falls back when nothing is left.
 */
export function fileNameBase(title?: string | null, fallback = "stem-image"): string {
  return (
    (title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback
  );
}
export function sanitizeSvgForAccessibleUse(
  shortAlt: string,
  svgMarkup: string
): string {
  if (!svgMarkup.trim()) return svgMarkup;

  const safeLabel = escapeHtml(shortAlt || "STEM image");

  let sanitized = svgMarkup
    .replace(/<title[\s\S]*?<\/title>/gi, "")
    .replace(/<desc[\s\S]*?<\/desc>/gi, "");

  // Remove Mermaid's existing accessibility attrs that we don't want
  sanitized = sanitized
    .replace(/\srole="[^"]*"/i, "")
    .replace(/\saria-roledescription="[^"]*"/i, "")
    .replace(/\saria-label="[^"]*"/i, "")
    .replace(/\saria-hidden="[^"]*"/i, "");

  // Add the accessibility attrs we do want,
  // while preserving width/viewBox/style/class/etc.
  sanitized = sanitized.replace(
    /<svg\b/i,
    `<svg role="img" aria-label="${safeLabel}" focusable="false"`
  );

  return sanitized;
}
function markdownInlineToHtml(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>");
}

export function markdownToBasicHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const chunks: string[] = [];
  let inList = false;

  const closeListIfNeeded = () => {
    if (inList) {
      chunks.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeListIfNeeded();
      continue;
    }

    if (line.startsWith("## ")) {
      closeListIfNeeded();
      chunks.push(
        `<h2>${escapeHtml(line.replace(/^##\s+/, ""))}</h2>`
      );
      continue;
    }

    if (line.startsWith("# ")) {
      closeListIfNeeded();
      chunks.push(
        `<h1>${escapeHtml(line.replace(/^#\s+/, ""))}</h1>`
      );
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        chunks.push("<ul>");
        inList = true;
      }
      chunks.push(
        `<li>${markdownInlineToHtml(escapeHtml(line.slice(2)))}</li>`
      );
      continue;
    }

    closeListIfNeeded();
    chunks.push(`<p>${markdownInlineToHtml(escapeHtml(line))}</p>`);
  }

  closeListIfNeeded();

  return chunks.join("\n");
}


export function buildPlainTextFromMarkdown(markdown: string): string {
  if (!markdown.trim()) return "";

  let text = markdown;

  text = text.replace(/^##\s+/gm, "");
  text = text.replace(/^#\s+/gm, "");
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/\*(.*?)\*/g, "$1");
  text = text.replace(/`(.*?)`/g, "$1");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  text = text.replace(/^\s*[-*]\s+/gm, "• ");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

export async function copyToClipboard(text: string): Promise<void> {
  if (!text) return;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function downloadHtmlFile(filename: string, html: string): void {
  downloadTextFile(filename, html, "text/html;charset=utf-8");
}

type HtmlSnippetArgs = {
  title: string;
  shortAlt: string;
  imageUrl?: string | null;
  svgMarkup?: string | null;
  longDescriptionMarkdown: string;
};

type LinkedHtmlArgs = {
  title: string;
  shortAlt: string;
  imageUrl?: string | null;
  descriptionHref: string;
};

export function buildInlineHtmlSnippet(args: HtmlSnippetArgs): string {
  const { shortAlt, imageUrl, longDescriptionMarkdown } = args;
  const descriptionHtml = markdownToBasicHtml(longDescriptionMarkdown);

  return `<figure>
  <img src="${escapeHtml(imageUrl || "YOUR_IMAGE_URL")}" alt="${escapeHtml(shortAlt)}" />
  <figcaption>Full long description appears below.</figcaption>
</figure>

<section aria-label="Long description">
  ${descriptionHtml}
</section>`;
}

export function buildSelfHostedLinkedHtmlSnippet(args: LinkedHtmlArgs): string {
  const { title, shortAlt, imageUrl, descriptionHref } = args;

  return `<figure>
  <img src="${escapeHtml(imageUrl || "YOUR_IMAGE_URL")}" alt="${escapeHtml(shortAlt)}" />
  <figcaption>
    ${escapeHtml(title || "STEM image")}. Full long description can be found <a href="${escapeHtml(
      descriptionHref
    )}">here.</a>
  </figcaption>
</figure>`;
}

export function buildPermalinkLinkedHtmlSnippet(args: LinkedHtmlArgs): string {
  const { title, shortAlt, imageUrl, descriptionHref } = args;

  return `<figure>
  <img src="${escapeHtml(imageUrl || "YOUR_IMAGE_URL")}" alt="${escapeHtml(shortAlt)}" />
  <figcaption>
    ${escapeHtml(title || "STEM image")}. Accessible STEM Image Representations can be found <a href="${escapeHtml(
      descriptionHref
    )}">here.</a>
  </figcaption>
</figure>`;
}



export function buildSelfHostedDescriptionFileName(title: string): string {
  return `${fileNameBase(title)}-long-description.html`;
}

import mermaid from "mermaid";

let mermaidInitialized = false;

function ensureMermaidInitialized() {
  if (mermaidInitialized) return;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "default",
    flowchart: {
      useMaxWidth: true,
      htmlLabels: false,
    },
  });

  mermaidInitialized = true;
}

export async function renderMermaidToSvg(
  mermaidCode: string,
  idPrefix = "export-diagram"
): Promise<string> {
  ensureMermaidInitialized();

  const renderId = `${idPrefix}-${Math.random().toString(36).slice(2, 9)}`;

  const result = await mermaid.render(renderId, mermaidCode);
  return result.svg;
}

type DiagramVisualExportArgs = {
  mermaidCode?: string | null;
  imageUrl?: string | null;
};

export type DiagramVisualExport =
  | { kind: "svg"; svgMarkup: string }
  | { kind: "image"; imageUrl: string }
  | { kind: "none" };

export async function buildDiagramVisualForExport({
  mermaidCode,
  imageUrl,
}: DiagramVisualExportArgs): Promise<DiagramVisualExport> {
  if (mermaidCode?.trim()) {
    try {
      const svgMarkup = await renderMermaidToSvg(mermaidCode);
      if (svgMarkup.trim()) {
        return { kind: "svg", svgMarkup };
      }
    } catch (error) {
      console.error("Failed to render Mermaid SVG for export:", error);
    }
  }

  if (imageUrl?.trim()) {
    return { kind: "image", imageUrl };
  }

  return { kind: "none" };
}

function buildVisualHtml(args: {
  title: string;
  shortAlt: string;
  imageUrl?: string | null;
  svgMarkup?: string | null;
}): string {
  const { shortAlt, imageUrl, svgMarkup } = args;

  if (svgMarkup?.trim()) {
    const safeSvg = sanitizeSvgForAccessibleUse(shortAlt, svgMarkup);

    return `<figure>
  <div class="diagram-visual">
    ${safeSvg}
  </div>
  <figcaption>Full long description appears below.</figcaption>
</figure>`;
  }

  if (imageUrl?.trim()) {
    return `<figure>
  <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(shortAlt || "STEM image")}" />
  <figcaption>Full long description appears below.</figcaption>
</figure>`;
  }

  return `<section class="diagram-missing" aria-label="STEM image preview unavailable">
  <p>No visual STEM image preview was available for this export.</p>
</section>`;
}

export function buildSelfHostedLongDescriptionPageHtml(args: HtmlSnippetArgs): string {
  const { title, shortAlt, imageUrl, svgMarkup, longDescriptionMarkdown } = args;

  const visualHtml = buildVisualHtml({ title, shortAlt, imageUrl, svgMarkup });
  const descriptionHtml = markdownToBasicHtml(longDescriptionMarkdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title || "STEM image long description")}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 32px 20px;
      color: #1f1f1f;
      background: #ffffff;
    }

    main {
      max-width: 960px;
      margin: 0 auto;
    }

    img,
    svg {
      max-width: 100%;
      height: auto;
      display: block;
    }

    figure {
      margin: 0 0 24px 0;
    }

    figcaption {
      margin-top: 8px;
      color: #555;
    }

    section {
      margin-top: 24px;
    }

    h1, h2 {
      line-height: 1.25;
    }

    ul {
      padding-left: 1.25rem;
    }

    .sr-context {
      margin-top: 12px;
      color: #444;
    }

    .diagram-visual {
      overflow-x: auto;
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 12px;
      background: #fafafa;
    }

    .diagram-missing {
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 12px;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title || "STEM image long description")}</h1>
    ${visualHtml}
    <section aria-label="Long description">
    
      ${descriptionHtml}
    </section>
  </main>
</body>
</html>`;
}