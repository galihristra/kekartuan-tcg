import { useEffect, useMemo, useRef, useState } from 'react';
import type { Player, StandingRow } from '../engine/tournament';
import { useShareImage } from '../hooks/useShareImage';
import {
  browserShareTargets,
  canCopyImage,
  canShareImageFile,
  copyImageToClipboard,
  resultImageFilename,
  resultShareText,
  shareOrSaveImage,
} from '../lib/shareImage';
import Modal from './Modal';
import PlayerResultDetails from './PlayerResultDetails';
import PlayerResultShareCard from './PlayerResultShareCard';
import PlayerResultTitle from './PlayerResultTitle';

interface PlayerPerformanceModalProps {
  onClose: () => void;
  row: StandingRow;
  playerMap: Record<string, Player>;
  /** Shown above the player's name so a shared picture of this modal says which
   *  event the result belongs to. */
  eventName?: string;
  /** ISO timestamp, printed in the footer of the shared picture. */
  eventDate?: string;
  /** When provided, renders an "Edit deck" button (admin only). */
  onEditDeck?: () => void;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15V3m0 0L8 7m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
      />
    </svg>
  );
}

export default function PlayerPerformanceModal({
  onClose,
  row,
  playerMap,
  eventName,
  eventDate,
  onEditDeck,
}: PlayerPerformanceModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { status, previewUrl, blob, render, reset } = useShareImage(cardRef);
  const [handingOff, setHandingOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Closing the modal mid-confirmation would otherwise leave the timer to set
  // state on a gone component.
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const image = useMemo(
    () =>
      blob && {
        blob,
        filename: resultImageFilename(eventName, row.name),
        title: `${row.name}'s Result`,
        text: resultShareText(eventName, row.name),
      },
    [blob, eventName, row.name],
  );

  async function handOff() {
    if (!image) return;
    setHandingOff(true);
    try {
      await shareOrSaveImage(image, browserShareTargets());
    } finally {
      setHandingOff(false);
    }
  }

  function copy() {
    if (!image) return;
    // Nothing is awaited before the clipboard write — see copyImageToClipboard.
    copyImageToClipboard(image).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  const shareLabel =
    status === 'rendering' ? 'Preparing image…' : 'Share this result';
  // Chrome on desktop Linux and macOS has `navigator.share` but won't take
  // files, so the primary button says what it will actually do.
  const handOffLabel = image && canShareImageFile(image) ? 'Share' : 'Save';

  return (
    <Modal
      open
      onClose={onClose}
      className="tk-modal--perf"
      title={
        <PlayerResultTitle
          playerName={row.name}
          player={playerMap[row.id]}
          eventName={eventName}
        />
      }
      headerActions={
        status === 'idle' || status === 'rendering' ? (
          <button
            type="button"
            className="tk-btn ghost tk-icon-btn"
            onClick={render}
            disabled={status === 'rendering'}
            title={shareLabel}
            aria-label={shareLabel}
          >
            {status === 'rendering' ? (
              <span className="tk-spinner" />
            ) : (
              <ShareIcon />
            )}
          </button>
        ) : null
      }
    >
      {status === 'ready' && previewUrl ? (
        // The share sheet has to be opened straight off a tap: iOS drops the
        // page's user activation while the image renders, and rejects a
        // `navigator.share` that arrives after it. Showing the finished picture
        // first splits the render off the share, and lets the player see what
        // they're about to post.
        <div className="tk-share-preview">
          <img
            className="tk-share-preview-img"
            src={previewUrl}
            alt={`${row.name}'s result as a shareable image`}
          />
          <div className="tk-share-preview-actions">
            <button
              className="tk-btn"
              onClick={handOff}
              disabled={handingOff}
              type="button"
            >
              {handOffLabel}
            </button>
            {canCopyImage() && (
              <button
                className={`tk-btn ghost${copied ? ' is-copied' : ''}`}
                onClick={copy}
                type="button"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
            <button className="tk-btn ghost" onClick={reset} type="button">
              Back
            </button>
          </div>
        </div>
      ) : (
        <>
          {status === 'error' && (
            <div className="tk-share-error">
              <span>Couldn't build the image.</span>
              <button className="tk-btn ghost" onClick={render} type="button">
                Try again
              </button>
            </div>
          )}

          <PlayerResultDetails
            row={row}
            playerMap={playerMap}
            afterStats={
              onEditDeck && (
                <button
                  className="tk-btn ghost tk-perf-edit"
                  onClick={onEditDeck}
                >
                  Edit deck
                </button>
              )
            }
          />
        </>
      )}

      <PlayerResultShareCard
        ref={cardRef}
        row={row}
        playerMap={playerMap}
        eventName={eventName}
        eventDate={eventDate}
      />
    </Modal>
  );
}
