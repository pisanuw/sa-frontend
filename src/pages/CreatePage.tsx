import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch, apiUpload, publicFetch } from "../lib/api";
import type { FlowchartData } from "../types/types";
import UploadJobStatus from "../components/upload/UploadJobStatus";
import { logResearchEvent } from "../lib/logResearchEvent";
import {
  DIAGRAM_TYPES,
  normalizeDiagramType,
  supportsImageUpload,
} from "../arboretum/diagramTypes";
import type { DiagramType } from "../arboretum/diagramTypes";
import {
  DEFAULT_SHARING,
  IMAGE_SHARING_HELP,
  SHARING_OPTIONS,
  type Sharing,
} from "../lib/sharing";
import { clearLatestDiagramCache } from "../lib/editorCache";
import { MARKDOWN_EXAMPLES } from "../lib/mermaidText";
import { CHART_FILE_ACCEPT, chartFileKind } from "../components/charts/chartFileKind";
import { extractionPolicy, type ExtractionOptions } from "../components/charts/chartExtractionPolicy";
import "./styles/CreatePage.css";

type JobResult = {
  mermaid_json?: FlowchartData;
  mermaid_code?: string;
  image_data_url?: string;
  image_mime?: string;
} | null;

async function pollJobUntilComplete(jobId: number): Promise<JobResult> {
  for (;;) {
    const job = await apiFetch<{
      status: "queued" | "running" | "done" | "failed";
      result: JobResult;
      error: string | null;
    }>(`/jobs/${jobId}`);
    if (job.status === "done") return job.result;
    if (job.status === "failed") throw new Error(job.error || "Upload processing failed.");
    await new Promise((r) => setTimeout(r, 2000));
  }
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read uploaded image."));
    reader.readAsDataURL(file);
  });
}

