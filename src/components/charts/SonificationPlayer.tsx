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
  const [status, setStatus] = useState<"idle" | "playing" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const headingId = useId();
  // The same information in words, for readers who cannot hear the sound.
  const description = useMemo(() => describeSonification(dataset, config), [dataset, config]);

  const handlePlay = async () => {
    if (!dataset || !config.valueColumn) {
      setMessage("Upload a CSV and choose a value column first.");
      return;
    }
    try {
      setStatus("playing");
      setMessage("Playing.");
      await playSonificationWithErie(dataset, config);
      setStatus("idle");
      setMessage(null);
    } catch (e) {
      console.error("[SonificationPlayer] Error:", e);
      setStatus("error");
      setMessage("Something went wrong while playing audio.");
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
      <button type="button" onClick={handlePlay} disabled={disabled || status === "playing"}>
        {status === "playing" ? "Playing…" : "Play sonification"}
      </button>
      <p className="hint" role="status" aria-live="polite">
        {message ?? "Audio is generated in your browser using Erie."}
      </p>
    </section>
  );
}
