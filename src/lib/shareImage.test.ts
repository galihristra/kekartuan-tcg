import { describe, it, expect, vi } from 'vitest';
import {
  resultImageFilename,
  resultShareText,
  shareOrSaveImage,
  type ShareImage,
  type ShareTargets,
} from './shareImage';

const IMAGE: ShareImage = {
  blob: { type: 'image/png' } as Blob,
  filename: 'kekartuan-result.png',
  title: 'Result',
  text: 'Result',
};

/** A platform whose share sheet does whatever `share` is told to do. */
function fakeTargets(
  overrides: Partial<ShareTargets> = {},
): ShareTargets & { saved: () => number } {
  let saveCount = 0;
  return {
    canShareFile: () => true,
    shareFile: () => Promise.resolve(),
    saveFile: () => {
      saveCount += 1;
    },
    ...overrides,
    saved: () => saveCount,
  };
}

function rejectWith(name: string): () => Promise<void> {
  return () => {
    const error = new Error(`share failed: ${name}`);
    error.name = name;
    return Promise.reject(error);
  };
}

describe('shareOrSaveImage', () => {
  it('uses the share sheet when the platform takes files', async () => {
    const shareFile = vi.fn(() => Promise.resolve());
    const targets = fakeTargets({ shareFile });

    expect(await shareOrSaveImage(IMAGE, targets)).toBe('shared');
    expect(shareFile).toHaveBeenCalledWith(IMAGE);
    expect(targets.saved()).toBe(0);
  });

  it('saves instead when the platform has no file sharing', async () => {
    const shareFile = vi.fn(() => Promise.resolve());
    const targets = fakeTargets({ canShareFile: () => false, shareFile });

    expect(await shareOrSaveImage(IMAGE, targets)).toBe('saved');
    expect(shareFile).not.toHaveBeenCalled();
    expect(targets.saved()).toBe(1);
  });

  it('leaves nothing behind when the user closes the share sheet', async () => {
    const targets = fakeTargets({ shareFile: rejectWith('AbortError') });

    expect(await shareOrSaveImage(IMAGE, targets)).toBe('dismissed');
    expect(targets.saved()).toBe(0);
  });

  it('falls back to saving when the share itself fails', async () => {
    // Safari rejects with NotAllowedError when the render outlives the tap's
    // user activation; the image is still worth handing over.
    const targets = fakeTargets({ shareFile: rejectWith('NotAllowedError') });

    expect(await shareOrSaveImage(IMAGE, targets)).toBe('saved');
    expect(targets.saved()).toBe(1);
  });
});

describe('resultImageFilename', () => {
  it('joins the event and the player into a dashed name', () => {
    expect(resultImageFilename('Mini League September', 'Galih')).toBe(
      'kekartuan-mini-league-september-galih-result.png',
    );
  });

  it('folds accents and punctuation the way the slug column does', () => {
    expect(resultImageFilename('Café Cup #2', 'Ana María')).toBe(
      'kekartuan-cafe-cup-2-ana-maria-result.png',
    );
  });

  it('drops segments that slug down to nothing', () => {
    expect(resultImageFilename('', 'Galih')).toBe('kekartuan-galih-result.png');
    expect(resultImageFilename(undefined, 'Galih')).toBe(
      'kekartuan-galih-result.png',
    );
    // A name in a non-Latin script leaves no ASCII behind at all.
    expect(resultImageFilename('リーグ', 'ガリ')).toBe('kekartuan-result.png');
  });

  it('caps each segment so a long event name cannot blow up the filename', () => {
    const name = resultImageFilename('a'.repeat(120), 'b'.repeat(120));
    expect(name).toBe(
      `kekartuan-${'a'.repeat(40)}-${'b'.repeat(40)}-result.png`,
    );
  });
});

describe('resultShareText', () => {
  it('names the event when there is one', () => {
    expect(resultShareText('Mini League', 'Galih')).toBe(
      "Galih's result at Mini League — Kekartuan TCG",
    );
  });

  it('leaves the event out when it is blank', () => {
    expect(resultShareText('   ', 'Galih')).toBe(
      "Galih's result — Kekartuan TCG",
    );
  });
});
