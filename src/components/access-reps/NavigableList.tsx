import React, { useState, useRef, useLayoutEffect } from 'react';
import './styles/Nav.css';
import type { FlowchartData, NodeData} from '../../types/types';

type Props = {
  jsonData: FlowchartData;
};
type Box = { id: string; x: number; y: number; w: number; h: number };

function boxesOverlap(a: Box, b: Box, gap: number) {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}
function resolveOverlaps(
  initial: Record<string, { x: number; y: number }>,
  rects: Record<string, { w: number; h: number }>,
  gap = 60,
  iterations = 250
) {
  // mutable copy
  const pos: Record<string, { x: number; y: number }> = JSON.parse(JSON.stringify(initial));

  const ids = Object.keys(pos);

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const aId = ids[i];
        const bId = ids[j];
        const aR = rects[aId];
        const bR = rects[bId];
        if (!aR || !bR) continue;

        const a: Box = { id: aId, x: pos[aId].x, y: pos[aId].y, w: aR.w, h: aR.h };
        const b: Box = { id: bId, x: pos[bId].x, y: pos[bId].y, w: bR.w, h: bR.h };

        if (!boxesOverlap(a, b, gap)) continue;

        // Push apart along the axis of least penetration (stable + deterministic)
        const axc = a.x + a.w / 2;
        const ayc = a.y + a.h / 2;
        const bxc = b.x + b.w / 2;
        const byc = b.y + b.h / 2;

        const dx = axc - bxc;
        const dy = ayc - byc;

        const overlapX = (a.w / 2 + b.w / 2 + gap) - Math.abs(dx);
        const overlapY = (a.h / 2 + b.h / 2 + gap) - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const push = overlapX / 2;
          pos[aId].x += dx >= 0 ? push : -push;
          pos[bId].x += dx >= 0 ? -push : push;
        } else {
          const push = overlapY / 2;
          pos[aId].y += dy >= 0 ? push : -push;
          pos[bId].y += dy >= 0 ? -push : push;
        }

        moved = true;
      }
    }

    if (!moved) break;
  }

  return pos;
}
function rectBorderPoint(
  cx: number,
  cy: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
  padding = 8 // extra gap so the line doesn’t touch the border
) {
  const halfW = w / 2 + padding;
  const halfH = h / 2 + padding;

  // Avoid division by zero
  const adx = Math.abs(dx) < 1e-6 ? 1e-6 : Math.abs(dx);
  const ady = Math.abs(dy) < 1e-6 ? 1e-6 : Math.abs(dy);

  // Scale needed to hit vertical/horizontal side
  const tx = halfW / adx;
  const ty = halfH / ady;

  // Choose the first boundary we hit
  const t = Math.min(tx, ty);

  return { x: cx + dx * t, y: cy + dy * t };
}
function layoutDiffSmall(
  a: Record<string, { x: number; y: number }>,
  b: Record<string, { x: number; y: number }>,
  tol = 1
) {
  const aIds = Object.keys(a);
  const bIds = Object.keys(b);
  if (aIds.length !== bIds.length) return false;

  for (const id of aIds) {
    const pa = a[id];
    const pb = b[id];
    if (!pa || !pb) return false;
    if (Math.abs(pa.x - pb.x) > tol || Math.abs(pa.y - pb.y) > tol) return false;
  }
  return true;
}
const NavigableList: React.FC<Props> = ({ jsonData }) => {
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
   const containerRef = useRef<HTMLDivElement | null>(null);

  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [layoutLocked, setLayoutLocked] = useState(false);
  const [nodeRects, setNodeRects] = useState<Record<string, { w: number; h: number }>>({});
  const [layoutPos, setLayoutPos] = useState<Record<string, { x: number; y: number }>>({});
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
 
  // Hooks below must run on every render, so read the data without returning early.
  const nodes = jsonData?.nodes ?? [];
  const edges = jsonData?.edges ?? [];

  useLayoutEffect(() => {
  setLayoutLocked(false);
  setLayoutPos({});
  setCanvasSize({ w: 0, h: 0 });
  setNodeRects({});
}, [jsonData]);
  
  const getNodeById = (id: string): NodeData | undefined => {
    return nodes.find((n) => n.id === id);
  };
   const getNodeLabelById = (id: string): string => {
    const node = getNodeById(id);
    return node?.label || 'Unknown';
  };
  const getRenderPos = (nodeId: string) => {
  const laidOut = layoutPos[nodeId];
  if (laidOut) return laidOut;

  const node = getNodeById(nodeId);
  const raw = node?.coordinates?.[0];
  return raw ? { x: raw[0], y: raw[1] } : null;
};
useLayoutEffect(() => {
  if (layoutLocked) return; // ✅ stop measuring once locked
  const measure = () => {
    const next: Record<string, { w: number; h: number }> = {};

    for (const node of nodes) {
      const el = nodeRefs.current[node.id];
      if (!el) continue;

      // Use getBoundingClientRect for subpixel stability
      const r = el.getBoundingClientRect();
      next[node.id] = { w: Math.round(r.width), h: Math.round(r.height) };
    }

    setNodeRects((prev) => {
      // shallow compare with tolerance
      const ids = Object.keys(next);
      if (ids.length !== Object.keys(prev).length) return next;

      for (const id of ids) {
        const a = prev[id];
        const b = next[id];
        if (!a || !b) return next;

        // allow 1px wiggle without updating state
        if (Math.abs(a.w - b.w) > 1 || Math.abs(a.h - b.h) > 1) return next;
      }
      return prev; // no meaningful change, avoid re-render loop
    });
  };

  measure();

  const ro = new ResizeObserver(() => {
    // coalesce multiple resize events into one frame
    requestAnimationFrame(measure);
  });

  for (const node of nodes) {
    const el = nodeRefs.current[node.id];
    if (el) ro.observe(el);
  }

  return () => ro.disconnect();
}, [nodes.length, layoutLocked]);
useLayoutEffect(() => {
    if (layoutLocked) return; // ✅ don’t recompute once locked
  // Need measured sizes for every node to do this correctly
  const allMeasured = nodes.every(n => nodeRects[n.id]);
  if (!allMeasured) return;

  // 1) start from your extracted coordinates
  const initial: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    const [x, y] = n.coordinates[0];
    initial[n.id] = { x, y };
  }

  // 2) resolve node-node collisions
  const GAP = 60;          // space between nodes
  const PADDING = 40;      // space from canvas boundary
  const posNoOverlap = resolveOverlaps(initial, nodeRects, GAP, 300);

  // 3) compute bounding box of the final layout
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const n of nodes) {
    const p = posNoOverlap[n.id];
    const r = nodeRects[n.id];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + r.w);
    maxY = Math.max(maxY, p.y + r.h);
  }

  // 4) shift everything so it starts at (PADDING, PADDING)
  const shiftX = PADDING - minX;
  const shiftY = PADDING - minY;

  const shifted: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    shifted[n.id] = {
      x: posNoOverlap[n.id].x + shiftX,
      y: posNoOverlap[n.id].y + shiftY,
    };
  }

  // 5) set canvas size (content + padding on the far side too)
  const contentW = (maxX - minX) + PADDING * 2;
  const contentH = (maxY - minY) + PADDING * 2;

  setLayoutPos((prev) => {
  if (layoutDiffSmall(prev, shifted, 1)) return prev;
  return shifted;
});
  setCanvasSize((prev) => {
  const next = { w: Math.ceil(contentW), h: Math.ceil(contentH) };
  if (Math.abs(prev.w - next.w) <= 1 && Math.abs(prev.h - next.h) <= 1) return prev;
  return next;
});

 setLayoutLocked(true);
}, [nodes.length, nodeRects, layoutLocked]); 

  if (!jsonData) {
    return <div>Loading STEM image...</div>;
  }


const renderEdges = () => {
  const layoutReady = nodes.every(n => layoutPos[n.id]) && nodes.every(n => nodeRects[n.id]);
if (!layoutReady) return null;
  return (
    <svg className="flow-edges" aria-hidden="true" width={canvasSize.w || 1}
  height={canvasSize.h || 1} viewBox={`0 0 ${canvasSize.w || 1} ${canvasSize.h || 1}`}
  preserveAspectRatio="none">
      {edges.map((edge, i) => {
        const source = getNodeById(edge.source);
        const target = getNodeById(edge.destination);
        if (!source || !target) return null;

        const sTopLeft = layoutPos[source.id];
        const tTopLeft = layoutPos[target.id];
        if (!sTopLeft || !tTopLeft) return null;

        const sRect = nodeRects[source.id];
        const tRect = nodeRects[target.id];
        if (!sRect || !tRect) return null;

        const sx = sTopLeft.x + sRect.w / 2;
        const sy = sTopLeft.y + sRect.h / 2;
        const tx = tTopLeft.x + tRect.w / 2;
        const ty = tTopLeft.y + tRect.h / 2;

        const dx = tx - sx;
        const dy = ty - sy;
        const len = Math.hypot(dx, dy) || 1;

        
        const ux = dx / len;
        const uy = dy / len;

        // Start at source border in direction of target
        const start = rectBorderPoint(sx, sy, sRect.w, sRect.h, ux, uy, 10);
        // End at target border in direction back toward source
        const end = rectBorderPoint(tx, ty, tRect.w, tRect.h, -ux, -uy, 10);
        
        if (len < 40) {
      // extend endpoints slightly outward
      const extend = (40 - len) / 2;
      start.x -= ux * extend;
      start.y -= uy * extend;
      end.x   += ux * extend;
      end.y   += uy * extend;
    }

        const highlighted = activeEdgeId === edge.id;

        return (
          <line
            key={edge.id || i}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            className={highlighted ? 'edge-line highlighted' : 'edge-line'}
          />
        );
      })}
    </svg>
  );
};


