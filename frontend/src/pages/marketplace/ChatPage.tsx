import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ExternalLink, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { formatPriceRange } from '../../utils/formatGHS';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

interface Conversation {
  id: number;
  seller_member_id: number;
  seller_first_name?: string;
  seller_last_name?: string;
  buyer_first_name?: string;
  buyer_last_name?: string;
  listing_title?: string | null;
  listing_slug?: string | null;
  listing_image?: string | null;
  listing_id?: number | null;
  listing_price_label?: string | null;
  listing_price_min?: number | null;
  listing_price_max?: number | null;
  last_message?: string | null;
  unread_count?: number;
  last_message_at?: string;
}

interface ChatMessage {
  id: number;
  sender_type: 'buyer' | 'seller';
  sender_id: number;
  body: string;
  created_at: string;
}

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80';

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

function peerName(c: Conversation, asSeller: boolean) {
  if (asSeller) {
    return `${c.buyer_first_name || ''} ${c.buyer_last_name || ''}`.trim() || 'Buyer';
  }
  return `${c.seller_first_name || ''} ${c.seller_last_name || ''}`.trim() || 'Vendor';
}

function ProductCard({
  conversation,
  compact = false,
}: {
  conversation: Conversation;
  compact?: boolean;
}) {
  if (!conversation.listing_title) return null;
  const href = conversation.listing_slug
    ? `/market/listing/${conversation.listing_slug}`
    : null;
  const price = formatPriceRange(
    conversation.listing_price_min,
    conversation.listing_price_max,
    conversation.listing_price_label
  );
  const img = resolveMediaUrl(conversation.listing_image, PLACEHOLDER);

  const inner = (
    <>
      <img src={img} alt="" className="chat-product-card-img" />
      <div className="chat-product-card-body">
        <span className="chat-product-card-label">Product</span>
        <strong className="chat-product-card-title">{conversation.listing_title}</strong>
        <span className="chat-product-card-price">{price}</span>
        {href && (
          <span className="chat-product-card-cta">
            View listing <ChevronRight size={14} />
          </span>
        )}
      </div>
    </>
  );

  if (!href) {
    return (
      <div className={`chat-product-card${compact ? ' is-compact' : ''}`}>{inner}</div>
    );
  }

  return (
    <Link
      to={href}
      className={`chat-product-card${compact ? ' is-compact' : ''}`}
    >
      {inner}
    </Link>
  );
}

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user, accountType } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const myId = Number(user?.id);
  const iAmSeller = (c: Conversation | null) =>
    accountType === 'member' &&
    !!c &&
    Number(c.seller_member_id) === myId;

  const loadConversations = useCallback(async () => {
    const res = await api.get('/chat/conversations');
    setConversations(asList<Conversation>(res.data));
  }, []);

  const loadThread = useCallback(async (id: number) => {
    const res = await api.get(`/chat/conversations/${id}/messages`);
    setActive(res.data.conversation);
    setMessages(asList<ChatMessage>(res.data));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      const returnTo = `/market/chat${window.location.search || ''}`;
      navigate('/login', { replace: true, state: { from: returnTo } });
      return;
    }
    if (accountType !== 'member') {
      toast.error('Only church members can use in-app chat. Use WhatsApp from checkout.');
      navigate('/market/cart', { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const listing = params.get('listing');

        if (listing && !conversationId) {
          const created = await api.post('/chat/conversations', {
            listing_id: Number(listing),
          });
          if (!cancelled) {
            navigate(`/market/chat/${created.data.id}`, { replace: true });
          }
          return;
        }

        if (!listing && params.get('seller') && !conversationId) {
          toast.error('Open chat from the product page so we reach the right vendor');
        }

        await loadConversations();

        if (conversationId) {
          await loadThread(Number(conversationId));
        } else {
          setActive(null);
          setMessages([]);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data
              ?.error || 'Could not load chat';
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    isAuthenticated,
    accountType,
    conversationId,
    params,
    navigate,
    loadConversations,
    loadThread,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, active?.id]);

  useEffect(() => {
    if (!conversationId) return;
    const id = window.setInterval(() => {
      void loadThread(Number(conversationId)).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(id);
  }, [conversationId, loadThread]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!conversationId || !text.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/chat/conversations/${conversationId}/messages`, {
        body: text.trim(),
      });
      setMessages((prev) => [...prev, res.data]);
      setText('');
      await loadConversations();
    } catch {
      toast.error('Message failed');
    } finally {
      setSending(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="market-page">
        <Spinner fullPage />
      </div>
    );
  }

  const asSeller = !!iAmSeller(active);
  const title = active ? peerName(active, asSeller) : 'Messages';
  const isMember = accountType === 'member';
  const sellerInbox = conversations.some((c) => iAmSeller(c));

  return (
    <div className="market-page chat-page">
      {!conversationId ? (
        <div className="container chat-inbox">
          <header className="chat-inbox-head">
            <h1 className="page-title">Messages</h1>
            <p className="page-sub">
              {sellerInbox
                ? 'Buyer chats about your products — tap to reply.'
                : 'Each chat is linked to a product. Tap to open the thread.'}
            </p>
          </header>
          {conversations.length === 0 ? (
            <EmptyState
              title={isMember ? 'No messages yet' : 'No chats yet'}
              description={
                isMember
                  ? 'When someone messages one of your listings, it appears here.'
                  : 'Add an item to your bag, then tap In-app chat on that product.'
              }
            />
          ) : (
            <div className="chat-list">
              {conversations.map((c) => {
                const sellerView = !!iAmSeller(c);
                const name = peerName(c, sellerView);
                const when = c.last_message_at
                  ? new Date(c.last_message_at).toLocaleDateString('en-GH', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : '';
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="chat-row"
                    onClick={() => navigate(`/market/chat/${c.id}`)}
                  >
                    <img
                      src={resolveMediaUrl(c.listing_image, PLACEHOLDER)}
                      alt=""
                      className="chat-row-img"
                    />
                    <div className="chat-row-main">
                      <div className="chat-row-top">
                        <strong>{name}</strong>
                        {when && <time>{when}</time>}
                      </div>
                      {c.listing_title && (
                        <span className="chat-row-product">{c.listing_title}</span>
                      )}
                      <span className="chat-row-preview">
                        {c.last_message || 'Tap to open chat'}
                      </span>
                    </div>
                    {(c.unread_count || 0) > 0 && (
                      <span className="chat-unread">{c.unread_count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="chat-thread">
          <div className="chat-thread-head">
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Back"
              onClick={() => navigate('/market/chat')}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="chat-thread-titles">
              <strong>{title}</strong>
              <p className="chat-role-hint">
                {asSeller ? 'Buyer · about your listing' : 'Seller · product chat'}
              </p>
            </div>
            {active?.listing_slug && (
              <Link
                to={`/market/listing/${active.listing_slug}`}
                className="chat-head-link"
                aria-label="View product"
              >
                <ExternalLink size={16} />
              </Link>
            )}
          </div>

          <div className="chat-bubbles">
            {active?.listing_title && (
              <div className="chat-product-sticky">
                <ProductCard conversation={active} />
              </div>
            )}

            {messages.map((m, idx) => {
              const mine =
                (m.sender_type === 'buyer' && !asSeller) ||
                (m.sender_type === 'seller' && asSeller);
              const showProductUnderFirst =
                idx === 0 &&
                m.sender_type === 'buyer' &&
                !!active?.listing_title;
              return (
                <div key={m.id} className="chat-msg-block">
                  {showProductUnderFirst && active && (
                    <div className={`chat-msg-product${mine ? ' is-mine' : ''}`}>
                      <ProductCard conversation={active} compact />
                    </div>
                  )}
                  <div className={`chat-bubble${mine ? ' is-mine' : ''}`}>
                    <p>{m.body}</p>
                    <time>
                      {new Date(m.created_at).toLocaleTimeString('en-GH', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form className="chat-composer" onSubmit={send}>
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                asSeller
                  ? 'Reply to this buyer…'
                  : 'Ask about this product…'
              }
              enterKeyHint="send"
            />
            <Button type="submit" loading={sending} disabled={!text.trim()}>
              <Send size={16} />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
