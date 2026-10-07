import React, { useEffect, useRef, useState } from 'react';
import type { AsciiFrame } from 'asciify-engine/core';

export type ArtMode = 'original' | 'ascii';

/** Backing-store resolution of the ASCII canvas (CSS box is 150px). */
const RENDER_SIZE = 300;
/** Bounded conversion cache: one entry per artwork URL. */
const MAX_CACHE_ENTRIES = 20;

interface CachedFrame {
  frame: AsciiFrame;
}

const frameCache = new Map<string, CachedFrame>();

function evictIfNeeded() {
  while (frameCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = frameCache.keys().next();
    if (oldest.done) break;
    frameCache.delete(oldest.value);
  }
}

function loadImage(src: string, timeoutMs = 10000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => reject(new Error('artwork load timed out')), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('artwork failed to load'));
    };
    img.src = src;
  });
}

/** Cover-crop any aspect ratio into a square so proportions are preserved. */
function drawCoverSquare(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context for cover crop');
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = Math.floor((img.naturalWidth - side) / 2);
  const sy = Math.floor((img.naturalHeight - side) / 2);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

interface SpotifyAsciiArtProps {
  /** Artwork URL. Renders the placeholder when null. */
  src: string | null;
  /** Display mode. Conversion only runs in 'ascii' mode. */
  mode: ArtMode;
  /** Alt text for the fallback image. */
  alt?: string;
  /** Notified once per source: true when ASCII rendered, false on any failure. */
  onAsciiStatus?: (ok: boolean) => void;
}

/**
 * Album artwork with an optional monochrome ASCII rendering.
 *
 * - Converts exactly once per artwork URL (module cache), only in ascii mode.
 * - Single synchronous render per conversion — no loops, no animation.
 * - Any loading, CORS/taint, or conversion failure falls back to the photo.
 */
export const SpotifyAsciiArt: React.FC<SpotifyAsciiArtProps> = ({ src, mode, alt = 'Album artwork', onAsciiStatus }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const onAsciiStatusRef = useRef(onAsciiStatus);
  onAsciiStatusRef.current = onAsciiStatus;

  useEffect(() => {
    if (mode !== 'ascii' || !src) return;
    let cancelled = false;

    (async () => {
      try {
        // Lazy chunk: the engine loads only when ASCII mode is actually used.
        const mod = await import('asciify-engine/core');
        if (cancelled) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) throw new Error('no ascii canvas');

        const opts = {
          ...mod.DEFAULT_OPTIONS,
          fontSize: 8,
          colorMode: 'grayscale' as const,
          animationStyle: 'none' as const,
          hoverStrength: 0,
          normalize: true,
        };

        let frame: AsciiFrame | undefined = frameCache.get(src)?.frame;
        if (!frame) {
          const img = await loadImage(src);
          if (cancelled) return;
          const square = drawCoverSquare(img, RENDER_SIZE);
          // Throws on tainted (CORS-blocked) pixel reads — caught below.
          ({ frame } = mod.imageToAsciiFrame(square, opts, RENDER_SIZE, RENDER_SIZE));
          evictIfNeeded();
          frameCache.set(src, { frame });
        }

        canvas.width = RENDER_SIZE;
        canvas.height = RENDER_SIZE;
        mod.renderFrameToCanvas(ctx, frame, opts, RENDER_SIZE, RENDER_SIZE);

        if (!cancelled) {
          setReady(true);
          onAsciiStatusRef.current?.(true);
        }
      } catch {
        if (!cancelled) {
          setReady(false);
          onAsciiStatusRef.current?.(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, mode]);

  if (!src) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          color: 'var(--text-tertiary)',
        }}
      >
        <span style={{ fontSize: 44 }}>♫</span>
        <span style={{ fontSize: 11, fontWeight: 500 }}>Spotify Audio</span>
      </div>
    );
  }

  const showCanvas = mode === 'ascii' && ready;

  return (
    <>
      {/* Photo stays mounted underneath: instant paint while converting,
          permanent fallback if conversion ever fails. */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: showCanvas ? 'none' : 'block',
        }}
      />
      {mode === 'ascii' && (
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: showCanvas ? 'block' : 'none',
          }}
        />
      )}
    </>
  );
};
