import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Kept for Modal API compatibility — ignored (panel is always side sheet). */
  size?: 'md' | 'lg';
}

/**
 * Right-side slide-in panel for dashboard forms.
 * Replaces centered modals — no dark overlay; dashboard stays visible.
 */
export const SlidePanel: React.FC<SlidePanelProps> = ({
  open,
  onClose,
  title,
  subtitle = 'Fill in the details below',
  children,
  footer,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`slide-panel-scrim${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`slide-panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-panel-title"
        aria-hidden={!open}
      >
        <header className="slide-panel-header">
          <button
            type="button"
            className="slide-panel-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <h2 id="slide-panel-title" className="slide-panel-title">
            {title}
          </h2>
          {subtitle ? <p className="slide-panel-sub">{subtitle}</p> : null}
        </header>
        <div className="slide-panel-body">{children}</div>
        {footer ? <div className="slide-panel-footer">{footer}</div> : null}
      </aside>
    </>
  );
};

export default SlidePanel;
