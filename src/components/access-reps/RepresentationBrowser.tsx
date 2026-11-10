import React, { useMemo, useState } from "react";
import type { FlowchartData } from "../../types/types";
import { isDataStructure, normalizeDiagramType } from "../../arboretum/diagramTypes";
import { viewsForType } from "../../arboretum/views";
import type { ViewId } from "../../arboretum/views";
import AccessibleTable from "./AccessibleTable";
import NavigableList from "./NavigableList";
import AccessibleMarkdown from "./AccessibleMarkdown";
import Tactile from "./TactileRenderer";
import AltTextView from "./AltTextView";
import BrailleView from "./BrailleView";
import { TypedNavigable, TypedTable, TypedTactile, canRenderBrailleLabels } from "./typed/TypedViews";

type Props = {
  data: FlowchartData;
  /** Saved diagram type (`flowchart_type`); anything unknown is treated as a flowchart. */
  diagramType?: string | null;
  summary: string;
  shortAlt?: string | null;
  title?: string | null;
  imageDataUrl?: string | null;
  /** Editor route, so an empty Alt text view can link back to it. */
  editPath?: string;
  /** Shared page address, written into the braille file. */
  shareUrl?: string | null;
  /** View to start on, e.g. from `?view=` in the URL. Falls back to the type's default. */
  initialView?: string | null;
  onViewChange?: (view: ViewId) => void;
};

/** The "Choose a representation" menu and the chosen view, for any diagram type. */
const RepresentationBrowser: React.FC<Props> = ({
  data,
  diagramType,
  summary,
  shortAlt,
  title,
  imageDataUrl,
  editPath,
  shareUrl,
  initialView,
  onViewChange,
}) => {
  const type = normalizeDiagramType(diagramType);
  const braille = useMemo(
    () => isDataStructure(type) && canRenderBrailleLabels(type, data),
    [type, data]
  );
  const views = useMemo(() => viewsForType(type, braille), [type, braille]);

  const [picked, setPicked] = useState<ViewId | null>(null);
  const requested = (picked ?? initialView) as ViewId | null;
  const view: ViewId = views.some((v) => v.value === requested)
    ? (requested as ViewId)
    : views[0].value;

  return (
    <div>
      <label htmlFor="view-select" style={{ fontWeight: "bold" }}>
        Choose a representation:
      </label>
      <select
        id="view-select"
        value={view}
        onChange={(e) => {
          const next = e.target.value as ViewId;
          setPicked(next);
          onViewChange?.(next);
        }}
        style={{ marginTop: 10, padding: 6, display: "block" }}
      >
        {views.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 24, textAlign: "left" }}>
        {view === "summary" && (
          <AccessibleMarkdown
            content={summary}
            imageDataUrl={imageDataUrl}
            imageAlt={shortAlt ?? ""}
            flowchartData={data}
          />
        )}
        {view === "alt" && <AltTextView shortAlt={shortAlt} title={title} editPath={editPath} />}
        {view === "table" &&
          (isDataStructure(type) ? (
            <TypedTable type={type} data={data} title={title} />
          ) : (
            <AccessibleTable json={data} />
          ))}
        {view === "navigable" &&
          (isDataStructure(type) ? (
            <TypedNavigable type={type} data={data} title={title} />
          ) : (
            <NavigableList jsonData={data} />
          ))}
        {view === "tactile" &&
          (braille ? (
            <TypedTactile type={type} data={data} title={title} />
          ) : (
            <Tactile json={data} title={title} />
          ))}
        {view === "braille" && (
          <BrailleView
            data={data}
            title={title}
            shortAlt={shortAlt}
            summary={summary}
            includeKey={!braille}
            shareUrl={shareUrl}
          />
        )}
      </div>
    </div>
  );
};

export default RepresentationBrowser;
