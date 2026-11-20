// src/components/charts/SonificationPlayer.tsx
import { useId, useMemo, useState } from "react";
import type { ParsedDataset, SonificationConfig } from "../../types/types";
import { playSonificationWithErie } from "../../sonification/erieClient";
import { describeSonification } from "../../sonification/describe";

interface Props {
  dataset: ParsedDataset | null;
  config: SonificationConfig;
  disabled?: boolean;
}

export function SonificationPlayer({ dataset, config, disabled }: Props) {
  const [playing, setPlaying] = useState(false);
  // "Playing…" goes to a polite status and problems to an alert. The button label stays the
  // same, so screen readers announce the state once.
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const headingId = useId();
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
    try {
      await playSonificationWithErie(dataset, config);
      setStatus("");
    } catch (e) {
      console.error("[SonificationPlayer] Error:", e);
      setStatus("");
      setError("Something went wrong while playing audio.");
    } finally {
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
      >
        Play sonification
      </button>
      <p className="hint">Audio is generated in your browser using Erie. Press X to stop.</p>
      <div className="hint" role="status">
        {status}
      </div>
      <div className="sonification__error" role="alert">
        {error}
      </div>
    </section>
  );
}