// ✅ MISSING EFFECT: measure node sizes


  const handleNodeFocus = (nodeId: string) => {
    setFocusedNode(nodeId);
    const el = nodeRefs.current[nodeId];
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };


  
const layoutReady = nodes.every(n => layoutPos[n.id]) && nodes.every(n => nodeRects[n.id]);

const fallbackCanvas = (() => {
  let maxX = 0, maxY = 0;
  for (const n of nodes) {
  const [x, y] = n.coordinates[0];
  const r = nodeRects[n.id];
  maxX = Math.max(maxX, x + (r?.w ?? 300) + 80);
  maxY = Math.max(maxY, y + (r?.h ?? 200) + 80);
}
  return { w: maxX, h: maxY };
})();

const effectiveCanvas = layoutReady ? canvasSize : fallbackCanvas;

  return (
    <div className="flowchart-wrapper" aria-label="STEM image view">
      <nav className="flowchart-nav" aria-label="Jump to node">
        {nodes.map((node) => (
          <button key={node.id} onClick={() => handleNodeFocus(node.id)}>
            {getNodeLabelById(node.id)}
          </button>
        ))}
      </nav>

      <div className="flowchart-container" ref={containerRef}>
        <div className="flowchart-scroll">
          <div className="flowchart-canvas" style={{ width: Math.max(effectiveCanvas.w, 1), height: Math.max(effectiveCanvas.h, 1) }}>
        
        {renderEdges()}

        {nodes.map((node) => {
         const p = getRenderPos(node.id); // <-- use computed
        if (!p) return null;
          const outgoingEdges = edges.filter((e) => e.source === node.id);
          const incomingEdges = edges.filter((e) => e.destination === node.id);

          return (
            <div
              key={node.id}
              className={`flow-node ${focusedNode === node.id ? 'focused' : ''}`}
              style={{ top: p.y, left: p.x }}
              tabIndex={0}
              ref={(el) => { nodeRefs.current[node.id] = el; }}
              aria-label={`Node: ${getNodeLabelById(node.id)}`}
            >
              <strong>{getNodeLabelById(node.id)}</strong>

              {outgoingEdges.length > 0 && (
                <div className="edge-links">
                  <p>
                    <em>Outgoing:</em>
                  </p>
                  <ul>
                    {outgoingEdges.map((edge) => (
                      <li key={edge.id}>
                        <a
                          href={`#${edge.destination}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleNodeFocus(edge.destination);
                          }}
                          onMouseEnter={() => setActiveEdgeId(edge.id || null)}
                          onMouseLeave={() => setActiveEdgeId(null)}
                          onFocus={() => setActiveEdgeId(edge.id || null)}
                          onBlur={() => setActiveEdgeId(null)}
                        >
                          {edge.label || 'Edge'} → {getNodeLabelById(edge.destination)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {incomingEdges.length > 0 && (
                <div className="edge-links">
                  <p>
                    <em>Incoming:</em>
                  </p>
                  <ul>
                    {incomingEdges.map((edge) => (
                      <li key={`in-${edge.id}`}>
                        From{' '}
                        <a
                          href={`#${edge.source}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleNodeFocus(edge.source);
                          }}
                          onMouseEnter={() => setActiveEdgeId(edge.id || null)}
                          onMouseLeave={() => setActiveEdgeId(null)}
                          onFocus={() => setActiveEdgeId(edge.id || null)}
                          onBlur={() => setActiveEdgeId(null)}
                        >
                          {getNodeLabelById(edge.source)}
                        </a>{' '}
                        — {edge.label || ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
                </div>
        </div>
      </div>
    </div>
  );
};

export default NavigableList;