export default function CreatePage() {
  const navigate = useNavigate();
  const id = useId();

  const [name, setName] = useState("");
  const [type, setType] = useState<DiagramType>("flowchart");
  // "Chart" sits beside the image types in the menu but is not a DiagramType: a chart is data
  // explored on the Charts page, not nodes and arrows, and it is not saved to the account yet.
  const [isChart, setIsChart] = useState(false);
  // A chart starts from a CSV or from a picture of a chart. The file is only chosen here; the chart
  // tool reads it (and asks how a picture may be read) so that choice is made in one place.
  const [showChartUpload, setShowChartUpload] = useState(false);
  const [chartFile, setChartFile] = useState<File | null>(null);
  const [chartFileError, setChartFileError] = useState("");
  // What this deployment can read a picture with; asked once, when the Upload panel first opens.
  // "unavailable" (the request failed) falls back to a plain Continue, and the chart tool explains.
  const { user } = useAuth();
  const [readers, setReaders] = useState<ExtractionOptions | "unavailable" | null>(null);
  useEffect(() => {
    if (!showChartUpload || readers !== null) return;
    let cancelled = false;
    publicFetch<ExtractionOptions>("/chart-extraction/options", { timeoutMs: 20000 })
      .then((o) => !cancelled && setReaders(o))
      .catch(() => !cancelled && setReaders("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [showChartUpload, readers]);
  const [sharing, setSharing] = useState<Sharing>(DEFAULT_SHARING);

  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [imagePublic, setImagePublic] = useState(false);
  // Keep the original next to the STEM image so it can be compared while editing. On by default
  // for the person's own work; unchecking it means the image is not stored at all.
  const [keepImage, setKeepImage] = useState(true);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);

  const hasName = name.trim().length > 0;
  const canUpload = supportsImageUpload(type);
  const whyId = `${id}-why`;

  function openMarkdown() {
    clearLatestDiagramCache();
    try {
      localStorage.setItem("latestTitle", name.trim());
      localStorage.setItem("latestShortAlt", "");
      localStorage.setItem("latestSummary", "");
      localStorage.setItem("editorMode", "mermaid");
      localStorage.setItem("pendingType", type);
      localStorage.setItem("pendingSharing", sharing);
      localStorage.setItem("pendingMarkdown", MARKDOWN_EXAMPLES[type] ?? MARKDOWN_EXAMPLES.flowchart);
    } catch {
      /* the editor still opens; it then starts from its defaults */
    }
    logResearchEvent({
      event_type: "Create_Mermaid",
      editor_mode: "mermaid",
      success: true,
      event_data: { source_page: "CreatePage", diagram_type: type, sharing },
    });
    navigate("/editor");
  }

  function openVisualEditor() {
    clearLatestDiagramCache();
    try {
      localStorage.setItem("latestTitle", name.trim());
      localStorage.setItem("latestShortAlt", "");
      localStorage.setItem("latestSummary", "");
      localStorage.setItem("editorMode", "create");
      localStorage.setItem("pendingType", type);
      localStorage.setItem("pendingSharing", sharing);
    } catch {
      /* the editor still opens; type and sharing then fall back to defaults */
    }
    logResearchEvent({
      event_type: "Create_Scratch",
      editor_mode: "scratch",
      success: true,
      event_data: { source_page: "CreatePage" },
    });
    navigate("/editor");
  }

  function openChart(file: File | null = null, choice?: "local" | "ai") {
    logResearchEvent({
      event_type: "Create_Chart",
      editor_mode: "chart",
      success: true,
      event_data: { source_page: "CreatePage", has_name: hasName },
    });
    // The name becomes the chart's starting title and the chosen file is read there; the Charts
    // page takes them from router state. `choice` is how the person said a picture may be read:
    // it is set only by pressing one of the two buttons below, never assumed.
    const state = {
      ...(hasName ? { title: name.trim() } : {}),
      ...(file ? { file } : {}),
      ...(file && choice ? { choice } : {}),
    };
    navigate("/charts", { state: Object.keys(state).length ? state : undefined });
  }

  function chooseChartFile(file: File | null) {
    setChartFile(null);
    setChartFileError("");
    if (!file) return;
    if (!chartFileKind(file)) {
      setChartFileError(
        `${file.name} is not a CSV file or a PNG, JPEG or WebP picture. Choose one of those.`
      );
      return;
    }
    setChartFile(file);
  }

  async function processImage() {
    if (!file || !hasName) return;
    setBusy(true);
    setStatusIsError(false);
    setStatus("Uploading image…");
    setJobId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const job = await apiUpload<{ job_id: number }>("/jobs/process-upload", formData);
      setJobId(job.job_id);
      logResearchEvent({
        event_type: "Upload_Image",
        editor_mode: "image",
        success: true,
        event_data: {
          source_page: "CreatePage",
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
          upload_job_id: job.job_id,
        },
      });
      setStatus("Processing STEM image…");

      const result = await pollJobUntilComplete(job.job_id);
      if (!result?.mermaid_json) throw new Error("Failed to process STEM image.");

      setStatus("Saving…");
      // When the person chose not to keep the original, it is not sent to be saved at all.
      const imageDataUrl = keepImage ? result.image_data_url || (await readAsDataUrl(file)) : null;
      const created = await apiFetch<{ flowchart_id: string }>("/flowcharts", {
        method: "POST",
        json: {
          json_data: result.mermaid_json,
          ...(imageDataUrl
            ? { image_data_url: imageDataUrl, image_mime: result.image_mime || file.type || "image/png" }
            : {}),
          title: name.trim(),
          flowchart_type: type,
          sharing,
          image_public: keepImage && imagePublic,
        },
      });
      logResearchEvent({
        event_type: "Create_Image",
        editor_mode: "image",
        flowchart_id: created.flowchart_id,
        success: true,
        event_data: {
          source_page: "CreatePage",
          file_name: file.name,
          node_count: result.mermaid_json.nodes.length,
          edge_count: result.mermaid_json.edges.length,
          upload_job_id: job.job_id,
          sharing,
          diagram_type: type,
        },
      });

      clearLatestDiagramCache();
      navigate(`/editor/${encodeURIComponent(created.flowchart_id)}`);
    } catch (e) {
      console.error(e);
      logResearchEvent({
        event_type: "Image_Processing_Failed",
        editor_mode: "image",
        success: false,
        event_data: {
          source_page: "CreatePage",
          file_name: file.name,
          error_message: e instanceof Error ? e.message : String(e),
        },
      });
      setStatus("We couldn’t process that STEM image. Please try again.");
      setStatusIsError(true);
    } finally {
      setBusy(false);
    }
  }

  const sharesImage = sharing !== "private";

  // How a chosen chart picture can be read. The same rules as the chart tool: the AI model is on
  // offer only to someone signed in, and only when the server has one configured.
  const pictureChosen = !!chartFile && chartFileKind(chartFile) === "image";
  const readerPolicy = extractionPolicy({
    signedIn: !!user,
    options: readers && readers !== "unavailable" ? readers : null,
    choice: "",
    hasFile: !!chartFile,
    busy: false,
  });
  const offerAiChoice = pictureChosen && readerPolicy.offerAi;
  // Signed in with a picture: wait for the answer so the buttons do not change under the person.
  const checkingReaders = pictureChosen && !!user && readers === null;

  return (
    <div className="create-page">
      <div className="create-shell">
        <h1 className="create-title">Create a STEM image</h1>
        <p>
          <Link to="/decks/new">Upload a slide deck (PDF)</Link> to extract multiple
          diagrams at once.
        </p>
        <p className="create-subtitle">
          {isChart
            ? "Name it, then explore data from a CSV file or a chart picture as a table, a navigable outline, and sound."
            : "Name it, choose its type and who can see it, then upload an image or write it as text."}
        </p>

        <form
          className="create-form"
          onSubmit={(e) => e.preventDefault()}
          aria-busy={busy}
        >
          <div className="create-field">
            <label className="create-label" htmlFor={`${id}-name`}>
              Name
            </label>
            <input
              id={`${id}-name`}
              className="create-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              required={!isChart}
              aria-describedby={hasName ? undefined : whyId}
            />
          </div>

          <div className="create-field">
            <label className="create-label" htmlFor={`${id}-type`}>
              Image type
            </label>
            <select
              id={`${id}-type`}
              className="create-select"
              value={isChart ? "chart" : type}
              onChange={(e) => {
                if (e.target.value === "chart") {
                  setIsChart(true);
                  setShowUpload(false);
                  return;
                }
                setIsChart(false);
                setShowChartUpload(false);
                chooseChartFile(null);
                const next = normalizeDiagramType(e.target.value);
                setType(next);
                if (!supportsImageUpload(next)) setShowUpload(false);
              }}
              aria-describedby={`${id}-type-hint`}
            >
              {DIAGRAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
              <option value="chart">Chart</option>
            </select>
            <p id={`${id}-type-hint`} className="create-hint">
              {isChart
                ? "Data in rows and columns, such as a time series or categories with values. Upload a CSV file, or a picture of a chart (PNG, JPEG or WebP) to read it into a table. When you are signed in you can save a shareable link from the chart tool."
                : DIAGRAM_TYPES.find((t) => t.value === type)?.hint}
            </p>
          </div>

          {!isChart && (
          <fieldset className="create-fieldset">
            <legend>Who can see it</legend>
            {SHARING_OPTIONS.map((o) => (
              <label key={o.value} className="create-radio">
                <input
                  type="radio"
                  name={`${id}-sharing`}
                  value={o.value}
                  checked={sharing === o.value}
                  onChange={() => setSharing(o.value)}
                />
                <span className="create-radio__label">{o.label}</span>
                <span className="create-radio__help">{o.help}</span>
              </label>
            ))}
          </fieldset>
          )}

          {isChart && (
            <div className="create-actions" role="group" aria-label="How to start">
              <button
                type="button"
                className="btn"
                disabled={!hasName}
                aria-describedby={hasName ? undefined : whyId}
                aria-expanded={showChartUpload}
                onClick={() => setShowChartUpload((v) => !v)}
              >
                Upload
              </button>
              <button type="button" className="btn btn--outline" onClick={() => openChart()}>
                Open chart tool
              </button>
            </div>
          )}

          {!isChart && (
          <div className="create-actions" role="group" aria-label="How to start">
            <button
              type="button"
              className="btn"
              disabled={!hasName || !canUpload || busy}
              aria-describedby={!hasName ? whyId : !canUpload ? `${id}-noupload` : undefined}
              aria-expanded={showUpload}
              onClick={() => setShowUpload((v) => !v)}
            >
              Upload image
            </button>
            <button
              type="button"
              className="btn"
              disabled={!hasName || busy}
              aria-describedby={hasName ? undefined : whyId}
              onClick={openMarkdown}
            >
              Markdown editor
            </button>
            {type === "flowchart" && (
              <button
                type="button"
                className="btn btn--outline"
                disabled={!hasName || busy}
                aria-describedby={hasName ? undefined : whyId}
                onClick={openVisualEditor}
              >
                Visual editor
              </button>
            )}
          </div>
          )}
          {!hasName && (
            <p id={whyId} className="create-why">
              {isChart
                ? "Enter a name to enable Upload. You can open the chart tool without one."
                : "Enter a name to enable these buttons."}
            </p>
          )}
          {!isChart && !canUpload && (
            <p id={`${id}-noupload`} className="create-why">
              Uploading an image is available for flowcharts, trees, binary trees, and linked lists.
              {` ${DIAGRAM_TYPES.find((t) => t.value === type)?.label ?? "This type"}`} images are
              written as text: use the Markdown editor.
            </p>
          )}

          {isChart && showChartUpload && hasName && (
            <section className="create-panel" aria-label="Upload a CSV or a chart picture">
              <div className="create-field">
                <label className="create-label" htmlFor={`${id}-chart-file`}>
                  CSV file or picture of a chart
                </label>
                <input
                  id={`${id}-chart-file`}
                  type="file"
                  accept={CHART_FILE_ACCEPT}
                  aria-describedby={`${id}-chart-file-help`}
                  onChange={(e) => chooseChartFile(e.target.files?.[0] ?? null)}
                />
                {chartFile && (
                  <p className="create-hint" aria-live="polite">
                    Selected: <strong>{chartFile.name}</strong>
                  </p>
                )}
              </div>

              <p className="create-hint" id={`${id}-chart-file-help`}>
                <strong>What happens next.</strong> A CSV file (data in rows and columns, with column
                names in the first row) opens in the chart tool as a table. A picture of a chart (PNG,
                JPEG or WebP) opens there too and is read into a table. The built-in reader keeps the
                picture on our servers. If you are signed in you may be asked whether an AI model
                (Google&rsquo;s Gemini, through OpenRouter) may read it instead, which sends the picture
                to those services. That only happens if you choose it, with a button below, after you
                pick a picture.
              </p>

              {chartFileError && (
                <p role="alert" className="create-why">
                  {chartFileError}
                </p>
              )}

              {/* A picture is read with "Extract" (the built-in reader, which keeps it on our servers) or,
                  for a signed-in person when the server has an AI model, "Extract with AI support".
                  Pressing the second is the only way the AI model is asked for. A CSV has nothing to
                  extract, so it is Continue. */}
              {pictureChosen && !checkingReaders && (
                <p className="create-hint" id={`${id}-reader-notice`}>
                  {offerAiChoice ? (
                    <>
                      <strong>How should this picture be read?</strong>{" "}
                      {readerPolicy.useLocal
                        ? "“Extract” uses the built-in reader, which keeps the picture on our servers. “Extract with AI support” tries the built-in reader first and sends the picture to Google’s Gemini, through OpenRouter, only when the built-in reader is not sure. "
                        : "“Extract with AI support” sends the picture to Google’s Gemini, through OpenRouter. "}
                      Those services may log or keep it, so it may not be private. Do not use it for a picture
                      with personal or confidential information. You can enter the data as a CSV file instead.
                    </>
                  ) : (
                    "The built-in reader keeps the picture on our servers. It is not sent to a third party."
                  )}
                </p>
              )}
              {checkingReaders && <p role="status">Checking how this picture can be read…</p>}

              <div className="create-actions">
                {pictureChosen ? (
                  <>
                    {(readerPolicy.useLocal || !offerAiChoice) && (
                      <button
                        type="button"
                        className={offerAiChoice ? "btn btn--outline" : "btn"}
                        disabled={checkingReaders}
                        aria-describedby={checkingReaders ? undefined : `${id}-reader-notice`}
                        // Built-in only. When the AI model is on offer this is the person's explicit
                        // answer to "no"; otherwise there is nothing to decide and no choice is sent.
                        onClick={() => openChart(chartFile, offerAiChoice ? "local" : undefined)}
                      >
                        Extract
                      </button>
                    )}
                    {offerAiChoice && (
                      <button
                        type="button"
                        className="btn"
                        aria-describedby={`${id}-reader-notice`}
                        onClick={() => openChart(chartFile, "ai")}
                      >
                        Extract with AI support
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    disabled={!chartFile}
                    onClick={() => openChart(chartFile)}
                  >
                    Continue to the chart tool
                  </button>
                )}
              </div>
              {!chartFile && !chartFileError && (
                <p className="create-why">Choose a CSV file or a picture to continue.</p>
              )}
            </section>
          )}

          {!isChart && showUpload && canUpload && (
            <section className="create-panel" aria-label="Upload an image">
              <div className="create-field">
                <label className="create-label" htmlFor={`${id}-file`}>
                  Image file
                </label>
                <input
                  id={`${id}-file`}
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <p className="create-hint" aria-live="polite">
                    Selected: <strong>{file.name}</strong>
                  </p>
                )}
              </div>

              <label className="create-check">
                <input
                  type="checkbox"
                  checked={keepImage}
                  onChange={(e) => setKeepImage(e.target.checked)}
                  disabled={busy}
                  aria-describedby={`${id}-keep-help`}
                />
                <span>
                  <strong>Keep the original image with this STEM image.</strong>
                  <span id={`${id}-keep-help`} className="create-hint">
                    {" "}
                    So you can compare it while editing. Only you can see it unless you choose to show it
                    on the shared page, and it is deleted when you delete the STEM image. If you leave
                    this unchecked the image is not saved after it has been read.
                  </span>
                </span>
              </label>

              {sharesImage && keepImage && (
                <label className="create-check">
                  <input
                    type="checkbox"
                    checked={imagePublic}
                    onChange={(e) => setImagePublic(e.target.checked)}
                    disabled={busy}
                  />
                  <span>
                    <strong>Show the source image on the shared page.</strong>
                    <span className="create-hint"> {IMAGE_SHARING_HELP}</span>
                  </span>
                </label>
              )}

              <p className="create-hint" id={`${id}-dataflow`}>
                <strong>Where your image goes.</strong> To turn it into a diagram we send it to Google
                Cloud Vision, to read the text, and to an AI model (Google&rsquo;s Gemini, through
                OpenRouter), to work out the arrows. Those services may log or keep it, so it may not
                be private. Do not upload an image with personal or confidential information. To avoid
                this, write the diagram as text with the Markdown editor.
              </p>

              <div className="create-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={!file || busy}
                  aria-describedby={`${id}-dataflow`}
                  onClick={processImage}
                >
                  {busy ? "Processing…" : "Create from image"}
                </button>
              </div>
              {!file && !busy && <p className="create-why">Choose an image file to continue.</p>}

              <UploadJobStatus busy={busy} status={status} jobId={jobId} error={statusIsError} />
            </section>
          )}
        </form>
      </div>
    </div>
  );
}
