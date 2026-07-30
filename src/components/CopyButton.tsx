import { useEffect, useRef, useState } from 'react';

// Clipboard while idle, check mark for the moment after a successful copy.
function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="11" height="12" rx="2" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 12.5 9 18 20 6"
      />
    </svg>
  );
}

interface CopyButtonProps {
  /** Read when the button is pressed, so a value that changes between renders
   *  still copies what's on screen. */
  value: string;
  /** Names the thing being copied: "link", "location". */
  label: string;
}

/** Icon button that puts `value` on the clipboard and confirms for two seconds. */
export default function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unmounting mid-confirmation (navigating away, the location being cleared)
  // would otherwise leave the timer to set state on a gone component.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(`Failed to copy ${label}`, e);
    }
  }

  const title = copied ? `Copied ${label}` : `Copy ${label}`;
  return (
    <button
      type="button"
      className={`tk-btn ghost tk-icon-btn ${copied ? 'is-copied' : ''}`}
      onClick={copy}
      title={title}
      aria-label={title}
    >
      {copied ? <CheckIcon /> : <ClipboardIcon />}
    </button>
  );
}
