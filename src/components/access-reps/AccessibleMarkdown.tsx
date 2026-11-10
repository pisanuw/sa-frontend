import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeMath from '../../math/rehypeMath';
import { protectMathInMarkdown } from '../../math/segments';
import MathFormula from './MathFormula';
import { FlowchartViewer } from '../ReactFlowViewer';
import type { FlowchartData } from '../../types/types';

type Props = {
  content: string;
  imageDataUrl?: string | null;
  imageAlt?: string;
  flowchartData?: FlowchartData | null;
};

const AccessibleMarkdown: React.FC<Props> = ({
  content,
  imageDataUrl,
  imageAlt,
  flowchartData,
}) => {

  const figureDescription =
    imageAlt ||
    'Digital STEM image preview. A detailed description follows below.';
   return (
    <div>
      {flowchartData ? (
        <figure
          style={{ margin: '0 0 16px 0' }}
          aria-labelledby="flowchart-caption"
        >
          <div aria-hidden="true">
            <FlowchartViewer flowchartData={flowchartData} />
          </div>
          <figcaption id="flowchart-caption" style={{ marginTop: 8 }}>
  {figureDescription} 
</figcaption>
        </figure>
      ) : imageDataUrl ? (
        <figure style={{ margin: '0 0 16px 0' }}>
          <img
            src={imageDataUrl}
            alt={imageAlt || 'STEM image'}
            style={{
              width: '400px',
              height: 'auto',
              border: '1px solid black',
              borderRadius: 8,
            }}
          />
        </figure>
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeMath]}
        components={{
          // Math ($…$, $$…$$) marked by rehypeMath, drawn by MathJax.
          span: ({ node, ...props }) =>
            node?.properties?.dataTex !== undefined ? (
              <MathFormula
                tex={String(node.properties.dataTex)}
                display={node.properties.dataDisplay === 'true'}
              />
            ) : (
              <span {...props} />
            ),
          h1: ({ node, ...props }) => <h1 tabIndex={-1} id="summary-heading" {...props} />,
          h2: ({ node, ...props }) => <h2 tabIndex={-1} {...props} />,
          h3: ({ node, ...props }) => <h3 tabIndex={-1} {...props} />,

          ul: ({ node, ...props }) => <ul {...props} />,
          ol: ({ node, ...props }) => <ol {...props} />,
          li: ({ node, ...props }) => <li {...props} />,

          p: ({ node, ...props }) => <p style={{ lineHeight: '1.6' }} {...props} />,
          strong: ({ node, ...props }) => <strong style={{ fontWeight: 600 }} {...props} />,
          a: ({ node, ...props }) => (
            <a
              {...props}
              style={{ color: '#0645ad' }}
              target="_blank"
              rel="noopener noreferrer"
            />
          ),

          table: ({ node, ...props }) => (
            <div style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                }}
                {...props}
              />
            </div>
          ),

          thead: ({ node, ...props }) => <thead {...props} />,
          tbody: ({ node, ...props }) => <tbody {...props} />,
          tr: ({ node, ...props }) => <tr {...props} />,

          th: ({ node, ...props }) => (
            <th
              scope="col"
              style={{
                border: '1px solid #ccc',
                padding: '8px',
                textAlign: 'left',
                fontWeight: 700,
              }}
              {...props}
            />
          ),

          td: ({ node, ...props }) => (
            <td
              style={{
                border: '1px solid #ccc',
                padding: '8px',
                verticalAlign: 'top',
              }}
              {...props}
            />
          ),
        }}
      >
        {protectMathInMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
};

export default AccessibleMarkdown;