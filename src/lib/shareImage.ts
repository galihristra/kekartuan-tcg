/** The deciding half of "share this result as a picture", kept free of the DOM
 *  and of `navigator` so the fallback rules can be exercised directly in tests.
 *  The browser wiring is `browserShareTargets()` at the bottom. */

export interface ShareImage {
  blob: Blob;
  filename: string;
  /** Title the share sheet shows, and the text posted alongside the image. */
  title: string;
  text: string;
}

/** The three things the platform can do with a finished image. Injected so the
 *  fallback chain below can be tested without a share sheet or a download. */
export interface ShareTargets {
  /** Whether this platform's share sheet will take a file at all. */
  canShareFile: (image: ShareImage) => boolean;
  /** Opens the share sheet. Rejects with an `AbortError` if the user dismisses it. */
  shareFile: (image: ShareImage) => Promise<void>;
  /** Saves the image to the device. */
  saveFile: (image: ShareImage) => void;
}

export type ShareOutcome = 'shared' | 'saved' | 'dismissed';

/**
 * Hand the image to the platform: the share sheet where there is one, a
 * download everywhere else.
 *
 * The one case that must *not* fall back to a download is the user closing the
 * share sheet — that's a decision not to share, and answering it by dropping
 * the file in Downloads anyway is the opposite of what they asked for. Every
 * other rejection is a share that couldn't happen (no handler for the file,
 * or Safari refusing because the render outlived the tap's user activation),
 * and there the download is the useful outcome.
 */
export async function shareOrSaveImage(
  image: ShareImage,
  targets: ShareTargets,
): Promise<ShareOutcome> {
  if (!targets.canShareFile(image)) {
    targets.saveFile(image);
    return 'saved';
  }
  try {
    await targets.shareFile(image);
    return 'shared';
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'dismissed';
    targets.saveFile(image);
    return 'saved';
  }
}

/** Lowercase, dash-joined, ASCII-only — safe on every filesystem a phone or a
 *  desktop might save this to. Unlike `slugify` in `eventStore` this isn't
 *  bound by the slug column's length check, so it keeps its own cap. */
const FILENAME_SEGMENT_MAX_LENGTH = 40;

function filenameSegment(input: string): string {
  return (
    input
      .normalize('NFKD')
      // Strip the combining accents NFKD just split off, so "Café" → "cafe"
      // rather than losing the letter entirely to the non-alphanumeric pass.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, FILENAME_SEGMENT_MAX_LENGTH)
      .replace(/^-+|-+$/g, '')
  );
}

/** What the saved file is called. Segments that slug down to nothing (a blank
 *  event name, a name written entirely in a non-Latin script) drop out rather
 *  than leaving "--" in the middle of the name. */
export function resultImageFilename(
  eventName: string | undefined,
  playerName: string,
): string {
  const parts = ['kekartuan', eventName ?? '', playerName, 'result']
    .map(filenameSegment)
    .filter(Boolean);
  return `${parts.join('-')}.png`;
}

/** The caption that rides along with the image in the share sheet. */
export function resultShareText(
  eventName: string | undefined,
  playerName: string,
): string {
  const event = eventName?.trim();
  return event
    ? `${playerName}'s result at ${event} — Kekartuan TCG`
    : `${playerName}'s result — Kekartuan TCG`;
}

function toFile(image: ShareImage): File {
  return new File([image.blob], image.filename, { type: image.blob.type });
}

export function browserShareTargets(): ShareTargets {
  return {
    canShareFile: (image) =>
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function' &&
      navigator.canShare({ files: [toFile(image)] }),
    shareFile: (image) =>
      navigator.share({
        files: [toFile(image)],
        title: image.title,
        text: image.text,
      }),
    saveFile: (image) => {
      const url = URL.createObjectURL(image.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = image.filename;
      link.click();
      // Safari needs the URL to outlive the click, so release it on the next
      // turn of the event loop rather than immediately.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
  };
}
