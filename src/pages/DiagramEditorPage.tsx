import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../pages/styles/DiagramEditorPage.css";
import type { FlowchartData } from "../types/types";
import { ReactFlowProvider } from "@xyflow/react";
import { UnifiedFlowApp } from "../components/ReactFlow";
import { apiFetch } from "../lib/api";
import { guestFetch } from "../lib/guest";
import EditorToolbar, { type EditorMode } from "../components/editor/EditorToolbar";
import AccessibilityPanel from "../components/editor/AccessibilityPanel";
import ImageTypeSelect from "../components/editor/ImageTypeSelect";
import ShareToolbar from "../components/access-reps/ShareToolbar";
import { jsonToMermaid } from "../services/utils";
import { structuralSignature } from "../lib/structuralSignature";
import { parseMermaidText, MARKDOWN_EXAMPLES } from "../lib/mermaidText";
import { FlowchartViewer } from "../components/ReactFlowViewer";
import AccessibilityEditorModal from "../components/editor/AccessibilityEditorPanel";
import type {
  LongDescriptionSections,
  LongDescriptionSectionKey,
} from "../types/longDescription";
import {
  createEmptyLongDescriptionSections,
  parseLongDescriptionMarkdown,
  buildLongDescriptionMarkdown,
} from "../services/longDescription";
import { logResearchEvent } from "../lib/logResearchEvent";
import { normalizeSharing, type Sharing } from "../lib/sharing";
import { normalizeDiagramType } from "../arboretum/diagramTypes";
import type { DiagramType } from "../arboretum/diagramTypes";
import { autoDescribe, checkDiagramType } from "../arboretum/autoDescription";

const createEmptyFlowchart = (): FlowchartData => ({ nodes: [], edges: [] });



const NONVISUAL_EDITING_SUPPORTED = false;


type EditorProps = {
  /** Try-it mode: no account; one public image saved against this browser's guest token. */
  guest?: boolean;
};

