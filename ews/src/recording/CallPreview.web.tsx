// Browser camera preview: a <video> element showing the live MediaStream. See CallPreview.tsx.
import { useEffect, useRef } from 'react';

import type { PreviewProps } from './types';

/**
 * `fill` makes the video cover its parent (the tile in the lobby or in the call).
 * `fit` is how the picture sits in it: "cover" fills the tile and crops the edges (right for the
 * lobby's 16:9 tile); "contain" shows the whole picture with bars if the tile has another shape
 * (right for the call, whose tile takes the shape of the window).
 */
export function CallPreview({
  preview,
  fill = true,
  fit = 'cover',
}: {
  preview: PreviewProps;
  fill?: boolean;
  fit?: 'cover' | 'contain';
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = preview.stream;
  }, [preview.stream, preview.video]);

  if (!preview.video || !preview.stream) return null;
  return (
    <video
      ref={ref}
      autoPlay
      muted // our own voice would echo; the recording still has audio
      playsInline
      style={{
        ...(fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : { width: '100%', maxHeight: 320 }),
        background: '#000',
        objectFit: fit,
        transform: 'scaleX(-1)', // mirror, like a video call
      }}
    />
  );
}
