import React, { useMemo, useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";

import { getVisualizationRecord, updateVisualizationRecord } from "../services/visualizationStore";
import ChartRenderer from "../components/ChartRenderer";
import ExportTactileButton from "../components/ExportTactileButton"; // adjust if your component lives elsewhere
import { downloadJson } from "../services/downloadJson"; // if you already have it in grafari/services; otherwise use your existing helper
import { sonify } from "../services/sonify"; // if already in grafari/services
import type { VisualizationRecord } from "../types/visualizationRecord";
import { computeSeries } from "../services/computeSeries";


function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text);
}

const VizResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const record = useMemo(() => (id ? getVisualizationRecord(id) : null), [id]);

  const sonifyHandleRef = useRef<{ stop: () => void } | null>(null);
  const [speakLabels, setSpeakLabels] = useState(false);


  const chartData = useMemo(() => {
  if (!record?.rows?.length) return null;

  return computeSeries({
    rows: record.rows,
    chartType: record.chartType,
    xField: record.mapping.xField,
    yField: record.mapping.yField,
    aggregate: record.mapping.aggregate,
  });
}, [record]);

  const [tactileSvg, setTactileSvg] = useState<string | null>(record?.tactile?.svgText ?? null);
  const [showTable, setShowTable] = useState(false);

  // Stop any playing sound when leaving the page. Declared before the early return so the
  // hook runs on every render.
  useEffect(() => {
    return () => {
      sonifyHandleRef.current?.stop();
    };
  }, []);

  if (!record) {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 8 }}>Visualization not found</h1>
        <div style={{ opacity: 0.8 }}>
          This permalink ID does not exist in local storage on this browser.
        </div>
      </div>
    );
  }

  const title = record.vizIR?.narrative?.title ?? "Grafari visualization";

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>{title}</h1>
          <div style={{ opacity: 0.8 }}>
            Dataset: <strong>{record.datasetName}</strong> · Rows:{" "}
            <strong>{record.rowCount}</strong> · Created:{" "}
            <strong>{new Date(record.createdAt).toLocaleString()}</strong>
          </div>
          <div style={{ opacity: 0.65, marginTop: 6 }}>
            Grafari Record ID: <code>{record.id}</code>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => copyToClipboard(window.location.href)}
          >
            Copy permalink
          </button>

          {/* Export pack stub (optional) */}
          <button
            type="button"
            onClick={() => {
              // later: zip everything; for now just download IR
              downloadJson(`grafari-${record.id}-ir.json`, record.vizIR);
            }}
          >
            Download IR JSON
          </button>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        {/* Left: Visual */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Visual</h2>

          {/* If you have precomputed series data stored, render that. Otherwise re-render using your record data. */}
          {/* For now, reuse your existing ChartRenderer contract if you stored chart-ready data elsewhere. */}
          {/* If ChartRenderer needs chartData, you can compute again from record.rows (recommended). */}
          <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                {!chartData ? (
                    <div style={{ opacity: 0.75 }}>
                    Chart preview unavailable (missing rows or invalid mapping).
                    </div>
                ) : (
                    <ChartRenderer
                    title={record.vizIR?.narrative?.title ?? "Grafari chart"}
                    data={chartData}
                    />
                )}
                </div>


          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => downloadJson(`grafari-${record.id}-vegalite.json`, record.vegaLiteSpec)}
            >
              Download Vega-Lite JSON
            </button>

            <button
              type="button"
              onClick={() => downloadJson(`grafari-${record.id}-data.json`, record.rows)}
            >
              Download data JSON
            </button>
          </div>
        </div>

        {/* Right: Accessible reps */}
        <div style={{ display: "grid", gap: 16 }}>
          {/* Summary */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Summary</h2>
            <div style={{ lineHeight: 1.45 }}>
              {record.vizIR?.narrative?.shortSummary ?? "No summary."}
            </div>
          </div>

          {/* Data table */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Data table</h2>
              <button type="button" onClick={() => setShowTable((v) => !v)}>
                {showTable ? "Hide" : "Show"}
              </button>
            </div>

            {showTable && (
              <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {Object.keys(record.rows[0] ?? {}).map((k) => (
                        <th key={k} style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {record.rows.slice(0, 50).map((r, idx) => (
                      <tr key={idx}>
                        {Object.keys(record.rows[0] ?? {}).map((k) => (
                          <td key={k} style={{ borderBottom: "1px solid #f3f3f3", padding: 8 }}>
                            {String((r as any)[k] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 10, opacity: 0.75 }}>
              Showing up to 50 rows (MVP).
            </div>
          </div>

          {/* Tactile */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Tactile</h2>

            {/* Optional inline preview */}
            {tactileSvg ? (
              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 12,
                  maxHeight: 260,
                  overflow: "auto",
                  background: "#fafafa",
                }}
                dangerouslySetInnerHTML={{ __html: tactileSvg }}
              />
            ) : (
              <div style={{ opacity: 0.75, marginBottom: 10 }}>
                Generate a tactile SVG for swell paper / embossing workflows.
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <ExportTactileButton
                apiBaseUrl={"http://localhost:5055"}
                spec={record.vegaLiteSpec}
                filename={`tactile-${record.datasetName || "grafari"}-${record.id}.svg`}
                disabled={!record.vegaLiteSpec}
                onDone={(svgText) => {
                  setTactileSvg(svgText);
                  updateVisualizationRecord(record.id, {
                    tactile: {
                      svgText,
                      generatedAt: new Date().toISOString(),
                    },
                  } as Partial<VisualizationRecord>);
                }}
              />
            </div>
          </div>

          {/* Sonification (basic controls; reuse your existing sonify service) */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Sonification</h2>
            <div style={{ opacity: 0.75, marginBottom: 10 }}>
              Play an audio representation of the chart (MVP).
            </div>

            {/* If you already have chartData computed here, wire play/stop.
               If not, keep the buttons disabled until you compute series again in this page. */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
  <button
    type="button"
    disabled={!chartData}
    onClick={() => {
      if (!chartData) return;
      sonifyHandleRef.current?.stop();
      sonifyHandleRef.current = sonify({
        chartData,
        speakLabels,
        tempoMs: 280,
        minHz: 220,
        maxHz: 880,
      });
    }}
  >
    Play
  </button>

  <button
    type="button"
    onClick={() => {
      sonifyHandleRef.current?.stop();
      sonifyHandleRef.current = null;
    }}
  >
    Stop
  </button>

  <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
    <input
      type="checkbox"
      checked={speakLabels}
      onChange={(e) => setSpeakLabels(e.target.checked)}
    />
    Speak labels
  </label>
</div>

          </div>

          {/* Navigable chart placeholder */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, opacity: 0.7 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Navigable chart</h2>
            <div>Coming soon: keyboard-first navigable view.</div>
          </div>

          {/* Technical details */}
          <details style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <summary style={{ cursor: "pointer" }}>Technical details</summary>
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: 14, marginTop: 0 }}>Vega-Lite</h3>
              <pre style={{ maxHeight: 220, overflow: "auto", background: "#fafafa", padding: 10, borderRadius: 10 }}>
                {JSON.stringify(record.vegaLiteSpec, null, 2)}
              </pre>

              <h3 style={{ fontSize: 14 }}>VizIR</h3>
              <pre style={{ maxHeight: 220, overflow: "auto", background: "#fafafa", padding: 10, borderRadius: 10 }}>
                {JSON.stringify(record.vizIR, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default VizResultsPage;
