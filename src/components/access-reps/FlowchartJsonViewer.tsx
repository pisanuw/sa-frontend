import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

function stableSortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSortObject);

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
      .forEach((k) => {
        sorted[k] = stableSortObject(obj[k]);
      });
    return sorted;
  }

  return value;
}

function downloadJson(filename: string, jsonValue: unknown) {
  const jsonString = JSON.stringify(jsonValue, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

function sanitizeFilename(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  // Control characters are not allowed in file names, so matching them is the point.
  // eslint-disable-next-line no-control-regex
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").slice(0, 120);
}

type CopyItem = { label: string; value: string };

type FlowchartJsonViewerProps = {
  title?: string;

  /** Label/value shown as the primary identifier (e.g., "Flowchart ID", "Public slug") */
  primaryIdLabel: string;
  primaryIdValue: string;

  /** Where the “Back” link should point */
  backLabel: string;
  backTo: string;

  /** The JSON payload you want to display */
  jsonValue: unknown;

  /** Default filename base (without .json) */
  defaultFileBase: string;

  /** Items to provide “Copy …” buttons for */
  copyItems: CopyItem[];
};

const FlowchartJsonViewer: React.FC<FlowchartJsonViewerProps> = ({
  title = "STEM image JSON",
  primaryIdLabel,
  primaryIdValue,
  backLabel,
  backTo,
  jsonValue,
  defaultFileBase,
  copyItems,
}) => {
  const [fileName, setFileName] = useState<string>(defaultFileBase);
  const [toast, setToast] = useState<string | null>(null);

  const cleanedJson = useMemo(() => stableSortObject(jsonValue), [jsonValue]);

  const prettyJson = useMemo(() => {
    try {
      return JSON.stringify(cleanedJson, null, 2);
    } catch {
      return String(cleanedJson);
    }
  }, [cleanedJson]);

  const finalFileName = useMemo(() => {
    const cleaned = sanitizeFilename(fileName);
    if (!cleaned) return `${defaultFileBase}.json`;
    return cleaned.toLowerCase().endsWith(".json") ? cleaned : `${cleaned}.json`;
  }, [fileName, defaultFileBase]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "16px" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <div style={{ marginTop: "6px" }}>
            <Link to={backTo}>{backLabel}</Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => downloadJson(finalFileName, cleanedJson)}
            style={{ padding: "8px 12px", cursor: "pointer" }}
          >
            Download JSON
          </button>
        </div>
      </div>

      {/* Name + Copy panel */}
      <div
        style={{
          marginTop: "14px",
          padding: "12px",
          border: "1px solid #e5e5e5",
          borderRadius: "10px",
          display: "grid",
          gap: "10px",
        }}
      >
        {/* Filename */}
        <div style={{ display: "grid", gap: "6px" }}>
          <label htmlFor="filename" style={{ fontWeight: 600 }}>
            File name (for download)
          </label>
          <input
            id="filename"
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder={defaultFileBase}
            style={{
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              width: "min(520px, 100%)",
            }}
          />
          <div style={{ fontSize: "0.9rem", color: "#555" }}>
            Download will save as: <code>{finalFileName}</code>
          </div>
        </div>

        {/* Copy row */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: "0.95rem" }}>
            <strong>{primaryIdLabel}:</strong> <code>{primaryIdValue}</code>
          </div>

          <button
            type="button"
            onClick={async () => {
              const ok = await copyToClipboard(primaryIdValue);
              showToast(ok ? `Copied ${primaryIdLabel}` : "Copy failed");
            }}
            style={{ padding: "8px 12px", cursor: "pointer" }}
          >
            Copy {primaryIdLabel}
          </button>

          {copyItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(item.value);
                showToast(ok ? `Copied ${item.label}` : "Copy failed");
              }}
              style={{ padding: "8px 12px", cursor: "pointer" }}
            >
              Copy {item.label}
            </button>
          ))}
        </div>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            style={{
              fontSize: "0.95rem",
              color: "#1a1a1a",
              background: "#f3f3f3",
              padding: "8px 10px",
              borderRadius: "8px",
              width: "fit-content",
            }}
          >
            {toast}
          </div>
        )}
      </div>

      {/* JSON */}
      <pre
        aria-label="STEM image JSON (pretty printed)"
        style={{
          marginTop: "16px",
          padding: "12px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          overflowX: "auto",
          whiteSpace: "pre",
          lineHeight: 1.4,
        }}
      >
        {prettyJson}
      </pre>
    </div>
  );
};

export default FlowchartJsonViewer;
