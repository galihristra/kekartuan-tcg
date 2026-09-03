import type { ReactNode } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  /** Icon buttons placed in the header, to the left of the close button. */
  headerActions?: ReactNode;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  className,
  headerActions,
}: ModalProps) {
  useScrollLock(open);
  if (!open) return null;
  return (
    <div className="tk-modal-backdrop" onClick={onClose}>
      <div
        className={`tk-modal${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tk-modal-header">
          <h3 className="tk-section-title">{title}</h3>
          <div className="tk-modal-header-actions">
            {headerActions}
            <button className="tk-x" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
