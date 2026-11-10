import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import RepresentationBrowser from './RepresentationBrowser';
import { apiFetch } from '../../lib/api';

import type { PermalinkResponse } from '../../types/types';

const PermalinkContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PermalinkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const run = async () => {
      try {
        setError(null);
        setImageDataUrl(null);

        const fc = await apiFetch<PermalinkResponse>(`/get/${id}`);
        setData(fc);

        if (fc.has_image) {
          const img = await apiFetch<{ image_data_url?: string }>(`/get/${id}/image`);
          setImageDataUrl(img?.image_data_url ?? null);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load STEM image');
      }
    };

    run();
  }, [id]);

  if (error) return <p>Error loading permalink content: {error}</p>;
  if (!data) return <p>Loading permalink content...</p>;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <RepresentationBrowser
        data={data.json_data}
        diagramType={data.flowchart_type}
        summary={data.summary}
        shortAlt={data.short_alt}
        title={data.title}
        imageDataUrl={imageDataUrl}
        editPath={id ? `/editor/${encodeURIComponent(id)}` : undefined}
      />
    </div>
  );
};

export default PermalinkContent;
