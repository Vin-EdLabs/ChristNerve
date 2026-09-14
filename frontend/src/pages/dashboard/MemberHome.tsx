import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Cake,
  ChevronRight,
  Flame,
  HandHeart,
  Heart,
  Megaphone,
  MessagesSquare,
  MonitorPlay,
  Network,
  Play,
  Radio,
  Settings,
  ShoppingBag,
  Store,
  UsersRound,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { Spinner } from '../../components/ui/Spinner';
import { VideoWatchOverlay } from '../../components/media/VideoWatchOverlay';
import { asList } from '../../utils/churchLife';
import {
  extractYoutubeId,
  youtubeThumbnail,
} from '../../utils/youtube';
import { LiveNowCard } from '../../components/live/LiveNowCard';
import { useCachedQuery } from '../../utils/useCachedQuery';

type HomePayload = {
  live?: { live_stream_url?: string | null; live_stream_active?: boolean };
  todays_devotional?: {
    id: number;
    title: string;
    scripture?: string | null;
    body: string;
  } | null;
  latest_sermon?: {
    id: number;
    title: string;
    preacher?: string | null;
    youtube_url?: string;
    youtube_id?: string | null;
    thumbnail_url?: string | null;
    preached_at?: string | null;
  } | null;
  latest_bulletin?: {
    id: number;
    title: string;
    service_date?: string;
    order_of_service?: string | null;
  } | null;
  feed?: Array<{
    id: number;
    body: string;
    image_url?: string | null;
    video_url?: string | null;
    amen_count?: number;
    love_count?: number;
    fire_count?: number;
    my_reaction?: string | null;
  }>;
  birthdays_today?: number;
};

type Person = {
  id: number;
  first_name: string;
  last_name: string;
};

type MemberHomePayload = {
  home: HomePayload;
  birthdays: Person[];
  anniversaries: Person[];
};

async function fetchMemberHome(): Promise<MemberHomePayload> {
  const [homeRes, bdayRes] = await Promise.all([
    api.get('/church-life/home').catch(() => ({ data: {} })),
    api.get('/church-life/birthdays').catch(() => ({ data: {} })),
  ]);
  const h = homeRes.data?.data || homeRes.data || {};
  const b = bdayRes.data?.data || bdayRes.data || {};
  return {
    home: h,
    birthdays: asList<Person>(b.birthdays || b),
    anniversaries: asList<Person>(b.anniversaries),
  };
}

