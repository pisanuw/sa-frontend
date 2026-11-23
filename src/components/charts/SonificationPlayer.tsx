// src/components/charts/SonificationPlayer.tsx
import { useId, useMemo, useState } from "react";
import type { ParsedDataset, SonificationConfig } from "../../types/types";
import { playSonificationWithErie, stopSonification } from "../../sonification/erieClient";
import { describeSonification } from "../../sonification/describe";

interface Props {
  dataset: ParsedDataset | null;
  config: SonificationConfig;
  disabled?: boolean;
  /** How long to wait for playback to finish before giving up (tests make it short). */
  playbackLimitMs?: number;
}

/**
 * The tones last 5 seconds, and Erie also speaks the title and the description. Erie waits for
 * each spoken part to end and never hears that it failed, so when the browser's speech fails (no
 * voices) or is cancelled, its promise never settles. Past this limit the player stops waiting.
 */
export const PLAYBACK_LIMIT_MS = 30_000;

export function SonificationPlayer({ dataset, config, disabled, playbackLimitMs = PLAYBACK_LIMIT_MS }: Props) {
  const [playing, setPlaying] = useState(false);
  // "Playing…" goes to a polite status and problems to an alert. The button label stays the
  // same, so screen readers announce the state once.
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const headingId = useId();
  const hintId = useId();
  // The same information in words, for readers who cannot hear the sound.
  const description = useMemo(() => describeSonification(dataset, config), [dataset, config]);

  const handlePlay = async () => {
    if (playing) return;
    if (!dataset || !config.valueColumn) {
      setError("Upload a CSV and choose a value column first.");
      return;
    }
    setError("");
    setPlaying(true);
    setStatus("Playing…");
    // Erie stops the sound itself when X is pressed (a keypress listener of its own), but its
    // promise may never settle then, so the player listens for the same key to stop waiting.
    let removeKey = () => {};
    const stopped = new Promise<"stopped">((resolve) => {
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "x") resolve("stopped");
      };
      window.addEventListener("keypress", onKey);
      removeKey = () => window.removeEventListener("keypress", onKey);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), playbackLimitMs);
    });
    const play = playSonificationWithErie(dataset, config).then(() => "done" as const);
    play.catch(() => {}); // a failure after the player stopped waiting is not shown
    try {
      const outcome = await Promise.race([play, stopped, timedOut]);
      if (outcome === "timeout") {
        stopSonification();
        setStatus("");
        setError("The sound did not finish playing. Your browser may not be able to play it. Try again, or read the description above.");
      } else {
        setStatus(outcome === "stopped" ? "Stopped." : "");
      }
    } catch (e) {
      console.error("[SonificationPlayer] Error:", e);
      setStatus("");
      setError("Something went wrong while playing audio.");
    } finally {
      clearTimeout(timer);
      removeKey();
      setPlaying(false);
    }
  };

  return (
    <section className="card" aria-labelledby={headingId}>
      <h2 id={headingId}>Sonification</h2>
      {description && (
        <>
          <h3>What you will hear</h3>
          <p>{description}</p>
        </>
      )}
      {/* aria-disabled while playing (not disabled) keeps keyboard focus on the button. */}
      <button
        type="button"
        onClick={handlePlay}
        disabled={disabled}
        aria-disabled={playing || undefined}
        aria-describedby={hintId}
      >
        Play sonification
      </button>
      {/* Read with the button (aria-describedby), so Tab users hear how to stop it. */}
      <p className="hint" id={hintId}>
        Audio is generated in your browser using Erie. Press X to stop.
      </p>
      <div className="hint" role="status">
        {status}
      </div>
      <div className="sonification__error" role="alert">
        {error}
      </div>
    </section>
  );
}
