/**
 * Views for diagrams the author marked as a data structure (tree, binary tree, linked list,
 * array, 2D array). They are fed by Arboretum's intermediate representation and follow its
 * output designs: https://github.com/ritesh-kanchi/Arboretum (MIT, (c) 2026 Ritesh Kanchi).
 */
import React, { useMemo, useRef } from "react";
import TreeView, { flattenTree } from "react-accessible-treeview";
import type { FlowchartData } from "../../../types/types";
import type { DiagramType } from "../../../arboretum/diagramTypes";
import { isArrayType, isDataStructure, isTreeType } from "../../../arboretum/diagramTypes";
import { toArboretumDiagram } from "../../../arboretum/adapt";
import { downloadTextFile, fileNameBase } from "../../exports/export-utils";
import {
  buildTree,
  buildPositionTree,
  getNodePosition,
  generateBrailleSvg,
  generateBrailleText,
  dotSpacing,
  letterSpacing,
  brailleOffset,
  PHANTOM_NODE_IDS,
} from "../../../arboretum/vendor";
import type { IRArray, IRLinkedList, IRNode, IRTree } from "../../../arboretum/vendor";
import "./typed.css";

type Props = { type: DiagramType; data: FlowchartData; title?: string | null };

const isPhantom = (id: string) => PHANTOM_NODE_IDS.includes(id.toLowerCase());
const shown = (n: IRNode) => (n.value === "" ? n.id : n.value);

function useDiagram(type: DiagramType, data: FlowchartData, title?: string | null) {
  return useMemo(() => toArboretumDiagram(type, data, title ?? ""), [type, data, title]);
}

const Empty = () => <p>There is nothing to show yet. Add some nodes to the STEM image.</p>;

// ================= Navigable =================

type TreeData = { name: string; metadata?: { id: string; value: string }; children?: TreeData[] };

