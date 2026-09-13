import { FormEvent, useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, X } from 'lucide-react';
import { useDataChannel, useLocalParticipant } from '@livekit/components-react';

type ChatMsg = {
  id: number;
  from: string;
  body: string;
  at: number;
  self: boolean;
};

export interface RoomChatProps {
  /** Whether this panel is the one currently open/visible. */
  active: boolean;
  onUnreadChange?: (count: number) => void;
  onClose: () => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function RoomChat({ active, onUnreadChange, onClose }: RoomChatProps) {
  const { localParticipant } = useLocalParticipant();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const unreadRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const { send } = useDataChannel('chat', (msg) => {
    try {
      const payload = JSON.parse(decoder.decode(msg.payload)) as { body: string; from: string; at: number };
      setMessages((prev) => [...prev, { id: ++idRef.current, body: payload.body, from: payload.from, at: payload.at, self: false }]);
      if (!active) {
        unreadRef.current += 1;
        onUnreadChange?.(unreadRef.current);
      }
    } catch {
      /* ignore malformed */
    }
  });

  useEffect(() => {
    if (active) {
      unreadRef.current = 0;
      onUnreadChange?.(0);
    }
  }, [active, onUnreadChange]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, active]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const at = Date.now();
    const from = localParticipant?.name || 'You';
    setMessages((prev) => [...prev, { id: ++idRef.current, body, from, at, self: true }]);
    setDraft('');
    void send(encoder.encode(JSON.stringify({ body, from, at })), { reliable: true });
  };

  return (
    <div className="room-chat">
      <header className="room-chat-header">
        <MessageCircle size={15} />
        <span>Chat</span>
        <button type="button" className="side-panel-close" onClick={onClose} aria-label="Close">
          <X size={17} />
        </button>
      </header>

      <div className="room-chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <p className="room-chat-empty">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`room-chat-msg${m.self ? ' is-self' : ''}`}>
              <div className="room-chat-bubble">
                {!m.self && <strong>{m.from}</strong>}
                <p>{m.body}</p>
                <time>{new Date(m.at).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })}</time>
              </div>
            </div>
          ))
        )}
      </div>

      <form className="room-chat-input" onSubmit={submit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          maxLength={500}
        />
        <button type="submit" aria-label="Send" disabled={!draft.trim()}>
          <Send size={16} />
        </button>
      </form>

      <style>{`
        .room-chat {
          display: flex; flex-direction: column; height: 100%; min-height: 0;
          color: #f5f3f0;
        }
        .room-chat-header {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 14px; font-size: .82rem; font-weight: 700;
          border-bottom: 1px solid rgba(255,255,255,.08); flex-shrink: 0;
        }
        .side-panel-close {
          margin-left: auto; border: 0; background: transparent; color: rgba(245,243,240,.65);
          cursor: pointer; padding: 4px; display: grid; place-items: center; border-radius: 6px;
        }
        .side-panel-close:hover { background: rgba(255,255,255,.08); color: #fff; }
        .room-chat-list { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
        .room-chat-empty { opacity: .6; font-size: .85rem; text-align: center; margin-top: 24px; }
        .room-chat-msg { display: flex; }
        .room-chat-msg.is-self { justify-content: flex-end; }
        .room-chat-bubble {
          max-width: 84%; background: rgba(255,255,255,.08);
          border-radius: 12px; padding: 6px 10px;
        }
        .room-chat-msg.is-self .room-chat-bubble { background: var(--vr-accent, #7c5cbf); }
        .room-chat-bubble strong { display: block; font-size: .72rem; opacity: .7; margin-bottom: 1px; }
        .room-chat-bubble p { margin: 0; font-size: .86rem; line-height: 1.4; word-break: break-word; }
        .room-chat-bubble time { display: block; font-size: .65rem; opacity: .55; margin-top: 2px; text-align: right; }
        .room-chat-input {
          display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(255,255,255,.08); flex-shrink: 0;
        }
        .room-chat-input input {
          flex: 1; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1);
          border-radius: 999px; padding: 8px 14px; color: inherit; font-size: .84rem; outline: none;
          min-width: 0;
        }
        .room-chat-input input::placeholder { color: rgba(245,243,240,.45); }
        .room-chat-input button {
          width: 36px; height: 36px; border-radius: 50%; border: 0;
          background: var(--vr-accent, #7c5cbf); color: #fff; display: grid; place-items: center;
          cursor: pointer; flex-shrink: 0;
        }
        .room-chat-input button:disabled { opacity: .4; cursor: default; }
      `}</style>
    </div>
  );
}

export default RoomChat;
