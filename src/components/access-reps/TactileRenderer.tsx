import React, { useId, useMemo, useRef } from "react";
import type { FlowchartData } from "../../types/types";
import { flowchartKey } from "../../braille/tactileKey";
import {
  BRAILLE_MM,
  TACTILE_MARGIN,
  brailleDots,
  centredBrailleDots,
  layoutTactileFlowchart,
  type TactileShape,
} from "../../braille/tactileLayout";
import { buildBrailleDocument } from "../../braille/document";
import "./styles/Tactile.css";

const STROKE = 0.7; // mm, outlines and lines

function fileBase(title: string) {
  return (title || "stem-image").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "stem-image";
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Outline({ s }: { s: TactileShape }) {
  const common = { fill: "#fff", stroke: "#000", strokeWidth: STROKE };
  const x = s.cx - s.w / 2;
  const y = s.cy - s.h / 2;
  switch (s.kind) {
    case "diamond":
      return (
        <polygon
          {...common}
          points={`${s.cx},${y} ${s.cx + s.w / 2},${s.cy} ${s.cx},${y + s.h} ${x},${s.cy}`}
        />
      );
    case "ellipse":
      return <ellipse {...common} cx={s.cx} cy={s.cy} rx={s.w / 2} ry={s.h / 2} />;
    case "parallelogram": {
      const k = 4;
      return (
        <polygon
          {...common}
          points={`${x + k},${y} ${x + s.w},${y} ${x + s.w - k},${y + s.h} ${x},${y + s.h}`}
        />
      );
    }
    case "rounded":
      return <rect {...common} x={x} y={y} width={s.w} height={s.h} rx={s.h / 2} />;
    default:
      return <rect {...common} x={x} y={y} width={s.w} height={s.h} />;
  }
}

function Dots({ dots }: { dots: { cx: number; cy: number }[] }) {
  return (
    <>
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={BRAILLE_MM.dot / 2} fill="#000" />
      ))}
    </>
  );
}

type TactileProps = {
  json: FlowchartData;
  title?: string | null;
};

/**
 * Tactile graphic of a flowchart for swell paper or an embosser: numbered shapes in braille,
 * short line labels in braille and longer ones keyed by letter, at true letter-page size. The
 * key is shown below and can be downloaded as a braille file.
 */
const Tactile: React.FC<TactileProps> = ({ json, title }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const markerId = `tactile-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const name = title?.trim() || "";
  const key = useMemo(() => flowchartKey(json), [json]);
  const scene = useMemo(() => layoutTactileFlowchart(json, key, name), [json, key, name]);

  if (!scene) {
    return <p>There is nothing to draw yet. Add steps to the STEM image first.</p>;
  }

  const direct = [...key.edgeLabels.entries()].filter(([, v]) => !v.keyed).map(([label]) => label);
  const orientation = scene.width > scene.height ? "landscape" : "portrait";

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.removeAttribute("style");
    copy.removeAttribute("class");
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(copy);
    download(`${fileBase(name)}-tactile.svg`, xml, "image/svg+xml");
  };

  const downloadKey = () => {
    const doc = buildBrailleDocument({ title: name ? `${name}: tactile graphic key` : "Tactile graphic key", key: key.entries });
    download(`${fileBase(name)}-tactile-key.brf`, doc.brf, "text/plain;charset=us-ascii");
  };

  return (
    <div className="tactile">
      <p className="tactile__hint">
        Numbers in braille mark each shape; short line labels are written on the line and longer ones
        get a letter. The key is below and in the braille key file. Print the SVG at 100% (not “fit to
        page”) on {orientation} letter paper, on swell paper or a tactile embosser.
      </p>
      {scene.overlaps > 0 && (
        <p className="tactile__warning">
          {scene.overlaps === 1 ? "Two shapes are" : `${scene.overlaps} pairs of shapes are`} too close
          together to tell apart by touch at this size. Move them apart in the editor before printing.
        </p>
      )}

      <div className="tactile__page">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          width={`${scene.width}mm`}
          height={`${scene.height}mm`}
          role="img"
          aria-label={`Tactile graphic with ${scene.shapes.length} numbered shapes and ${scene.lines.length} lines, for ${orientation} letter paper. The key follows.`}
          style={{ width: "100%", height: "auto" }}
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#000" />
            </marker>
          </defs>
          <rect x={0} y={0} width={scene.width} height={scene.height} fill="#fff" />
          {scene.title && <Dots dots={brailleDots(scene.title, TACTILE_MARGIN, TACTILE_MARGIN)} />}

          {scene.lines.map((l, i) => (
            <g key={i}>
              <line
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="#000"
                strokeWidth={STROKE}
                strokeDasharray={l.dashed ? "3 2" : undefined}
                markerEnd={l.arrowEnd ? `url(#${markerId})` : undefined}
                markerStart={l.arrowStart ? `url(#${markerId})` : undefined}
              />
              {l.label && <Dots dots={centredBrailleDots(l.label.braille, l.label.cx, l.label.cy)} />}
            </g>
          ))}

          {scene.shapes.map((s) => (
            <g key={s.id}>
              <Outline s={s} />
              <Dots dots={centredBrailleDots(s.braille, s.cx, s.cy)} />
            </g>
          ))}
        </svg>
      </div>

      <div className="tactile__actions">
        <button type="button" className="btn" onClick={downloadSvg}>
          Download tactile graphic (SVG)
        </button>
        <button type="button" className="btn btn--outline" onClick={downloadKey}>
          Download braille key (.brf)
        </button>
      </div>

      <table className="tactile__key">
        <caption>Key to the tactile graphic</caption>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Stands for</th>
          </tr>
        </thead>
        <tbody>
          {key.entries.map((e) => (
            <tr key={`${e.kind}-${e.print}`}>
              <th scope="row">{e.kind === "node" ? `Shape ${e.print}` : `Line label ${e.print}`}</th>
              <td>{e.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {direct.length > 0 && (
        <p className="tactile__hint">Written on the lines in braille: {direct.join(", ")}.</p>
      )}
    </div>
  );
};

export default Tactile;
