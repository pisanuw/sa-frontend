import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, apiUpload } from "../lib/api";
import { validateDeckFile, type DeckSummary } from "../services/slideDecks";
import "./styles/SlideDeck.css";

export default function SlideDeckUploadPage() {
  const navigate = useNavigate();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<DeckSummary[]>([]);
  const [listError, setListError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<DeckSummary[]>("/decks", { signal: controller.signal })
      .then(setRecent)
      .catch(() => {
        if (!controller.signal.aborted)
          setListError("Previous uploads could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateDeckFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file!);
      const result = await apiUpload<{ id: string }>("/decks", body);
      navigate(`/decks/${result.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The upload failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="deck-page">
      <Link to="/create">Back</Link>
      <h1>Upload a slide deck</h1>
      <p>
        Upload a PDF export. We find complete diagrams and create a description
        page and link for each one.
      </p>
      <form className="deck-panel" onSubmit={upload} aria-busy={busy}>
        <label htmlFor={inputId}>PDF slide deck</label>
        <input
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          aria-describedby={`${inputId}-help`}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError("");
          }}
        />
        <p id={`${inputId}-help`}>
          Up to 20 slides and 20 MB. Export PowerPoint or Google Slides as PDF
          first.
        </p>
        <p className="deck-note">
          Demo: slides are sent to Gemini, and cropped diagrams use the existing
          OCR/AI reader.
        </p>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Uploading…" : "Extract diagrams"}
        </button>
        <p role="status">
          {busy ? "Uploading your PDF. Please keep this page open." : ""}
        </p>
        {error && (
          <p role="alert" className="deck-error">
            {error}
          </p>
        )}
      </form>
      <h2>Previous uploads</h2>
      {listError && <p role="status">{listError}</p>}
      {recent.length ? (
        <ul>
          {recent.map((deck) => (
            <li key={deck.id}>
              <Link to={`/decks/${deck.id}`}>{deck.filename}</Link> (
              {deck.page_count} slides)
            </li>
          ))}
        </ul>
      ) : (
        !listError && <p>No previous uploads.</p>
      )}
    </div>
  );
}
