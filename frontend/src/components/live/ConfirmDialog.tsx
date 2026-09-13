import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app confirmation modal for the video room — replaces native window.confirm(). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  // Rendered via a portal straight to <body> — RoomControls (its usual parent) has
  // `backdrop-filter`, which (like `transform`/`filter`) creates a new containing block
  // for `position: fixed` descendants. Without the portal, this dialog's "fixed, full
  // viewport" scrim gets trapped inside that small bottom bar instead of the real
  // viewport, which is why it rendered squashed at the bottom instead of centered.
  return createPortal(
    <div className="lk-confirm-scrim" onClick={onCancel}>
      <div
        className="lk-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lk-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`lk-confirm-icon${danger ? ' is-danger' : ''}`}>
          <AlertTriangle size={20} />
        </span>
        <h3 id="lk-confirm-title">{title}</h3>
        <p>{description}</p>
        <div className="lk-confirm-actions">
          <button type="button" className="lk-confirm-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`lk-confirm-ok${danger ? ' is-danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        .lk-confirm-scrim {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(8,7,6,.6); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center;
          animation: lkConfirmFade .15s ease both;
        }
        @keyframes lkConfirmFade { from { opacity: 0; } to { opacity: 1; } }
        .lk-confirm-dialog {
          width: min(360px, calc(100vw - 32px));
          background: #1a1816; color: #f5f3f0;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 16px; padding: 22px;
          box-shadow: 0 20px 50px rgba(0,0,0,.5);
          text-align: center;
          animation: lkConfirmPop .18s ease both;
        }
        @keyframes lkConfirmPop {
          from { opacity: 0; transform: scale(0.94) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .lk-confirm-icon {
          width: 44px; height: 44px; border-radius: 50%; margin: 0 auto 12px;
          display: grid; place-items: center;
          background: rgba(124,92,191,.18); color: var(--vr-accent, #7c5cbf);
        }
        .lk-confirm-icon.is-danger { background: rgba(224,90,78,.18); color: #ff8a7a; }
        .lk-confirm-dialog h3 { margin: 0 0 8px; font-size: 1.05rem; }
        .lk-confirm-dialog p { margin: 0 0 20px; font-size: .88rem; color: rgba(245,243,240,.7); line-height: 1.5; }
        .lk-confirm-actions { display: flex; gap: 10px; }
        .lk-confirm-actions button {
          flex: 1; border-radius: 10px; padding: 10px 14px; font-size: .88rem; font-weight: 600;
          cursor: pointer; border: 1px solid rgba(255,255,255,.14);
        }
        .lk-confirm-cancel { background: transparent; color: #f5f3f0; }
        .lk-confirm-cancel:hover { background: rgba(255,255,255,.08); }
        .lk-confirm-ok { background: var(--vr-accent, #7c5cbf); color: #fff; border-color: transparent; }
        .lk-confirm-ok:hover { filter: brightness(1.1); }
        .lk-confirm-ok.is-danger { background: #b42318; }
        .lk-confirm-ok.is-danger:hover { background: #971d10; }
      `}</style>
    </div>,
    document.body
  );
}

export default ConfirmDialog;