const HERO_FALLBACK =
  'https://images.unsplash.com/photo-1438232992991-9998f8d4b5e0?w=1400&q=80';

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function MemberHome() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const { data: payload, loading, setData } = useCachedQuery<MemberHomePayload>('member-home', fetchMemberHome);
  const home = payload?.home || {};
  const birthdays = payload?.birthdays || [];
  const anniversaries = payload?.anniversaries || [];
  const [watch, setWatch] = useState<{
    id: string;
    title?: string;
    subtitle?: string;
    live?: boolean;
  } | null>(null);
  const [now] = useState(() => new Date());

  const greeting = useMemo(() => greetingForHour(now.getHours()), [now]);
  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString('en-GH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [now]
  );

  const react = async (id: number, reaction: 'amen' | 'love' | 'fire') => {
    try {
      await api.post(`/church-life/feed/${id}/react`, { reaction });
      const homeRes = await api.get('/church-life/home');
      const freshHome = homeRes.data?.data || homeRes.data || {};
      setData((prev) => (prev ? { ...prev, home: freshHome } : { home: freshHome, birthdays: [], anniversaries: [] }));
    } catch {
      /* ignore */
    }
  };

  if (loading) return <Spinner fullPage />;

  const firstName = user?.first_name || 'Friend';
  const churchName = tenant?.name || 'Your church';
  const heroImg = resolveMediaUrl(tenant?.banner_url, HERO_FALLBACK);
  const live = home.live;
  const liveId = extractYoutubeId(live?.live_stream_url || '');
  const feed = home.feed || [];
  const bdayCount =
    home.birthdays_today ?? birthdays.length + anniversaries.length;

  return (
    <div className="member-home member-home--alive">
      <LiveNowCard />
      <header className="mh-hero">
        <div className="mh-hero-media" aria-hidden>
          <img src={heroImg} alt="" className="mh-hero-img" />
          <div className="mh-hero-veil" />
        </div>
        <div className="mh-hero-copy">
          <p className="mh-hero-church">{churchName}</p>
          <h1 className="mh-hero-title">
            {greeting}, {firstName}
          </h1>
          <p className="mh-hero-sub">{dateLabel} · glad you are here</p>
        </div>
      </header>

      <section className="dash-quick-actions">
        <Link to="/live" className="dash-quick-action">
          <span className="dash-quick-action-icon"><Radio size={20} /></span>
          Live Stream
        </Link>
        <Link to="/live-rooms" className="dash-quick-action">
          <span className="dash-quick-action-icon"><MonitorPlay size={20} /></span>
          Live Room
        </Link>
        <Link to="/my-department" className="dash-quick-action">
          <span className="dash-quick-action-icon"><Network size={20} /></span>
          Department
        </Link>
        <Link to="/my-cell-group" className="dash-quick-action">
          <span className="dash-quick-action-icon"><UsersRound size={20} /></span>
          Cell Group
        </Link>
        <Link to="/prayer-requests" className="dash-quick-action">
          <span className="dash-quick-action-icon"><HandHeart size={20} /></span>
          Prayer
        </Link>
        <Link to="/feed" className="dash-quick-action">
          <span className="dash-quick-action-icon"><MessagesSquare size={20} /></span>
          Feed
        </Link>
        <Link to="/announcements" className="dash-quick-action">
          <span className="dash-quick-action-icon"><Megaphone size={20} /></span>
          Announcements
        </Link>
        <Link to="/market" className="dash-quick-action">
          <span className="dash-quick-action-icon"><Store size={20} /></span>
          Market
        </Link>
        <Link to="/market/my-listings" className="dash-quick-action">
          <span className="dash-quick-action-icon"><ShoppingBag size={20} /></span>
          My Shop
        </Link>
        <Link to="/settings" className="dash-quick-action">
          <span className="dash-quick-action-icon"><Settings size={20} /></span>
          Settings
        </Link>
      </section>

      {live?.live_stream_active && liveId ? (
        <section className="mh-panel mh-live">
          <div className="member-home-card-head">
            <Radio size={18} />
            <h2>We&apos;re live</h2>
            <span className="mh-live-pill">LIVE</span>
          </div>
          <button
            type="button"
            className="mh-sermon-card mh-live-card"
            onClick={() => navigate('/live')}
          >
            <div className="mh-sermon-media">
              <img src={youtubeThumbnail(liveId)} alt="" />
              <span className="mh-live-badge">LIVE</span>
              <span className="mh-sermon-play">
                <Play size={22} fill="currentColor" />
              </span>
            </div>
            <div className="mh-sermon-copy">
              <strong>Join the live service</strong>
              <p className="member-home-meta">{churchName}</p>
              <span className="mh-tap">Tap to watch</span>
            </div>
          </button>
        </section>
      ) : (
        <div className="mh-pulse" aria-hidden>
          <span className="mh-pulse-dot" />
          <span>Church life is open</span>
        </div>
      )}

      {home.todays_devotional && (
        <section className="mh-panel">
          <div className="member-home-card-head">
            <BookOpen size={18} />
            <h2>Today&apos;s devotion</h2>
          </div>
          <p className="mh-devotion-title">{home.todays_devotional.title}</p>
          {home.todays_devotional.scripture && (
            <p className="member-home-meta">{home.todays_devotional.scripture}</p>
          )}
          <p className="member-home-desc">
            {home.todays_devotional.body.slice(0, 220)}
            {home.todays_devotional.body.length > 220 ? '…' : ''}
          </p>
          <Link to="/devotionals" className="member-home-link">
            Read full devotion <ChevronRight size={14} />
          </Link>
        </section>
      )}

      {feed.length > 0 && (
        <section className="mh-panel">
          <div className="member-home-card-head">
            <Megaphone size={18} />
            <h2>Church feed</h2>
          </div>
          <ul className="mh-news-list">
            {feed.slice(0, 5).map((p, i) => {
              const vid = extractYoutubeId(p.video_url || '');
              return (
                <li
                  key={p.id}
                  className="mh-news-item"
                  style={{ animationDelay: `${0.06 * i}s` }}
                >
                  <p>
                    {p.body.slice(0, 160)}
                    {p.body.length > 160 ? '…' : ''}
                  </p>
                  {vid && (
                    <button
                      type="button"
                      className="mh-feed-video"
                      onClick={() =>
                        setWatch({ id: vid, title: 'Church Feed' })
                      }
                    >
                      <img src={youtubeThumbnail(vid)} alt="" />
                      <span className="mh-sermon-play">
                        <Play size={18} fill="currentColor" />
                      </span>
                    </button>
                  )}
                  <div className="mh-react-row">
                    <button
                      type="button"
                      onClick={() => void react(p.id, 'amen')}
                    >
                      Amen {p.amen_count || 0}
                    </button>
                    <button
                      type="button"
                      onClick={() => void react(p.id, 'love')}
                    >
                      <Heart size={12} /> {p.love_count || 0}
                    </button>
                    <button
                      type="button"
                      onClick={() => void react(p.id, 'fire')}
                    >
                      <Flame size={12} /> {p.fire_count || 0}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link to="/feed" className="member-home-link">
            Open feed <ChevronRight size={14} />
          </Link>
        </section>
      )}

      {bdayCount > 0 && (
        <section className="mh-panel">
          <div className="member-home-card-head">
            <Cake size={18} />
            <h2>Celebrating today</h2>
          </div>
          <ul className="mh-news-list">
            {birthdays.map((p) => (
              <li key={`b-${p.id}`} className="mh-news-item">
                <strong>
                  {p.first_name} {p.last_name}
                </strong>{' '}
                · Birthday
              </li>
            ))}
            {anniversaries.map((p) => (
              <li key={`a-${p.id}`} className="mh-news-item">
                <strong>
                  {p.first_name} {p.last_name}
                </strong>{' '}
                · Anniversary
              </li>
            ))}
          </ul>
          <Link to="/whatsapp-actions" className="member-home-link">
            Send WhatsApp wishes <ChevronRight size={14} />
          </Link>
        </section>
      )}

      <VideoWatchOverlay
        open={!!watch}
        youtubeId={watch?.id || null}
        title={watch?.title}
        subtitle={watch?.subtitle}
        live={watch?.live}
        onClose={() => setWatch(null)}
      />

      <style>{`
        .mh-live-pill { margin-left:auto; font-size:.7rem; font-weight:700; letter-spacing:.06em; color:#b42318; }
        .mh-live-badge {
          position:absolute; left:10px; top:10px; z-index:1;
          font-size:.68rem; font-weight:800; letter-spacing:.06em;
          background:#b42318; color:#fff; padding:4px 8px; border-radius:999px;
          animation: mh-live-pulse 1.2s infinite;
        }
        @keyframes mh-live-pulse { 50% { opacity:.6; } }
        .mh-live-card { margin-top:4px; }
        .mh-devotion-title { margin:0 0 4px; font-weight:600; }
        .mh-sermon-card {
          width:100%; border:0; padding:0; background:transparent;
          text-align:left; color:inherit; cursor:pointer;
          display:flex; flex-direction:column; gap:10px;
        }
        .mh-sermon-media {
          position:relative; width:100%; aspect-ratio:16/9;
          border-radius:12px; overflow:hidden; background:#141210;
        }
        .mh-sermon-media img { width:100%; height:100%; object-fit:cover; display:block; }
        .mh-sermon-play {
          position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
          width:54px; height:54px; border-radius:999px;
          background:rgba(255,255,255,.95); color:#1a1410;
          display:grid; place-items:center; padding-left:3px;
          box-shadow:0 8px 20px rgba(0,0,0,.35);
        }
        .mh-sermon-copy strong { display:block; font-size:1.02rem; }
        .mh-tap { display:inline-block; margin-top:4px; font-size:.8rem; opacity:.65; }
        .mh-feed-video {
          position:relative; display:block; width:100%; margin:10px 0 4px;
          border:0; padding:0; border-radius:10px; overflow:hidden;
          background:#111; cursor:pointer;
        }
        .mh-feed-video img {
          width:100%; aspect-ratio:16/9; object-fit:cover; display:block;
        }
        .mh-react-row { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
        .mh-react-row button {
          border:1px solid rgba(0,0,0,.12); background:transparent;
          border-radius:999px; padding:4px 10px; font-size:.78rem;
          display:inline-flex; align-items:center; gap:4px; cursor:pointer;
        }
      `}</style>
    </div>
  );
}
