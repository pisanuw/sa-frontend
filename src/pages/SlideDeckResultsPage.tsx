import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  deckLinksText,
  describeDeckDiagram,
  type DeckDiagram,
  type DeckResult,
} from "../services/slideDecks";
import "./styles/SlideDeck.css";

function DiagramCard({ deckId, item }: { deckId: string; item: DeckDiagram }) {
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ image_data_url: string }>(
      `/decks/${deckId}/diagrams/${item.id}/image`,
      { signal: controller.signal },
    )
      .then((result) => setImage(result.image_data_url))
      .catch(() => {
        if (!controller.signal.aborted) setImageError(true);
      });
    return () => controller.abort();
  }, [deckId, item.id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${item.public_path}`,
      );
      setCopyMessage("Link copied.");
    } catch {
      setCopyMessage(
        "Could not copy. Use the description link below to copy its address.",
      );
    }
  }

  const status = {
    queued: "Waiting for the image reader",
    processing: "Reading diagram",
    awaiting_description: "Saving descriptions",
    ready: "Ready",
    failed: "Could not read this diagram",
  }[item.status];
  return (
    <article className="deck-card">
      {image ? (
        <img src={image} alt={`Extracted image: ${item.title}`} />
      ) : (
        <p>{imageError ? "Preview unavailable." : "Loading preview…"}</p>
      )}
      <h3>{item.title}</h3>
      <p>
        Diagram {item.position} · {status}
      </p>
      {item.error && <p className="deck-error">{item.error}</p>}
      {item.public_path && (
        <div className="deck-actions">
          <Link to={item.public_path} target="_blank" rel="noopener noreferrer">
            Open description (new tab)
          </Link>
          <button
            className="btn btn--outline"
            onClick={copyLink}
            aria-label={`Copy link for ${item.title}`}
          >
            Copy link
          </button>
          {item.flowchart_id && (
            <Link to={`/editor/${item.flowchart_id}`}>Review and edit</Link>
          )}
        </div>
      )}
      {item.status === "ready" && !item.public_path && (
        <p>The diagram is private or was removed.</p>
      )}
      <p role="status">{copyMessage}</p>
    </article>
  );
}

export default function SlideDeckResultsPage() {
  const { deckId = "" } = useParams();
  const [deck, setDeck] = useState<DeckResult | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await apiFetch<DeckResult>(`/decks/${deckId}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setDeck(result);
        setError("");
        // The legacy editor owns autoDescribe. Run that same function here so published
        // pages are complete without requiring the uploader to open every editor first.
        const pending = result.items.filter(
          (item) => item.status === "awaiting_description" && item.graph,
        );
        for (const item of pending) {
          if (controller.signal.aborted) return;
          await apiFetch(`/decks/${deckId}/diagrams/${item.id}/finalize`, {
            method: "POST",
            signal: controller.signal,
            json: describeDeckDiagram(item.graph!, item.title),
          });
        }
        if (
          pending.length ||
          result.job_status === "queued" ||
          result.job_status === "running"
        ) {
          timer = setTimeout(poll, pending.length ? 200 : 2000);
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Could not load results.",
          );
      }
    }
    setDeck(null);
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [deckId, refresh]);

  async function retry() {
    setRetrying(true);
    try {
      await apiFetch(`/decks/${deckId}/retry`, { method: "POST" });
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Retry failed.");
    } finally {
      setRetrying(false);
    }
  }

  async function copyAll() {
    if (!deck) return;
    try {
      await navigator.clipboard.writeText(
        deckLinksText(deck, window.location.origin),
      );
      setMessage("All ready links copied.");
    } catch {
      setMessage(
        "Could not copy. You can copy each description link's address instead.",
      );
    }
  }

  const active =
    deck?.job_status === "queued" || deck?.job_status === "running";
  const ready = deck?.items.filter((item) => item.public_path).length ?? 0;
  const failed =
    deck?.error ||
    deck?.pages.some((page) => page.status === "failed") ||
    deck?.items.some((item) => item.status === "failed");
  const detected =
    deck?.pages.filter((page) => page.status === "done").length ?? 0;

  return (
    <div className="deck-page">
      <Link to="/decks/new">Back</Link>
      <h1>{deck?.filename ?? "Slide deck results"}</h1>
      {error && (
        <div role="alert">
          <p className="deck-error">{error}</p>
          <button
            className="btn btn--outline"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Reload results
          </button>
        </div>
      )}
      {!deck && !error && <p role="status">Loading results…</p>}
      {deck && (
        <>
          <p role="status">
            {detected} of {deck.page_count} slides scanned. {ready} of{" "}
            {deck.items.length} diagram links ready.
            {active
              ? " Processing continues in the background."
              : deck.items.some(
                    (item) => item.status === "awaiting_description",
                  )
                ? " Saving descriptions…"
                : failed
                  ? " Processing finished with some errors."
                  : " Processing finished."}
          </p>
          <p>
            AI crops and descriptions can contain errors. Review each diagram
            before sharing.
          </p>
          <div className="deck-actions">
            <button className="btn" onClick={copyAll} disabled={!ready}>
              Copy all ready links
            </button>
            {failed && !active && (
              <button
                className="btn btn--outline"
                onClick={retry}
                disabled={retrying}
              >
                {retrying ? "Queuing…" : "Retry failed items"}
              </button>
            )}
          </div>
          <p role="status">{message}</p>
          {deck.error && <p className="deck-error">{deck.error}</p>}
          {deck.pages.map((page, index) => (
            <section
              className="deck-slide"
              key={index}
              aria-labelledby={`slide-${index}`}
            >
              <h2 id={`slide-${index}`}>Slide {index + 1}</h2>
              {page.status === "pending" && (
                <p>Waiting for diagram detection.</p>
              )}
              {page.status === "failed" && (
                <p className="deck-error">{page.error}</p>
              )}
              {page.status === "done" && page.count === 0 && (
                <p>No diagrams detected.</p>
              )}
              <div className="deck-grid">
                {deck.items
                  .filter((item) => item.page_number === index + 1)
                  .map((item) => (
                    <DiagramCard key={item.id} deckId={deckId} item={item} />
                  ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
