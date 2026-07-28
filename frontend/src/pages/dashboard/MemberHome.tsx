import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Cake,
  ChevronRight,
  Flame,
  HandHeart,
  Heart,
  Megaphone,
  Newspaper,
  Play,
  Radio,
  Settings,
  Store,
  Video,
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
  const [loading, setLoading] = useState(true);
  const [home, setHome] = useState<HomePayload>({});
  const [birthdays, setBirthdays] = useState<Person[]>([]);
  const [anniversaries, setAnniversaries] = useState<Person[]>([]);
  const [watch, setWatch] = useState<{
    id: string;
    title?: string;
    subtitle?: string;
    live?: boolean;
  } | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [homeRes, bdayRes] = await Promise.all([
          api.get('/church-life/home').catch(() => ({ data: {} })),
          api.get('/church-life/birthdays').catch(() => ({ data: {} })),
        ]);
        if (cancelled) return;
        const h = homeRes.data?.data || homeRes.data || {};
        setHome(h);
        const b = bdayRes.data?.data || bdayRes.data || {};
        setBirthdays(asList<Person>(b.birthdays || b));
        setAnniversaries(asList<Person>(b.anniversaries));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setHome(homeRes.data?.data || homeRes.data || {});
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

      {home.latest_bulletin && (
        <section className="mh-panel">
          <div className="member-home-card-head">
            <Newspaper size={18} />
            <h2>Sunday bulletin</h2>
          </div>
          <p className="mh-devotion-title">{home.latest_bulletin.title}</p>
          <p className="member-home-meta">
            {String(home.latest_bulletin.service_date || '').slice(0, 10)}
          </p>
          {home.latest_bulletin.order_of_service && (
            <p className="member-home-desc">
              {home.latest_bulletin.order_of_service.slice(0, 160)}
              {home.latest_bulletin.order_of_service.length > 160 ? '…' : ''}
            </p>
          )}
          <Link to="/bulletin" className="member-home-link">
            Full bulletin <ChevronRight size={14} />
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

      <section className="mh-panel mh-links">
        <h2>Also</h2>
        <div className="member-home-action-row">
          <Link to="/prayer-requests" className="mh-link">
            <span className="mh-link-icon">
              <HandHeart size={18} />
            </span>
            <span>Prayer</span>
          </Link>
          <Link to="/sermons" className="mh-link">
            <span className="mh-link-icon">
              <Video size={18} />
            </span>
            <span>Sermons</span>
          </Link>
          <Link to="/bulletin" className="mh-link">
            <span className="mh-link-icon">
              <Newspaper size={18} />
            </span>
            <span>Bulletin</span>
          </Link>
          <Link to="/market" className="mh-link">
            <span className="mh-link-icon">
              <Store size={18} />
            </span>
            <span>Market</span>
          </Link>
          <Link to="/settings" className="mh-link">
            <span className="mh-link-icon">
              <Settings size={18} />
            </span>
            <span>Settings</span>
          </Link>
        </div>
      </section>

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
