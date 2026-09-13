import { useState } from 'react';
import { Link2, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { churchDomainUrl } from '../../utils/tenantHost';

export interface InvitePopoverProps {
  roomId: number;
  churchSlug: string;
  initialEnabled: boolean;
  initialCode: string | null;
  onClose: () => void;
}

export function InvitePopover({ roomId, churchSlug, initialEnabled, initialCode, onClose }: InvitePopoverProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [code, setCode] = useState(initialCode);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = code ? churchDomainUrl(churchSlug, `/join/${code}`) : '';

  const toggle = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await api.post(`/live/rooms/${roomId}/public-link`, { enabled: next });
      setEnabled(res.data.public_join_enabled);
      setCode(res.data.public_join_code);
    } catch {
      toast.error('Could not update the invite link');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rc-popover rc-invite" onClick={(e) => e.stopPropagation()}>
      <div className="rc-invite-head">
        <span>
          <Link2 size={14} /> Public invite link
        </span>
        <button type="button" className="rc-invite-close" onClick={onClose}>✕</button>
      </div>
      <p className="rc-invite-desc">Anyone with this link can join by entering their name — no account needed.</p>
      <label className="rc-invite-toggle">
        <input type="checkbox" checked={enabled} disabled={saving} onChange={(e) => void toggle(e.target.checked)} />
        <span>{enabled ? 'Link is on' : 'Link is off'}</span>
      </label>
      {enabled && link && (
        <div className="rc-invite-link-row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button type="button" className="rc-invite-copy-btn" onClick={copyLink} aria-label="Copy link">
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}

      <style>{`
        .rc-invite { width: min(300px, calc(100vw - 32px)); text-align: left; bottom: calc(100% + 10px); }
        .rc-invite-head {
          display: flex; align-items: center; justify-content: space-between;
          font-size: .78rem; font-weight: 700; margin-bottom: 6px;
        }
        .rc-invite-head span { display: inline-flex; align-items: center; gap: 6px; }
        .rc-invite-close { border: 0; background: transparent; color: rgba(245,243,240,.6); cursor: pointer; }
        .rc-invite-desc { margin: 0 0 10px; font-size: .74rem; color: rgba(245,243,240,.6); line-height: 1.4; }
        .rc-invite-toggle { display: flex; align-items: center; gap: 8px; font-size: .82rem; cursor: pointer; }
        .rc-invite-link-row { display: flex; gap: 6px; margin-top: 10px; }
        .rc-invite-link-row input {
          flex: 1; min-width: 0; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
          border-radius: 8px; padding: 8px 10px; color: #fff; font-size: .74rem;
        }
        .rc-invite-copy-btn {
          border: 0; background: var(--vr-accent, #7c5cbf); color: #fff; border-radius: 8px;
          flex-shrink: 0; cursor: pointer; padding: 0 12px; height: auto;
          display: inline-flex; align-items: center; gap: 6px;
          font-size: .78rem; font-weight: 700; white-space: nowrap;
        }
        .rc-invite-copy-btn:hover { filter: brightness(1.08); }
      `}</style>
    </div>
  );
}

export default InvitePopover;