const DiagramEditorPage = ({ guest = false }: EditorProps) => {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();

  const [activeFlowchartId, setActiveFlowchartId] = useState<string | null>(null);

  const [flowchartData, setFlowchartData] = useState<FlowchartData | null>(null);
  const [originalFlowchart, setOriginalFlowchart] = useState<FlowchartData | null>(null);

  const [summary, setSummary] = useState("");
  const [shortAlt, setShortAlt] = useState("");
  const [longDescriptionSections, setLongDescriptionSections] =
  useState<LongDescriptionSections>(createEmptyLongDescriptionSections());

  const [imgContent, setImgContent] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [_saveStatus, setSaveStatus] = useState("");

  const [title, setTitle] = useState("");
  const [diagramType, setDiagramType] = useState<DiagramType>(() => {
    // Set by the Create page when starting a blank canvas; saved records load their own type.
    try {
      return normalizeDiagramType(localStorage.getItem("pendingType"));
    } catch {
      return "flowchart";
    }
  });

  const [summaryStale, setSummaryStale] = useState(false);
  const [diagramKey, setDiagramKey] = useState(0);

  const [isPublished, setIsPublished] = useState(false);
  const [sharing, setSharing] = useState<Sharing>(() => {
    // A blank canvas started from the Create page carries the choice made there.
    try {
      return normalizeSharing(localStorage.getItem("pendingSharing"));
    } catch {
      return "private";
    }
  });
  const [imagePublic, setImagePublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [_publishedAt, setPublishedAt] = useState<string | null>(null);

  const [isDirty, setIsDirty] = useState(false);


  const [isAccessibilityEditorOpen, setIsAccessibilityEditorOpen] = useState(false);

  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    const saved = localStorage.getItem("editorMode");
    return saved === "mermaid" ? "mermaid" : "visual";
  });

  const [mermaidText, setMermaidText] = useState<string>(
    () => localStorage.getItem("latestMermaidCode") ?? ""
  );

  const skipNextMermaidSyncRef = useRef(false);
  // True once the person has typed in the markdown box; live parsing only runs after that (or for a
  // brand-new image), so opening a saved image never re-lays it out.
  const markdownTouchedRef = useRef(false);
  // Markdown handed over by the Create page. Held in a ref (not read from storage inside the load
  // effect) so a second effect run, as in React StrictMode, still sees it.
  const pendingMarkdownRef = useRef<string | null>(
    (() => {
      try {
        return localStorage.getItem("pendingMarkdown");
      } catch {
        return null;
      }
    })()
  );
  const [markdownIssues, setMarkdownIssues] = useState<{ error: string | null; warnings: string[] }>({
    error: null,
    warnings: [],
  });
  // Alt text / long description follow the diagram until the author edits them.
  const [altEdited, setAltEdited] = useState(false);
  const [descEdited, setDescEdited] = useState(false);
  const mermaidTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorOpenedLoggedRef = useRef(false);
  const [autoSavePending, setAutoSavePending] = useState(false);

  useEffect(() => {
  if (editorMode !== "mermaid") return;

  const id = window.setTimeout(() => {
    mermaidTextareaRef.current?.focus();
  }, 0);

  return () => window.clearTimeout(id);
}, [editorMode]);


  useEffect(() => {
    localStorage.setItem("editorMode", editorMode);
  }, [editorMode]);

  useEffect(() => {
    localStorage.setItem("latestMermaidCode", mermaidText);
  }, [mermaidText]);

  useEffect(() => {
    if (!showImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowImage(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showImage]);

  // Load by routeId (DB)
  useEffect(() => {
    if (!routeId) return;

    (async () => {
      try {
        setIsLoading(true);
        setSaveStatus("");

        const fc = await apiFetch<{
          flowchart_id: string;
          json_data: FlowchartData;
          summary: string;
          short_alt?: string | null;
          flowchart_type?: string | null;
          has_image: boolean;
          image_mime?: string | null;
          is_published?: boolean;
          public_slug?: string | null;
          published_at?: string | null;
          title?: string | null;
          sharing?: string | null;
          image_public?: boolean;
        }>(`/get/${encodeURIComponent(routeId)}`);
        const incomingSummary = fc.summary ?? "";
        setFlowchartData(fc.json_data);
        setOriginalFlowchart(fc.json_data);
        setSummary(incomingSummary);
        setLongDescriptionSections(parseLongDescriptionMarkdown(incomingSummary));
        // Existing text is kept as written; only empty fields are filled in automatically.
        setAltEdited(!!(fc.short_alt ?? "").trim());
        setDescEdited(!!incomingSummary.trim());
        setShortAlt(fc.short_alt ?? "");
        setTitle(fc.title ?? "");
        setDiagramType(normalizeDiagramType(fc.flowchart_type));

        try {
          const serialized = jsonToMermaid(fc.json_data);
          skipNextMermaidSyncRef.current = true;
          setMermaidText(serialized);
        } catch (err) {
          console.error("Failed to serialize initial flowchart to Mermaid:", err);
        }

        setActiveFlowchartId(fc.flowchart_id);
        logResearchEvent({
          event_type: "Flowchart_Opened",
          editor_mode: editorMode,
          flowchart_id: fc.flowchart_id,
          success: true,
          event_data: {
            source_page: "DiagramEditorPage",
            route_id: routeId,
            node_count: fc.json_data.nodes?.length ?? 0,
            edge_count: fc.json_data.edges?.length ?? 0,
            has_image: fc.has_image,
          },
        });
        setSharing(normalizeSharing(fc.sharing));
        setImagePublic(!!fc.image_public);
        setIsPublished(!!fc.is_published);
        setPublicSlug(fc.public_slug ?? null);
        setPublishedAt(fc.published_at ?? null);

        localStorage.setItem("activeFlowchartId", fc.flowchart_id);

        if (fc.has_image) {
          const img = await apiFetch<{ image_data_url: string; image_mime?: string | null }>(
            `/get/${encodeURIComponent(routeId)}/image`
          );
          setImgContent(img?.image_data_url ?? null);
          if (img?.image_mime) localStorage.setItem("latestDiagramImageMime", img.image_mime);
          if (img?.image_data_url) localStorage.setItem("latestDiagramImage", img.image_data_url);
        } else {
          setImgContent(null);
          localStorage.removeItem("latestDiagramImage");
        }

        setSummaryStale(false);
        setDiagramKey((k) => k + 1);
        setIsDirty(false);
      } catch (e: any) {
        console.error(e);
        setSaveStatus(e?.message || "Failed to load STEM image.");

        const empty = createEmptyFlowchart();
        setFlowchartData(empty);
        setOriginalFlowchart(empty);
        setSummary("");
        setLongDescriptionSections(createEmptyLongDescriptionSections());
        setShortAlt("");
        setTitle("");
        setImgContent(null);
        setSummaryStale(false);

        try {
          const serialized = jsonToMermaid(empty);
          skipNextMermaidSyncRef.current = true;
          setMermaidText(serialized);
        } catch {
          setMermaidText("");
        }

        setActiveFlowchartId(null);
        setIsPublished(false);
        setPublicSlug(null);
        setPublishedAt(null);

        setDiagramKey((k) => k + 1);
        setIsDirty(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [routeId]);

  // Try-it: load this browser's one image, or start a new one from an example.
  useEffect(() => {
    if (!guest) return;
    (async () => {
      setIsLoading(true);
      try {
        const fc = await guestFetch<{
          flowchart_id: string;
          json_data: FlowchartData;
          summary: string;
          short_alt?: string | null;
          flowchart_type?: string | null;
          title?: string | null;
          public_slug?: string | null;
          published_at?: string | null;
        } | null>("/guest/image");

        if (fc) {
          setFlowchartData(fc.json_data);
          setOriginalFlowchart(fc.json_data);
          setSummary(fc.summary ?? "");
          setLongDescriptionSections(parseLongDescriptionMarkdown(fc.summary ?? ""));
          setAltEdited(!!(fc.short_alt ?? "").trim());
          setDescEdited(!!(fc.summary ?? "").trim());
          setShortAlt(fc.short_alt ?? "");
          setTitle(fc.title ?? "");
          setDiagramType(normalizeDiagramType(fc.flowchart_type));
          try {
            skipNextMermaidSyncRef.current = true;
            setMermaidText(jsonToMermaid(fc.json_data));
          } catch {
            /* the text box just starts empty */
          }
          setActiveFlowchartId(fc.flowchart_id);
          setIsPublished(true);
          setSharing("public");
          setPublicSlug(fc.public_slug ?? null);
          setPublishedAt(fc.published_at ?? null);
        } else {
          const example = MARKDOWN_EXAMPLES.flowchart;
          const parsed = parseMermaidText(example);
          setFlowchartData(parsed.error ? createEmptyFlowchart() : parsed.data);
          setOriginalFlowchart(createEmptyFlowchart());
          setDiagramType("flowchart");
          skipNextMermaidSyncRef.current = true;
          setMermaidText(example);
          setEditorMode("mermaid");
          setSharing("public");
        }
        setImgContent(null);
        setSummaryStale(false);
        setDiagramKey((k) => k + 1);
        setIsDirty(false);
      } catch (e: any) {
        console.error(e);
        setSaveStatus(e?.message || "Could not load your try-it image.");
        const empty = createEmptyFlowchart();
        setFlowchartData(empty);
        setOriginalFlowchart(empty);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [guest]);

  // Load from localStorage if no routeId
  useEffect(() => {
    if (routeId || guest) return;

    const storedData = localStorage.getItem("latestDiagramJSON");
    const storedImage = localStorage.getItem("latestDiagramImage");

    const storedActiveId = localStorage.getItem("activeFlowchartId");
    if (storedActiveId && storedActiveId !== "undefined") setActiveFlowchartId(storedActiveId);

    if (!storedData || storedData === "undefined") {
      // A new image started from the Create page may arrive with markdown to show straight away.
      const pendingMd = pendingMarkdownRef.current;
      const fromMd = pendingMd ? parseMermaidText(pendingMd) : null;
      const initial = fromMd && !fromMd.error ? fromMd.data : createEmptyFlowchart();
      const empty = initial;
      setFlowchartData(empty);
      setOriginalFlowchart(createEmptyFlowchart());
      setSummary(localStorage.getItem("latestSummary") ?? "");
      setLongDescriptionSections(
        parseLongDescriptionMarkdown(localStorage.getItem("latestSummary") ?? "")
      );
      setShortAlt("");
      setTitle(localStorage.getItem("latestTitle") || fromMd?.title || "");
      setImgContent(null);
      setSummaryStale(false);
      setDiagramKey((k) => k + 1);
      setIsDirty(false);

      if (pendingMd) {
        skipNextMermaidSyncRef.current = true;
        setMermaidText(pendingMd);
        localStorage.removeItem("pendingMarkdown");
      } else {
        try {
          const serialized = jsonToMermaid(empty);
          skipNextMermaidSyncRef.current = true;
          setMermaidText(serialized);
        } catch {
          setMermaidText("");
        }
      }

      return;
    }

    try {
      const parsed: FlowchartData = JSON.parse(storedData);
      setFlowchartData(parsed);
      setOriginalFlowchart(parsed);
      setDiagramKey((k) => k + 1);

      try {
        const serialized = jsonToMermaid(parsed);
        skipNextMermaidSyncRef.current = true;
        setMermaidText(serialized);
      } catch (err) {
        console.error("Failed to serialize stored flowchart to Mermaid:", err);
      }

      const storedSummary = localStorage.getItem("latestSummary") ?? "";
      const storedShortAlt = localStorage.getItem("latestShortAlt") ?? "";
      const storedTitle = localStorage.getItem("latestTitle") ?? "";

      setShortAlt(storedShortAlt);
      setSummary(storedSummary);
      setLongDescriptionSections(parseLongDescriptionMarkdown(storedSummary));
      setTitle(storedTitle);
      setIsDirty(false);
    } catch (err) {
      console.error("Failed to parse flowchart JSON:", err);
      const empty = createEmptyFlowchart();
      setFlowchartData(empty);
      setOriginalFlowchart(empty);
      setSummary("");
      setLongDescriptionSections(createEmptyLongDescriptionSections());
      setShortAlt("");
      setTitle("");
      setSummaryStale(false);
      setIsDirty(false);

      try {
        const serialized = jsonToMermaid(empty);
        skipNextMermaidSyncRef.current = true;
        setMermaidText(serialized);
      } catch {
        setMermaidText("");
      }
    }

    if (storedImage && storedImage !== "undefined") setImgContent(storedImage);
  }, [routeId]);


  useEffect(() => {
  if (editorOpenedLoggedRef.current) return;
  if (!flowchartData) return;

  editorOpenedLoggedRef.current = true;

  logResearchEvent({
    event_type: "Editor_Opened",
    editor_mode: editorMode,
    flowchart_id: activeFlowchartId ?? undefined,
    success: true,
    event_data: {
      source_page: "DiagramEditorPage",
      node_count: flowchartData.nodes?.length ?? 0,
      edge_count: flowchartData.edges?.length ?? 0,
      has_image: !!imgContent,
      route_id: routeId ?? null,
    },
  });
}, [flowchartData, editorMode, activeFlowchartId, imgContent, routeId]);
  // Sync Mermaid from canonical flowchart state after visual edits
  useEffect(() => {
    if (!flowchartData) return;

    if (skipNextMermaidSyncRef.current) {
      skipNextMermaidSyncRef.current = false;
      return;
    }

    try {
      const nextMermaid = jsonToMermaid(flowchartData);
      setMermaidText((prev) => (prev === nextMermaid ? prev : nextMermaid));
    } catch (err) {
      console.error("Failed to serialize flowchart to Mermaid:", err);
    }
  }, [flowchartData]);

  // Structural-only stale + dirty detection
  useEffect(() => {
    if (!originalFlowchart || !flowchartData) return;

    const changed = structuralSignature(flowchartData) !== structuralSignature(originalFlowchart);
    setSummaryStale(changed);

    if (changed) setIsDirty(true);
  }, [flowchartData, originalFlowchart]);


  const handleLongDescriptionSectionChange = (
    section: LongDescriptionSectionKey,
    nextText: string
  ) => {
    setLongDescriptionSections((prev) => {
      const next: LongDescriptionSections = {
        ...prev,
        [section]: {
          ...prev[section],
          text: nextText,
        },
      };

      const nextSummary = buildLongDescriptionMarkdown(next);
      setSummary(nextSummary);
      localStorage.setItem("latestSummary", nextSummary);

      return next;
    });

    setIsDirty(true);
  };

  const handleLongDescriptionSectionToggle = (
    section: LongDescriptionSectionKey,
    included: boolean
  ) => {
    setLongDescriptionSections((prev) => {
      const next: LongDescriptionSections = {
        ...prev,
        [section]: {
          ...prev[section],
          included,
        },
      };

      const nextSummary = buildLongDescriptionMarkdown(next);
      setSummary(nextSummary);
      localStorage.setItem("latestSummary", nextSummary);

      return next;
    });

    setIsDirty(true);
  };

  const normalizeLongDescriptionSections = (
  incoming?: Partial<Record<LongDescriptionSectionKey, string>>
): LongDescriptionSections => {
  const empty = createEmptyLongDescriptionSections();

  if (!incoming) return empty;

  return {
    purpose: {
      included: true,
      text: incoming.purpose ?? "",
    },
    structure: {
      included: true,
      text: incoming.structure ?? "",
    },
    keyComponents: {
      included: true,
      text: incoming.keyComponents ?? "",
    },
    traversal: {
      included: true,
      text: incoming.traversal ?? "",
    },
    mainTakeaway: {
      included: true,
      text: incoming.mainTakeaway ?? "",
    },
  };
};


  const typeProblems = flowchartData ? checkDiagramType(diagramType, flowchartData) : [];

  // Describe the diagram from its own structure (deterministic: same diagram, same text, no AI).
  const describeWithoutAI = () => {
    if (!flowchartData) return;
    const result = autoDescribe(diagramType, flowchartData, title);
    const nextSections = normalizeLongDescriptionSections(result.sections);
    const nextSummary = buildLongDescriptionMarkdown(nextSections);

    setAltEdited(false);
    setDescEdited(false);
    setLongDescriptionSections(nextSections);
    setSummary(nextSummary);
    setShortAlt(result.shortAlt);
    localStorage.setItem("latestSummary", nextSummary);
    localStorage.setItem("latestShortAlt", result.shortAlt);
    setSummaryStale(false);
    setIsDirty(true);

    logResearchEvent({
      event_type: "Generation_Succeeded",
      editor_mode: editorMode,
      flowchart_id: activeFlowchartId ?? undefined,
      success: true,
      event_data: {
        source_page: "DiagramEditorPage",
        generation_type: "summary",
        generation_mode: "deterministic",
        diagram_type: diagramType,
        node_count: flowchartData.nodes?.length ?? 0,
        edge_count: flowchartData.edges?.length ?? 0,
      },
    });
  };

  // Markdown mode: the preview follows the text as you type (read in the browser, no network).
  useEffect(() => {
    if (editorMode !== "mermaid") return;
    const needsFirstParse =
      !!mermaidText.trim() && (flowchartData?.nodes?.length ?? 0) === 0 && !routeId;
    if (!markdownTouchedRef.current && !needsFirstParse) return;

    const t = window.setTimeout(() => {
      const r = parseMermaidText(mermaidText);
      setMarkdownIssues({ error: r.error, warnings: r.warnings });
      if (r.error) return; // keep the last good preview
      skipNextMermaidSyncRef.current = true;
      setFlowchartData(r.data);
      setDiagramKey((k) => k + 1);
      setSummaryStale(true);
      if (r.title && !title.trim()) setTitle(r.title);
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mermaidText, editorMode]);

  // Keep alt text and long description in step with the diagram until the author edits them.
  useEffect(() => {
    if (!flowchartData || flowchartData.nodes.length === 0) return;
    if (altEdited && descEdited) return;
    const result = autoDescribe(diagramType, flowchartData, title);
    let changed = false;
    if (!altEdited) {
      if (result.shortAlt !== shortAlt) changed = true;
      setShortAlt(result.shortAlt);
      localStorage.setItem("latestShortAlt", result.shortAlt);
    }
    if (!descEdited) {
      const nextSections = normalizeLongDescriptionSections(result.sections);
      const md = buildLongDescriptionMarkdown(nextSections);
      if (md !== summary) changed = true;
      setLongDescriptionSections(nextSections);
      setSummary(md);
      localStorage.setItem("latestSummary", md);
      setSummaryStale(false);
    }
    // Generated text is part of the saved record, so it is saved (autosave) like any other edit.
    if (changed) setIsDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowchartData, diagramType, title, altEdited, descEdited]);

  /** Change who can see this STEM image. Before the first save it is applied on creation. */
  const saveSharing = async (next: { sharing: Sharing; imagePublic: boolean }) => {
    const id = activeFlowchartId || localStorage.getItem("activeFlowchartId");
    if (!id || id === "undefined") {
      setSharing(next.sharing);
      setImagePublic(next.imagePublic);
      try {
        localStorage.setItem("pendingSharing", next.sharing);
        localStorage.setItem("pendingImagePublic", String(next.imagePublic));
      } catch {
        /* the choice then applies from the defaults */
      }
      return;
    }
    const updated = await apiFetch<{
      sharing: Sharing;
      image_public: boolean;
      is_published: boolean;
      public_slug: string | null;
      published_at: string | null;
    }>(`/flowcharts/${encodeURIComponent(id)}/sharing`, {
      method: "PUT",
      json: { sharing: next.sharing, image_public: next.imagePublic },
    });
    setSharing(updated.sharing);
    setImagePublic(updated.image_public);
    setIsPublished(updated.is_published);
    setPublicSlug(updated.public_slug);
    setPublishedAt(updated.published_at);
    logResearchEvent({
      event_type: updated.sharing === "private" ? "Unpublish_Succeeded" : "Publish_Succeeded",
      editor_mode: editorMode,
      flowchart_id: id,
      success: true,
      event_data: {
        source_page: "DiagramEditorPage",
        sharing: updated.sharing,
        image_public: updated.image_public,
      },
    });
  };

  const ensureDraftExists = async (): Promise<string> => {
    const existingId = activeFlowchartId || localStorage.getItem("activeFlowchartId");
    if (existingId && existingId !== "undefined") return existingId;

    const newId = crypto.randomUUID();
    await apiFetch(`/flowcharts`, {
      method: "POST",
      json: {
        flowchart_id: newId,
        json_data: flowchartData,
        summary: summary ?? "",
        short_alt: shortAlt ?? "",
        title: title ?? "",
        flowchart_type: diagramType,
        image_data_url: imgContent ?? null,
        image_mime: localStorage.getItem("latestDiagramImageMime") ?? null,
        // Chosen on the Create page; without it the record is created private.
        sharing,
        image_public: imagePublic,
      },
    });
    localStorage.removeItem("pendingSharing");
    localStorage.removeItem("pendingImagePublic");
    localStorage.removeItem("pendingType");

    setActiveFlowchartId(newId);
    localStorage.setItem("activeFlowchartId", newId);
    setIsDirty(false);

    return newId;
  };

  const saveToDatabase = async (): Promise<boolean> => {
    if (!flowchartData) return false;

    logResearchEvent({
  event_type: "Save_Clicked",
  editor_mode: editorMode,
  flowchart_id: activeFlowchartId ?? undefined,
  success: true,
  event_data: {
    source_page: "DiagramEditorPage",
    node_count: flowchartData.nodes?.length ?? 0,
    edge_count: flowchartData.edges?.length ?? 0,
    is_dirty: isDirty,
  },
});
    setIsLoading(true);
    setSaveStatus("");
    let didSave = false;

    try {
      let id: string;
      let updated: {
        is_published?: boolean;
        public_slug?: string | null;
        published_at?: string | null;
      };

      if (guest) {
        // Try-it: one public image kept against this browser's token.
        const saved = await guestFetch<{
          flowchart_id: string;
          is_published?: boolean;
          public_slug?: string | null;
          published_at?: string | null;
        }>("/guest/image", {
          method: "PUT",
          json: {
            json_data: flowchartData,
            summary: summary ?? "",
            short_alt: shortAlt ?? "",
            title: title ?? "",
            flowchart_type: diagramType,
          },
        });
        id = saved.flowchart_id;
        updated = saved;
        setActiveFlowchartId(saved.flowchart_id);
        setSharing("public");
      } else {
        id = await ensureDraftExists();
        updated = await apiFetch<{
          is_published?: boolean;
          public_slug?: string | null;
          published_at?: string | null;
        }>(`/flowcharts/${encodeURIComponent(id)}`, {
          method: "PUT",
          json: {
            json_data: flowchartData,
            summary: summary ?? "",
            short_alt: shortAlt ?? "",
            title: title ?? "",
            flowchart_type: diagramType,
            image_data_url: imgContent ?? null,
            image_mime: localStorage.getItem("latestDiagramImageMime") ?? null,
          },
        });
      }

      setIsPublished(!!updated.is_published);
      setPublicSlug(updated.public_slug ?? null);
      setPublishedAt(updated.published_at ?? null);

      localStorage.setItem("latestDiagramJSON", JSON.stringify(flowchartData));
      localStorage.setItem("latestSummary", summary ?? "");
      localStorage.setItem("latestShortAlt", shortAlt ?? "");
      localStorage.setItem("latestMermaidCode", mermaidText);

      setIsDirty(false);
      setOriginalFlowchart(flowchartData);

      setSaveStatus(`Saved ${id}`);
      didSave = true;

      logResearchEvent({
          event_type: "Save_Succeeded",
          editor_mode: editorMode,
          flowchart_id: id,
          success: true,
          event_data: {
            source_page: "DiagramEditorPage",
            node_count: flowchartData.nodes?.length ?? 0,
            edge_count: flowchartData.edges?.length ?? 0,
            was_published: !!updated.is_published,
          },
        });
    } catch (err: any) {
      console.error(err);
            logResearchEvent({
        event_type: "Save_Failed",
        editor_mode: editorMode,
        flowchart_id: activeFlowchartId ?? undefined,
        success: false,
        event_data: {
          source_page: "DiagramEditorPage",
          error_message: err?.message || String(err),
        },
      });
      setSaveStatus(err?.message || "Save failed. Check console for details.");
    } finally {
      setIsLoading(false);
    }
    return didSave;
  };

  // Persist an automatic generation, so alt text isn't lost when the page is reloaded.
  // Autosave: once an image has been saved, edits are written a couple of seconds after you stop.
  // A failed save is not retried until something changes again, so an offline tab does not loop.
  const autosaveBlockedRef = useRef(false);
  useEffect(() => {
    autosaveBlockedRef.current = false;
  }, [flowchartData, shortAlt, summary, title, diagramType, mermaidText]);

  // In Markdown mode, text that does not read cleanly is not saved: the preview still shows the last
  // good diagram, and saving it (or a half-typed version with lines dropped) would be misleading.
  const markdownUnreadable =
    editorMode === "mermaid" &&
    (markdownIssues.error !== null || markdownIssues.warnings.length > 0);

  useEffect(() => {
    if (!isDirty || !activeFlowchartId || !flowchartData || isLoading) return;
    if (autosaveBlockedRef.current || markdownUnreadable) return;
    const t = window.setTimeout(async () => {
      const ok = await saveToDatabase();
      if (!ok) autosaveBlockedRef.current = true;
    }, 2000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, activeFlowchartId, flowchartData, shortAlt, summary, title, diagramType, mermaidText, isLoading, markdownUnreadable]);

  useEffect(() => {
    if (!autoSavePending) return;
    setAutoSavePending(false);
    if (summary.trim() || shortAlt.trim()) void saveToDatabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSavePending]);

  const handleReUpload = () => navigate("/create");

  return (
    <div className="diagram-page">
      <div className="diagram-shell">
        <main className="diagram-main" aria-labelledby="diagram-editor-page-heading">
          <h1 id="diagram-editor-page-heading">STEM image editor</h1>

          

          <section
            aria-labelledby="editor-workspace-heading"
            className="visual-editor-section"
          >
            <EditorToolbar
              guest={guest}
              hasImage={!!imgContent}
              onViewImage={() => setShowImage(true)}
              onReupload={handleReUpload}
              onSave={saveToDatabase}
              isSaving={isLoading}
              disableSave={!flowchartData}
              flowchartId={activeFlowchartId}
              isPublished={isPublished}
              sharing={sharing}
              imagePublic={imagePublic}
              publicPath={isPublished && publicSlug ? `/p/${publicSlug}` : null}
              onSharingSave={saveSharing}
              isDirty={isDirty}
              editorMode={editorMode}
              onEditorModeChange={(nextMode) => {
                logResearchEvent({
                  event_type: "Switch_Editor_Mode",
                  editor_mode: nextMode,
                  flowchart_id: activeFlowchartId ?? undefined,
                  success: true,
                  event_data: {
                    source_page: "DiagramEditorPage",
                    previous_mode: editorMode,
                    next_mode: nextMode,
                  },
                });

                setEditorMode(nextMode);
              }}
            />

            {typeProblems.length > 0 && (
              <div className="summary-warning" role="status">
                <strong>This does not look like a {diagramType === "bt" ? "binary tree" : diagramType === "ll" ? "linked list" : diagramType === "2arr" ? "2D array" : diagramType}:</strong>
                <ul>
                  {typeProblems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <AccessibilityPanel
              title={title}
              shortAlt={shortAlt}
              longDescriptionSections={longDescriptionSections}
              summaryStale={summaryStale}
              expanded={isAccessibilityEditorOpen}
              onToggle={setIsAccessibilityEditorOpen}
            >
              <ImageTypeSelect
                value={diagramType}
                onChange={(next) => {
                  setDiagramType(next);
                  setIsDirty(true);
                }}
              />
              {imgContent && sharing !== "private" && (
                <label className="image-share">
                  <input
                    type="checkbox"
                    checked={imagePublic}
                    onChange={(e) =>
                      void saveSharing({ sharing, imagePublic: e.target.checked }).catch((err) =>
                        setSaveStatus(err?.message || "Could not update sharing.")
                      )
                    }
                  />
                  <span>
                    Show the source image on the shared page
                    <span className="image-type__hint">
                      {" "}
                      — Check if you want to share the source image alongside the accessible version
                      (and have the right to do so).
                    </span>
                  </span>
                </label>
              )}
              <AccessibilityEditorModal
                inline
                isOpen={isAccessibilityEditorOpen}
                onClose={() => setIsAccessibilityEditorOpen(false)}
                title={title}
                onTitleChange={(next: string) => {
                  setTitle(next);
                  localStorage.setItem("latestTitle", next);
                  setIsDirty(true);
                }}
                shortAlt={shortAlt}
                onShortAltChange={(next: string) => {
                  setAltEdited(true);
                  setShortAlt(next);
                  localStorage.setItem("latestShortAlt", next);
                  setIsDirty(true);
                }}
                longDescriptionSections={longDescriptionSections}
                onLongDescriptionSectionChange={(k, t) => {
                  setDescEdited(true);
                  handleLongDescriptionSectionChange(k, t);
                }}
                onLongDescriptionSectionToggle={(k, inc) => {
                  setDescEdited(true);
                  handleLongDescriptionSectionToggle(k, inc);
                }}
                altEdited={altEdited}
                descEdited={descEdited}
                summaryStale={summaryStale}
                onRegenerate={describeWithoutAI}
                imageDataUrl={imgContent}
                flowchartData={flowchartData}
              />
            </AccessibilityPanel>

            {flowchartData && (
              <ShareToolbar
                title={title}
                shortAlt={shortAlt}
                summary={summary}
                json={flowchartData}
                diagramType={diagramType}
                publicUrl={
                  isPublished && publicSlug
                    ? `${window.location.origin}/p/${encodeURIComponent(publicSlug)}`
                    : null
                }
              />
            )}

            <div
  className="react-flow-wrapper"
  aria-describedby={
    !NONVISUAL_EDITING_SUPPORTED
      ? "editor-access-note-heading"
      : "visual-editor-description"
  }
>
  {editorMode === "visual" ? (
    <div
      className="react-flow-canvas-host"
      aria-hidden={NONVISUAL_EDITING_SUPPORTED ? undefined : "true"}
    >
      <ReactFlowProvider>
        {flowchartData ? (
          <UnifiedFlowApp
            key={diagramKey}
            flowchartData={flowchartData}
            onDiagramUpdate={setFlowchartData}
            flowchartId={activeFlowchartId}
            editorMode={editorMode}
          />
        ) : (
          <p className="page-loading">Initializing editor…</p>
        )}
      </ReactFlowProvider>
    </div>
  ) : (
    <div className="markdown-split">
      <div className="mermaid-editor-panel markdown-split__text">
        <label htmlFor="mermaid-editor-textarea" className="markdown-split__label">
          Markdown (Mermaid)
        </label>

        <textarea
          ref={mermaidTextareaRef}
          id="mermaid-editor-textarea"
          value={mermaidText}
          onChange={(e) => {
            markdownTouchedRef.current = true;
            setMermaidText(e.target.value);
            setIsDirty(true);
          }}
          rows={20}
          spellCheck={false}
          className="mermaid-editor-panel__textarea"
          aria-describedby="markdown-help markdown-layout-note"
          placeholder={`flowchart TD
      A[Start] --> B[Next step]`}
        />

        <p id="markdown-help" className="markdown-split__help">
          Write the STEM image as Mermaid text; the preview updates as you type.{" "}
          <a
            href="https://mermaid.js.org/syntax/flowchart.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Mermaid syntax<span className="sr-only"> (opens in a new tab)</span>
          </a>
          . Arrays use <code>block-beta</code>.
        </p>
        <p id="markdown-layout-note" className="markdown-split__help">
          Typing here lays the diagram out again, so positions you set by dragging in the Visual
          editor are replaced. Switching tabs without typing keeps them.
        </p>

        <div className="mermaid-editor-panel__actions">
          <button
            type="button"
            className="canvas-toolbar__btn"
            onClick={() => {
              markdownTouchedRef.current = true;
              setMermaidText(MARKDOWN_EXAMPLES[diagramType] ?? MARKDOWN_EXAMPLES.flowchart);
              setIsDirty(true);
            }}
          >
            Insert example
          </button>
        </div>

        {markdownIssues.error && (
          <p className="markdown-split__error" role="alert">
            {markdownIssues.error}
          </p>
        )}
        {markdownUnreadable && isDirty && !!activeFlowchartId && (
          <p className="markdown-split__help" role="status">
            Not saved yet: some of this text can’t be read, so changes are held until it can.
          </p>
        )}
        {markdownIssues.warnings.length > 0 && (
          <ul className="markdown-split__warnings" aria-label="Lines that could not be read">
            {markdownIssues.warnings.slice(0, 5).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="markdown-split__preview">
        <p className="markdown-split__count" role="status" aria-live="polite">
          {flowchartData
            ? `${flowchartData.nodes.length} ${flowchartData.nodes.length === 1 ? "node" : "nodes"}, ${flowchartData.edges.length} ${flowchartData.edges.length === 1 ? "edge" : "edges"}`
            : ""}
        </p>
        {flowchartData && flowchartData.nodes.length > 0 ? (
          <FlowchartViewer flowchartData={flowchartData} height={420} showMiniMap={false} />
        ) : (
          <p className="markdown-split__empty">Nothing to show yet.</p>
        )}
      </div>
    </div>
  )}
</div>
          </section>
        </main>

       

        {showImage && imgContent && (
          <div
            className="image-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="uploaded-image-title"
            onClick={() => setShowImage(false)}
          >
            <div className="image-overlay__card" onClick={(e) => e.stopPropagation()}>
              <div className="image-overlay__header">
                <h3 id="uploaded-image-title" className="image-overlay__title">
                  Uploaded image
                </h3>
                <button
                  type="button"
                  className="canvas-toolbar__btn"
                  onClick={() => setShowImage(false)}
                >
                  Close
                </button>
              </div>
              <div className="image-overlay__body">
                <img src={imgContent} alt="Uploaded STEM image" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagramEditorPage;