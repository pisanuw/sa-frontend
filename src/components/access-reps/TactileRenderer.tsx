import React, { useRef, type JSX } from 'react';
import { toPng } from 'html-to-image';
import type { FlowchartData, NodeData, EdgeData } from '../../types/types';

const brailleDigits = ['⠁', '⠃', '⠉', '⠙', '⠑', '⠋', '⠛', '⠓', '⠊', '⠚'];
const toBrailleNumber = (n: number): string =>
  n.toString().split('').map((d) => brailleDigits[+d]).join('');

type FlowchartLegendProps = {
  nodes: NodeData[];
  edges: EdgeData[];
};

type LegendItem =
  | { type: 'node'; id: string; label: string }
  | { type: 'edge'; label: string };


const FlowchartLegend: React.FC<FlowchartLegendProps> = ({ nodes, edges }) => {
  const dedupedEdgeLabels = [...new Set(edges.map((edge) => edge.label).filter(Boolean))];

  const combinedList: LegendItem[] = [
  ...nodes.map((node) => ({
    type: 'node' as const,
    id: node.id,
    label: node.label || 'Unnamed Node',
  })),
  ...dedupedEdgeLabels.map((label) => ({
    type: 'edge' as const,
    label: label!,
  })),
];


  return (
    <div className="legend" style={{ marginBottom: '2rem' }}>
      <h2>Legend</h2>
      <ul>
        {combinedList.map((item, idx) => (
            <li key={item.type === 'node' ? `node-${item.id}` : `edge-${item.label}`}>
            <strong>{idx + 1}.</strong>{' '}
            {item.type === 'node' ? item.label : `Edge label: ${item.label}`}
            </li>
        ))}
        </ul>

    </div>
  );
};

type TactileFlowchartProps = {
  nodes: NodeData[];
  edges: EdgeData[];
};

function normalizeCoordinates(
  nodes: NodeData[],
  pageWidth: number,
  pageHeight: number,
  margin = 50
): NodeData[] {
  const xs = nodes.map((n) => n.coordinates[0][0]);
  const ys = nodes.map((n) => n.coordinates[0][1]);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const scaleX = (pageWidth - 2 * margin) / (maxX - minX);
  const scaleY = (pageHeight - 2 * margin) / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);

  return nodes.map((n) => {
  const x = margin + (n.coordinates[0][0] - minX) * scale;
  const y = margin + (n.coordinates[0][1] - minY) * scale;

  return {
    ...n,
    coordinates: [[x, y], [x, y]], // duplicate point
  };
});
}

const TactileFlowchart: React.FC<TactileFlowchartProps> = ({ nodes, edges }) => {
  const shapeSize = 60;
  const uniqueLabels = [...new Set(edges.map((e) => e.label).filter(Boolean))];
  const edgeLabelMap = Object.fromEntries(
    uniqueLabels.map((label, i) => [label, toBrailleNumber(i + 1)])
  );

  const renderShape = (
    x: number,
    y: number,
    shape: string,
    label: string
  ): JSX.Element => {
    const half = shapeSize / 2;
    const fontSize = 30;

    switch (shape) {
      case 'diamond':
        return (
          <g>
            <polygon
              points={`${x},${y - half} ${x + half},${y} ${x},${y + half} ${x - half},${y}`}
              fill="white"
              stroke="black"
              strokeWidth="2"
            />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={fontSize}>
              {label}
            </text>
          </g>
        );
      case 'circle':
        return (
          <g>
            <circle cx={x} cy={y} r={half} fill="white" stroke="black" strokeWidth="2" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={fontSize}>
              {label}
            </text>
          </g>
        );
      case 'stadium':
        return (
          <g>
            <rect
              x={x - half}
              y={y - half}
              width={shapeSize}
              height={shapeSize}
              rx={half}
              ry={half}
              fill="white"
              stroke="black"
              strokeWidth="2"
            />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={fontSize}>
              {label}
            </text>
          </g>
        );
      case 'parallelogram': {
        const skew = 20;
        return (
          <g>
            <polygon
              points={`
                ${x - half + skew},${y - half}
                ${x + half + skew},${y - half}
                ${x + half - skew},${y + half}
                ${x - half - skew},${y + half}
              `}
              fill="white"
              stroke="black"
              strokeWidth="2"
            />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={fontSize}>
              {label}
            </text>
          </g>
        );
      }
      default:
        return (
          <g>
            <rect
              x={x - half}
              y={y - half}
              width={shapeSize}
              height={shapeSize}
              fill="white"
              stroke="black"
              strokeWidth="2"
            />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={fontSize}>
              {label}
            </text>
          </g>
        );
    }
  };

  const shortenLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    offset: number
  ): [number, number, number, number] => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    return [
      x1 + Math.cos(angle) * offset,
      y1 + Math.sin(angle) * offset,
      x2 - Math.cos(angle) * offset,
      y2 - Math.sin(angle) * offset,
    ];
  };

  const getPerpendicularOffset = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    distance = 20
  ): [number, number] => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return [0, 0];
    const ux = -dy / length;
    const uy = dx / length;
    return [ux * distance, uy * distance];
  };
  
  return (
    <svg width={850} height={1100} style={{ background: 'white' }}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="5"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="black" />
        </marker>
      </defs>

      {edges.map((edge, idx) => {
        const source = nodes.find((n) => n.id === edge.source);
        const target = nodes.find((n) => n.id === edge.destination);
        if (!source || !target) return null;

        const [x1, y1, x2, y2] = shortenLine(
          source.coordinates[0][0],
          source.coordinates[0][1],
          target.coordinates[0][0],
          target.coordinates[0][1],
          40
        );

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const [ox, oy] = getPerpendicularOffset(x1, y1, x2, y2, 30);
        const labelX = midX + ox;
        const labelY = midY + oy;

        const showArrow = edge.markerEnd?.type === 'arrowclosed';
        const strokeDasharray = edge.type === 'dashed' ? '5,5' : 'none';

        return (
          <g key={idx}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="black"
              strokeWidth="2"
              markerEnd={showArrow ? 'url(#arrowhead)' : undefined}
              strokeDasharray={strokeDasharray}
            />
            {edge.label && edgeLabelMap[edge.label] && (
              <text
                x={labelX}
                y={labelY - 5}
                textAnchor="middle"
                fontSize="22"
                fontFamily="Arial, sans-serif"
                dominantBaseline="middle"
              >
                {edgeLabelMap[edge.label]}
              </text>
            )}
          </g>
        );
      })}

      {nodes.map((node, idx) => {
        const [x, y] = node.coordinates[0];
        const shape = node.shape || 'rectangle';
        const braille = toBrailleNumber(idx + 1);
        return <g key={node.id}>{renderShape(x, y, shape, braille)}</g>;
      })}
    </svg>
  );
};

type DownloadButtonProps = {
    targetRef: React.RefObject<HTMLDivElement | null>;
  };
  

const DownloadButton: React.FC<DownloadButtonProps> = ({ targetRef }) => {
  const handleDownload = () => {
    if (targetRef.current) {
      toPng(targetRef.current, {
        cacheBust: true,
        backgroundColor: 'white',
        pixelRatio: 6,
      }).then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'tactile-flowchart.png';
        link.href = dataUrl;
        link.click();
      });
    }
  };

  return (
    <button onClick={handleDownload} style={{ marginTop: '1rem' }}>
      Download Flowchart Image
    </button>
  );
};

type TactileProps = {
  json: FlowchartData;
};

const Tactile: React.FC<TactileProps> = ({ json }) => {
  const flowchartRef = useRef<HTMLDivElement>(null);
  const { nodes, edges } = json;
  const pageSize = { width: 850, height: 1100 }; // letter-size page
  const normalizedNodes = normalizeCoordinates(nodes, pageSize.width, pageSize.height);

  return (
    <div style={{ padding: '2rem' }}>
      <FlowchartLegend nodes={nodes} edges={edges} />
      <div ref={flowchartRef} style={{ border: '1px black solid' }}>
        <TactileFlowchart nodes={normalizedNodes} edges={edges} />
      </div>
      <DownloadButton targetRef={flowchartRef} />
    </div>
  );
};

export default Tactile;
