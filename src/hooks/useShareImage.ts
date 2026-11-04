import { useCallback, useEffect, useRef, useState } from 'react';

/** Rendered at twice the card's CSS size, so the picture still looks sharp
 *  full-screen on a phone and posted to a feed that re-encodes it. */
const SHARE_IMAGE_SCALE = 2;

export type ShareImageStatus = 'idle' | 'rendering' | 'ready' | 'error';

export interface ShareImageState {
  status: ShareImageStatus;
  /** Object URL for the preview, live only while `status` is 'ready'. */
  previewUrl: string | null;
  blob: Blob | null;
  /** Turns the referenced node into a PNG and moves to 'ready'. */
  render: () => Promise<void>;
  /** Throws the render away and goes back to 'idle'. */
  reset: () => void;
}

/**
 * Rasterizes an off-screen node into a PNG the user can save or share.
 *
 * The node is captured where it already sits in the DOM: `modern-screenshot`
 * paints it through `getComputedStyle`, so a clone lifted somewhere else would
 * lose every `var(--…)` in the palette — those are declared on `.tk-root`, not
 * on `:root`. Keeping the card inside the modal's own subtree is what makes the
 * picture come out in the theme the viewer is actually looking at.
 *
 * The renderer itself is pulled in on the first share rather than bundled with
 * the app: it is a rasterizer nobody needs to download to read a standings
 * table.
 */
export function useShareImage(
  nodeRef: React.RefObject<HTMLElement | null>,
): ShareImageState {
  const [status, setStatus] = useState<ShareImageStatus>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  // Read on cleanup, so unmounting mid-preview still releases the URL that a
  // stale closure over `previewUrl` wouldn't know about.
  const urlRef = useRef<string | null>(null);

  const release = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(() => release, [release]);

  const render = useCallback(async () => {
    const node = nodeRef.current;
    if (!node) return;
    setStatus('rendering');
    try {
      const { domToBlob } = await import('modern-screenshot');
      const png = await domToBlob(node, {
        type: 'image/png',
        scale: SHARE_IMAGE_SCALE,
      });
      release();
      urlRef.current = URL.createObjectURL(png);
      setBlob(png);
      setPreviewUrl(urlRef.current);
      setStatus('ready');
    } catch (e) {
      console.error('Failed to render the result image', e);
      setStatus('error');
    }
  }, [nodeRef, release]);

  const reset = useCallback(() => {
    release();
    setPreviewUrl(null);
    setBlob(null);
    setStatus('idle');
  }, [release]);

  return { status, previewUrl, blob, render, reset };
}
