import { FormEvent, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Comment = {
  id: number;
  user_type: string;
  user_id: number | null;
  author_name: string;
  body: string;
  created_at: string;
};

type Props = {
  churchId: number;
  active?: boolean;
};

export function LiveComments({ churchId, active = false }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!churchId || !active) return;
    let mounted = true;

    void api.get('/church-life/live/comments').then((res) => {
      if (mounted) setComments(res.data?.data || []);
    }).catch(() => undefined);

    const socket = io(undefined, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;
    socket.emit('join-live-room', churchId);
    socket.on('comment:new', (comment: Comment) => {
      if (!mounted) return;
      // The poster already appended their own comment optimistically on submit —
      // skip it here so it doesn't render twice once the broadcast echoes back.
      setComments((prev) => (prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]));
    });

    return () => {
      mounted = false;
      socket.off('comment:new');
      socket.disconnect();
    };
  }, [churchId, active]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [comments]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      // Show it immediately instead of waiting on the socket round-trip — the poster
      // shouldn't need a page refresh to see their own message land.
      const res = await api.post('/church-life/live/comments', { body });
      const posted = res.data as Comment;
      setComments((prev) => (prev.some((c) => c.id === posted.id) ? prev : [...prev, posted]));
      setDraft('');
    } catch {
      /* toast not critical for a comment box */
    } finally {
      setSending(false);
    }
  };

  if (!active) return null;

  return (
    <div className="live-comments">
      <h3 className="live-comments-title">Live chat</h3>
      <div className="live-comments-list" ref={listRef}>
        {comments.length === 0 ? (
          <p className="live-comments-empty">Be the first to say something 👋</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="live-comment">
              <span className="live-comment-author">
                {c.author_name}
                {c.user_id === user?.id && ' (You)'}
              </span>
              <span className="live-comment-body">{c.body}</span>
            </div>
          ))
        )}
      </div>
      <form className="live-comments-input" onSubmit={submit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something…"
          maxLength={500}
        />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Send">
          <Send size={16} />
        </button>
      </form>

      <style>{`
        .live-comments {
          display: flex; flex-direction: column;
          border: 1px solid var(--border, #e8e4dc); border-radius: 16px;
          background: var(--bg-primary, #fff); overflow: hidden;
          max-height: 420px; margin-top: 14px;
        }
        .live-comments-title {
          margin: 0; padding: 12px 16px; font-size: 14px; font-weight: 700;
          border-bottom: 1px solid var(--border, #e8e4dc);
        }
        .live-comments-list {
          flex: 1; min-height: 160px; max-height: 260px; overflow-y: auto;
          padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;
        }
        .live-comments-empty { font-size: 13px; color: var(--text-muted, #9e9893); text-align: center; margin-top: 20px; }
        .live-comment { font-size: 13.5px; line-height: 1.4; }
        .live-comment-author { font-weight: 700; margin-right: 6px; }
        .live-comments-input {
          display: flex; gap: 8px; padding: 10px 12px;
          border-top: 1px solid var(--border, #e8e4dc);
        }
        .live-comments-input input {
          flex: 1; min-width: 0; border: 1px solid var(--border, #e8e4dc);
          border-radius: 999px; padding: 8px 14px; font-size: 13.5px; outline: none;
        }
        .live-comments-input button {
          width: 36px; height: 36px; border-radius: 50%; border: 0;
          background: var(--accent, #2d1b69); color: #fff; cursor: pointer;
          display: grid; place-items: center; flex-shrink: 0;
        }
        .live-comments-input button:disabled { opacity: .4; cursor: default; }
      `}</style>
    </div>
  );
}

export default LiveComments;
