import { useEffect, useId, useRef, useState } from 'react';

/** Keeps the bubble's centre this far from either edge of the viewport, so a
 *  tip on the table's last column doesn't run off the screen. Half the
 *  bubble's max-width in tokens.css, plus a margin. */
const EDGE_GAP = 130;

/**
 * A label that explains itself on hover, keyboard focus or tap.
 *
 * The bubble is `position: fixed` from the label's on-screen box rather than
 * absolutely positioned inside it: the standings table sits in a horizontal
 * scroll container, which would clip anything hanging below its header row.
 * Being fixed, it has to be re-placed whenever the page or that container
 * scrolls. Closing on scroll instead would shut it the moment it opened when
 * focusing the label scrolls it into view.
 */
export default function InfoTip({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      const centre = box.left + box.width / 2;
      setPos({
        left: Math.min(
          Math.max(centre, EDGE_GAP),
          window.innerWidth - EDGE_GAP,
        ),
        top: box.bottom + 6,
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    place();
    // Capture, so a scroll inside the table's own container counts too.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onKey);
      // So a reopened tip doesn't flash at wherever it last stood.
      setPos(null);
    };
  }, [open]);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const visible = open && pos !== null;

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="tk-infotip"
        aria-describedby={id}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        // A tap fires focus and then click, so click only ever opens: a
        // toggle would shut the tip the same tap opened. Tapping elsewhere
        // blurs it closed.
        onClick={show}
      >
        {label}
      </button>
      {/* Always rendered so aria-describedby has text to read, hidden or not. */}
      <span
        id={id}
        role="tooltip"
        className="tk-infotip-bubble"
        hidden={!visible}
        style={visible ? pos : undefined}
      >
        {text}
      </span>
    </>
  );
}