function TreeNavigable({ tree }: { tree: IRTree }) {
  const root = buildTree(tree);
  if (!root) return <Empty />;

  const toFlat = (node: IRNode): TreeData => ({
    name: node.id,
    metadata: { id: node.id, value: shown(node) },
    children: (node.children ?? []).filter((c) => !isPhantom(c.id)).map(toFlat),
  });
  const flat = flattenTree({ name: "", children: [toFlat(root)] } as any);

  const layout = buildPositionTree(tree, [125, 125]);
  const placed = layout.descendants();
  const xs = placed.map((n) => n.x ?? 0);
  const ys = placed.map((n) => n.y ?? 0);
  const pad = 60;
  const width = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const height = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const dx = pad - Math.min(...xs);
  const dy = pad - Math.min(...ys);
  const at = (id: string) => placed.find((n) => n.data?.id === id);

  const label = tree.meta.type === "bt" ? "Binary tree" : "Tree";

  return (
    <div className="typed-scroll">
      <p className="typed-hint">
        Use the arrow keys to move between nodes: Up and Down move through the tree, Right opens a
        node or moves to its first child, and Left moves to its parent.
      </p>
      <div className="typed-tree" style={{ width, height }}>
        <svg width={width} height={height} aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          {tree.edges
            .filter((e) => !isPhantom(e.parent) && !isPhantom(e.child))
            .map((e, i) => {
              const a = at(e.parent);
              const b = at(e.child);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={(a.x ?? 0) + dx}
                  y1={(a.y ?? 0) + dy}
                  x2={(b.x ?? 0) + dx}
                  y2={(b.y ?? 0) + dy}
                  stroke="#8a8a8a"
                  strokeWidth={2}
                />
              );
            })}
        </svg>
        <TreeView
          data={flat}
          propagateCollapse
          aria-label={label}
          nodeRenderer={({ element, getNodeProps, level }) => {
            const p = at(element.name);
            if (!p) return <></>;
            const value = String(element.metadata?.value ?? "");
            const position =
              level === 1
                ? "Root node"
                : tree.meta.type === "bt"
                  ? `${getNodePosition(tree, String(element.metadata?.id ?? ""))} child`
                  : "Node";
            return (
              <div
                {...getNodeProps()}
                className="arbornode"
                style={{ left: (p.x ?? 0) + dx - 48, top: (p.y ?? 0) + dy - 48 }}
                aria-label={`${position}: ${value}`}
              >
                {value}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

function ListNavigable({ list }: { list: IRLinkedList }) {
  if (!list.nodes.length) return <Empty />;
  return (
    <div className="typed-scroll typed-ll">
      <ol className="typed-cells" aria-label="Linked list">
        {list.nodes.map((n, i) => {
          const role = i === 0 ? ", head" : i === list.nodes.length - 1 ? ", tail" : "";
          return (
            <React.Fragment key={n.id}>
              <li
                className="typed-cell"
                tabIndex={0}
                aria-label={`Node ${i + 1} of ${list.nodes.length}${role}: ${shown(n)}`}
              >
                {shown(n)}
              </li>
              {i < list.nodes.length - 1 && (
                <li className="typed-arrow" aria-hidden="true">
                  →
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function ArrayNavigable({ array }: { array: IRArray }) {
  if (!array.elements.length) return <Empty />;
  if (array.meta.type === "2arr") {
    return (
      <div className="typed-scroll">
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="2D array, rows">
          {array.elements.map((row, r) => (
            <li key={row.id}>
              <ol className="typed-cells" aria-label={`Row ${r + 1}`}>
                {(row.children ?? []).map((cell, c) => (
                  <li
                    key={cell.id}
                    className="typed-cell"
                    tabIndex={0}
                    aria-label={`Row ${r + 1}, column ${c + 1}: ${cell.value}`}
                  >
                    {cell.value}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div className="typed-scroll">
      <ol className="typed-cells" aria-label="Array">
        {array.elements.map((el, i) => (
          <li
            key={el.id}
            className="typed-cell"
            tabIndex={0}
            aria-label={`Index ${i}: ${el.value}`}
          >
            {el.value}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TypedNavigable({ type, data, title }: Props) {
  const d = useDiagram(type, data, title);
  if (!d) return <Empty />;
  if (isTreeType(type)) return <TreeNavigable tree={d as IRTree} />;
  if (type === "ll") return <ListNavigable list={d as IRLinkedList} />;
  return <ArrayNavigable array={d as IRArray} />;
}

// ================= Table =================

export function TypedTable({ type, data, title }: Props) {
  const d = useDiagram(type, data, title);
  if (!d) return <Empty />;

  if (isTreeType(type)) {
    const tree = d as IRTree;
    const root = buildTree(tree);
    if (!root) return <Empty />;
    const rows: { node: IRNode; parent: string; children: string[]; depth: number }[] = [];
    const walk = (n: IRNode, parent: string) => {
      const kids = (n.children ?? []).filter((c) => !isPhantom(c.id));
      rows.push({ node: n, parent, children: kids.map(shown), depth: (n.depth ?? 0) + 1 });
      kids.forEach((k) => walk(k, shown(n)));
    };
    walk(root, "");
    const binary = type === "bt";
    return (
      <table className="styled-table">
        <caption>{binary ? "Binary tree" : "Tree"}, one row per node</caption>
        <thead>
          <tr>
            <th scope="col">Node</th>
            <th scope="col">Parent</th>
            {binary && <th scope="col">Position</th>}
            <th scope="col">Children</th>
            <th scope="col">Level</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.node.id}>
              <th scope="row">{shown(r.node)}</th>
              <td>{r.parent || "None (root)"}</td>
              {binary && <td>{getNodePosition(tree, r.node.id)}</td>}
              <td>{r.children.length ? r.children.join(", ") : "None"}</td>
              <td>{r.depth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === "ll") {
    const list = d as IRLinkedList;
    if (!list.nodes.length) return <Empty />;
    return (
      <table className="styled-table">
        <caption>Linked list, one row per node</caption>
        <thead>
          <tr>
            <th scope="col">Position</th>
            <th scope="col">Value</th>
            <th scope="col">Next</th>
          </tr>
        </thead>
        <tbody>
          {list.nodes.map((n, i) => (
            <tr key={n.id}>
              <th scope="row">{i + 1}</th>
              <td>{shown(n)}</td>
              <td>{i < list.nodes.length - 1 ? shown(list.nodes[i + 1]) : "None (tail)"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const array = d as IRArray;
  if (!array.elements.length) return <Empty />;
  if (type === "2arr") {
    const cols = Math.max(...array.elements.map((r) => r.children?.length ?? 0));
    return (
      <table className="styled-table">
        <caption>2D array, row by row</caption>
        <thead>
          <tr>
            <td />
            {Array.from({ length: cols }, (_, c) => (
              <th key={c} scope="col">
                Column {c + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {array.elements.map((row, r) => (
            <tr key={row.id}>
              <th scope="row">Row {r + 1}</th>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}>{row.children?.[c]?.value ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className="styled-table">
      <caption>Array, one row per element</caption>
      <thead>
        <tr>
          <th scope="col">Index</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {array.elements.map((el, i) => (
          <tr key={el.id}>
            <th scope="row">{i}</th>
            <td>{el.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ================= Tactile =================

/** Longest label (in characters) that still fits inside a braille-labelled shape. */
export const TACTILE_MAX_LABEL = 6;

/**
 * Can Arboretum's braille-on-diagram rendering show every label? It prints the actual values
 * in braille, so labels must be short and made of letters, digits or simple punctuation.
 * Otherwise callers should use the numbered-key tactile renderer.
 */
export function canRenderBrailleLabels(type: DiagramType, data: FlowchartData): boolean {
  const d = toArboretumDiagram(type, data, "");
  if (!d) return false;
  const values: string[] = [];
  if (isTreeType(type)) (d as IRTree).nodes.forEach((n) => values.push(shown(n)));
  else if (type === "ll") (d as IRLinkedList).nodes.forEach((n) => values.push(shown(n)));
  else (d as IRArray).elements.forEach((e) => (e.children ?? [e]).forEach((c) => values.push(c.value)));
  if (!values.length) return false;
  return values.every((v) => {
    const t = v.trim();
    return t.length > 0 && t.length <= TACTILE_MAX_LABEL && generateBrailleText(t).length === t.length;
  });
}

/**
 * Is the tactile view the numbered graphic with a key? True for flowcharts, and for data
 * structures whose values are too long to print on the diagram. The Braille view and the
 * Export braille file both use this, so they include the same key.
 */
export function tactileViewHasKey(type: DiagramType, data: FlowchartData): boolean {
  return !(isDataStructure(type) && canRenderBrailleLabels(type, data));
}

type Shape = { cx: number; cy: number; text: string };

const cellRadius = 30;

function BrailleDots({ text, cx, cy }: { text: string; cx: number; cy: number }) {
  const width = generateBrailleText(text).length * letterSpacing;
  const dots = generateBrailleSvg(text, cx - width / 2 + brailleOffset, cy - dotSpacing + brailleOffset);
  return (
    <>
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#000" />
      ))}
    </>
  );
}

export function TypedTactile({ type, data, title }: Props) {
  const d = useDiagram(type, data, title);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const scene = useMemo(() => {
    if (!d) return null;
    const shapes: Shape[] = [];
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    let shape: "circle" | "box" = "circle";
    const pad = 60;

    if (isTreeType(type)) {
      const tree = d as IRTree;
      const placed = buildPositionTree(tree, [110, 110]).descendants();
      const real = placed.filter((n) => n.data && !isPhantom(n.data.id));
      if (!real.length) return null;
      const minX = Math.min(...real.map((n) => n.x ?? 0));
      const minY = Math.min(...real.map((n) => n.y ?? 0));
      const ox = pad - minX + cellRadius;
      const oy = pad - minY + cellRadius;
      real.forEach((n) => shapes.push({ cx: (n.x ?? 0) + ox, cy: (n.y ?? 0) + oy, text: shown(n.data!) }));
      const pos = new Map(real.map((n) => [n.data!.id, n]));
      tree.edges.forEach((e) => {
        const a = pos.get(e.parent);
        const b = pos.get(e.child);
        if (a && b) lines.push({ x1: (a.x ?? 0) + ox, y1: (a.y ?? 0) + oy, x2: (b.x ?? 0) + ox, y2: (b.y ?? 0) + oy });
      });
    } else if (type === "ll") {
      shape = "box";
      (d as IRLinkedList).nodes.forEach((n, i) =>
        shapes.push({ cx: pad + cellRadius + i * 110, cy: pad + cellRadius, text: shown(n) })
      );
      shapes.slice(0, -1).forEach((s, i) =>
        lines.push({ x1: s.cx + cellRadius, y1: s.cy, x2: shapes[i + 1].cx - cellRadius, y2: s.cy })
      );
    } else {
      shape = "box";
      const arr = d as IRArray;
      if (isArrayType(type) && type === "2arr") {
        arr.elements.forEach((row, r) =>
          (row.children ?? []).forEach((c, ci) =>
            shapes.push({ cx: pad + cellRadius + ci * 2 * cellRadius, cy: pad + cellRadius + r * 2 * cellRadius, text: c.value })
          )
        );
      } else {
        arr.elements.forEach((e, i) =>
          shapes.push({ cx: pad + cellRadius + i * 2 * cellRadius, cy: pad + cellRadius, text: e.value })
        );
      }
    }
    if (!shapes.length) return null;
    const width = Math.max(...shapes.map((s) => s.cx)) + cellRadius + pad;
    const height = Math.max(...shapes.map((s) => s.cy)) + cellRadius + pad;
    return { shapes, lines, shape, width, height };
  }, [d, type]);

  if (!scene) return <Empty />;

  const download = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    downloadTextFile(`${fileNameBase(title, "tactile")}.svg`, xml, "image/svg+xml");
  };

  return (
    <div>
      <p className="typed-hint">
        Braille labels are printed on each shape, ready for swell paper or an embosser. Download the
        SVG to print it.
      </p>
      <div className="typed-scroll">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          width={scene.width}
          height={scene.height}
          role="img"
          aria-label={`Tactile ${type === "ll" ? "linked list" : type === "2arr" ? "2D array" : type === "arr" ? "array" : type === "bt" ? "binary tree" : "tree"} with braille labels`}
          style={{ background: "#fff" }}
        >
          {scene.lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#000" strokeWidth={2} />
          ))}
          {scene.shapes.map((s, i) => (
            <g key={i}>
              {scene.shape === "circle" ? (
                <circle cx={s.cx} cy={s.cy} r={cellRadius} fill="#fff" stroke="#000" strokeWidth={2} />
              ) : (
                <rect
                  x={s.cx - cellRadius}
                  y={s.cy - cellRadius}
                  width={cellRadius * 2}
                  height={cellRadius * 2}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={2}
                />
              )}
              <BrailleDots text={s.text} cx={s.cx} cy={s.cy} />
            </g>
          ))}
        </svg>
      </div>
      <button type="button" className="btn" onClick={download}>
        Download tactile SVG
      </button>
    </div>
  );
}
