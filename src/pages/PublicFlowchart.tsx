import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import RepresentationBrowser from "../components/access-reps/RepresentationBrowser";


interface PublicFlowchartResponse {
  public_slug: string;
  flowchart_id?: string;
  json_data: any;
  summary: string;
  has_image: boolean;
  image_mime?: string | null;
  published_at?: string | null;
  short_alt?: string;
  title?: string | null;
  flowchart_type?: string | null;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}


const PublicFlowchart: React.FC = () => {
  const { public_slug } = useParams<{ public_slug: string }>();


  const [data, setData] = useState<PublicFlowchartResponse | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!public_slug) return;

    const run = async () => {
      try {
        setError(null);
        setImageDataUrl(null);

        // Fetch public flowchart
        const res = await fetch(`${API_URL}/p/${encodeURIComponent(public_slug)}`);
        if (!res.ok) {
          throw new Error(`STEM image not found`);
        }

        const fc: PublicFlowchartResponse = await res.json();
        if ((fc as any).error) {
          throw new Error((fc as any).error);
        }

        setData(fc);

        // Fetch image only if it exists
        if (fc.has_image) {
          const imgRes = await fetch(
            `${API_URL}/p/${encodeURIComponent(public_slug)}/image`
          );
          if (imgRes.ok) {
            const img = await imgRes.json();
            setImageDataUrl(img?.image_data_url ?? null);
          }
        }
      } catch (err: any) {
        console.error("Public flowchart load error:", err);
        setError(err.message || "Failed to load STEM image");
      }
    };

    run();
  }, [public_slug, API_URL]);

  if (error) {
    return <p style={{ color: "red" }}>Error: {error}</p>;
  }

  if (!data) {
    return <p>Loading STEM image…</p>;
  }
const publishedLabel = formatDateTime(data.published_at);

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ marginBottom: 6 }}>{data.title}</h1>
        {publishedLabel && (
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Published: {publishedLabel}
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, opacity: 0.8, alignSelf: "flex-end" }}>
        <a href="/" style={{ textDecoration: "none" }}>STEM-Accessibility</a>
      </div>
    </div>

      <RepresentationBrowser
        data={data.json_data}
        diagramType={data.flowchart_type}
        summary={data.summary}
        shortAlt={data.short_alt}
        title={data.title}
        imageDataUrl={imageDataUrl}
        shareUrl={`${window.location.origin}${window.location.pathname}`}
        initialView={new URLSearchParams(window.location.search).get("view")}
        onViewChange={(next) => {
          const url = new URL(window.location.href);
          url.searchParams.set("view", next);
          window.history.replaceState({}, "", url.toString());
        }}
      />

      <div
      style={{
        marginTop: 36,
        paddingTop: 14,
        borderTop: "1px solid #eee",
        fontSize: 12,
        opacity: 0.75,
      }}
    >
      Published via STEM-Accessibility. This page is a public rendering of a shared STEM image.
    </div>
    </div>
  );
};

export default PublicFlowchart;
