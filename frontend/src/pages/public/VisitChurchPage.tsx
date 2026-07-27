import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Church,
  HeartHandshake,
  Mail,
  MapPin,
  Phone,
  Play,
  Store,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getChurchSlug } from '../../utils/tenantHost';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { Spinner } from '../../components/ui/Spinner';

const HERO_FALLBACK =
  'https://images.unsplash.com/photo-1438232992991-995b671e4268?w=1600&q=80';
const ABOUT_IMG =
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80';

type VisitChurch = {
  name?: string;
  slug?: string;
  tagline?: string;
  description?: string;
  visit_welcome?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  visit_hero_url?: string | null;
  youtube_url?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  phone?: string | null;
  email?: string | null;
  denomination?: string | null;
};

type GalleryItem = { id: number; image_url: string; caption?: string | null };

type VisitEvent = {
  id: number;
  title: string;
  start_datetime?: string;
  location?: string;
  event_type?: string;
};

function whatsappUrl(phone?: string | null) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  const intl = digits.startsWith('0') ? `233${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

function youtubeEmbed(url?: string | null): string | null {
  if (!url?.trim()) return null;
  try {
    const raw = url.trim();
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = u.pathname.replace('/', '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}?rel=0`;

      const parts = u.pathname.split('/').filter(Boolean);
      const embedIdx = parts.indexOf('embed');
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[embedIdx + 1]}?rel=0`;
      }
      const shortsIdx = parts.indexOf('shorts');
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[shortsIdx + 1]}?rel=0`;
      }
      const liveIdx = parts.indexOf('live');
      if (liveIdx >= 0 && parts[liveIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[liveIdx + 1]}?rel=0`;
      }
    }
  } catch {
    if (/^[\w-]{11}$/.test(url.trim())) {
      return `https://www.youtube.com/embed/${url.trim()}?rel=0`;
    }
  }
  return null;
}

function parseYoutubeUrls(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(/[\n,|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const embeds = parts
    .map((url) => youtubeEmbed(url))
    .filter((e): e is string => Boolean(e));
  return [...new Set(embeds)];
}

export default function VisitChurchPage() {
  const slug = getChurchSlug() || 'pka';
  const [loading, setLoading] = useState(true);
  const [church, setChurch] = useState<VisitChurch | null>(null);
  const [events, setEvents] = useState<VisitEvent[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    city: '',
    note: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/public/church/${slug}`);
        if (cancelled) return;
        setChurch(res.data?.church || null);
        setEvents(
          Array.isArray(res.data?.upcoming_events) ? res.data.upcoming_events : []
        );
        setGallery(Array.isArray(res.data?.gallery) ? res.data.gallery : []);
      } catch {
        if (!cancelled) setChurch(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const heroImg = useMemo(() => {
    const custom = resolveMediaUrl(
      church?.visit_hero_url || church?.banner_url || ''
    );
    return custom || HERO_FALLBACK;
  }, [church?.visit_hero_url, church?.banner_url]);

  const logo = resolveMediaUrl(church?.logo_url);
  const wa = whatsappUrl(church?.phone);
  const embeds = useMemo(
    () => parseYoutubeUrls(church?.youtube_url),
    [church?.youtube_url]
  );
  const hasVideo = embeds.length > 0;

  useEffect(() => {
    const nodes = document.querySelectorAll('.vp-reveal');
    if (!nodes.length || typeof IntersectionObserver === 'undefined') {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [loading, church, events, gallery, embeds.length]);

  // Sticky market-style header appears after the hero leaves the viewport
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setHeaderVisible(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '-8px 0px 0px 0px' }
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [loading, church]);

  const submitJoin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/public/church/${slug}/join`, form);
      setJoined(true);
      toast.success('Request sent — the church will welcome you soon');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not send request';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="vp vp--center">
        <Spinner />
      </div>
    );
  }

  if (!church) {
    return (
      <div className="vp vp--center">
        <h1>Church not found</h1>
        <Link to="/login">Sign in</Link>
      </div>
    );
  }

  const aboutText =
    church.visit_welcome ||
    church.description ||
    'We are a family of faith — a place to belong, grow, and find purpose together. Come as you are.';

  const locationLine = [church.city, church.region].filter(Boolean).join(', ');
  const addressLine =
    church.address ||
    ([church.city, church.region].filter(Boolean).join(', ') || 'Accra, Ghana');

  return (
    <div className="vp">
      {/* Sticky header — appears after hero (same feel as market header) */}
      <header
        className={`vp-topbar${headerVisible ? ' vp-topbar--visible' : ''}`}
        aria-hidden={!headerVisible}
      >
        <div className="vp-topbar-inner">
          <Link to="/visit" className="vp-topbar-brand">
            {logo ? (
              <img src={logo} alt="" className="vp-topbar-logo" />
            ) : (
              <div className="vp-topbar-logo vp-topbar-logo--fallback" aria-hidden>
                <Church size={18} />
              </div>
            )}
            <span className="vp-topbar-name">
              {church.name || 'ChristNerve Church'}
            </span>
          </Link>

          <nav className="vp-topbar-nav" aria-label="Visit page">
            <a href="#welcome" className="vp-topbar-link">
              Welcome
            </a>
            <a href="#events" className="vp-topbar-link">
              Events
            </a>
            <a href="#join" className="vp-topbar-link vp-topbar-link--join">
              Join
            </a>
            <Link to="/market" className="vp-topbar-link vp-topbar-link--market">
              <Store size={15} />
              Marketplace
            </Link>
          </nav>

          <div className="vp-topbar-actions">
            <Link to="/market" className="vp-topbar-icon" aria-label="Marketplace">
              <Store size={18} />
            </Link>
            <a href="#join" className="vp-topbar-cta">
              Join
            </a>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <header className="vp-hero" ref={heroRef}>
        <div className="vp-hero-bg" aria-hidden>
          <img src={heroImg} alt="" />
        </div>
        <div className="vp-hero-overlay" />
        <div className="vp-hero-inner">
          <span className="vp-invite-pill">✦ You&apos;re invited</span>
          <h1>{church.name || 'ChristNerve Church'}</h1>
          <p className="vp-tagline">
            {church.tagline || 'The Nerve System of Your Church'}
          </p>
          {(locationLine || church.denomination) && (
            <p className="vp-loc">
              <MapPin size={14} />
              <span>
                {[locationLine, church.denomination].filter(Boolean).join(' · ')}
              </span>
            </p>
          )}
          <div className="vp-hero-ctas">
            <a href="#join" className="vp-btn vp-btn--join">
              <HeartHandshake size={18} />
              Join This Church
            </a>
            <div className="vp-hero-ctas-secondary">
              {hasVideo ? (
                <a href="#watch" className="vp-btn vp-btn--outline">
                  <Play size={16} />
                  Watch a message
                </a>
              ) : (
                <a href="#events" className="vp-btn vp-btn--outline">
                  View Upcoming Events
                </a>
              )}
              <Link to="/market" className="vp-btn vp-btn--ghost">
                Browse Marketplace
              </Link>
            </div>
          </div>
          <p className="vp-hero-hint">
            New here? Tap <strong>Join This Church</strong> — we&apos;ll welcome
            you personally.
          </p>
        </div>
        <a href="#welcome" className="vp-scroll" aria-label="Scroll down">
          <ChevronDown size={22} />
        </a>
      </header>

      {/* ─── WELCOME STRIP ─── */}
      <section className="vp-welcome vp-reveal" id="welcome">
        <div className="vp-welcome-inner">
          <p className="vp-welcome-kicker">A place to belong</p>
          <h2>Everyone is welcome here.</h2>
          <div className="vp-welcome-rule" aria-hidden />
          <p className="vp-welcome-body">
            We are a community of believers who support, uplift and grow
            together. Come as you are.
          </p>
          <a href="#join" className="vp-btn vp-btn--join-light">
            <HeartHandshake size={18} />
            Join This Church
          </a>
        </div>
      </section>

      {/* ─── ABOUT ─── */}
      <section className="vp-about vp-reveal">
        <div className="vp-about-inner">
          <div className="vp-about-copy">
            <p className="vp-label">About us</p>
            <h2>More than a church.</h2>
            <p className="vp-body">{aboutText}</p>
            {church.description &&
              church.visit_welcome &&
              church.description !== church.visit_welcome && (
                <p className="vp-body vp-body--soft">{church.description}</p>
              )}

            <ul className="vp-info">
              {addressLine && (
                <li>
                  <span className="vp-info-icon">
                    <MapPin size={16} />
                  </span>
                  <span>{addressLine}</span>
                </li>
              )}
              {church.phone && (
                <li>
                  <span className="vp-info-icon">
                    <Phone size={16} />
                  </span>
                  <a href={`tel:${church.phone}`}>{church.phone}</a>
                </li>
              )}
              {church.email && (
                <li>
                  <span className="vp-info-icon">
                    <Mail size={16} />
                  </span>
                  <a href={`mailto:${church.email}`}>{church.email}</a>
                </li>
              )}
            </ul>

            {wa && (
              <a
                className="vp-btn vp-btn--wa"
                href={wa}
                target="_blank"
                rel="noreferrer"
              >
                Message us on WhatsApp
              </a>
            )}
          </div>
          <div className="vp-about-media">
            <img src={ABOUT_IMG} alt="" />
          </div>
        </div>
      </section>

      {hasVideo && (
        <section className="vp-watch vp-reveal" id="watch">
          <div className="vp-watch-inner">
            <p className="vp-label">Watch</p>
            <h2>
              {embeds.length > 1
                ? 'Messages from our church'
                : 'A word from our church'}
            </h2>
            <p className="vp-watch-sub">
              Play and feel the heart of {church.name}.
            </p>
            <div
              className={`vp-video-grid${embeds.length === 1 ? ' vp-video-grid--one' : ''}`}
            >
              {embeds.map((src, i) => (
                <div key={src} className="vp-video">
                  <iframe
                    src={src}
                    title={`${church.name} video ${i + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="vp-gallery vp-reveal" id="gallery">
          <div className="vp-gallery-inner">
            <p className="vp-label">Life together</p>
            <h2>Moments from our church</h2>
            <div className="vp-gallery-grid">
              {gallery.map((g) => (
                <figure key={g.id} className="vp-gallery-item">
                  <img
                    src={resolveMediaUrl(g.image_url)}
                    alt={g.caption || ''}
                    loading="lazy"
                  />
                  {g.caption ? <figcaption>{g.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── EVENTS ─── */}
      <section className="vp-events vp-reveal" id="events">
        <div className="vp-events-inner">
          <h2>Join Us This Week</h2>
          {events.length === 0 ? (
            <p className="vp-empty">
              New gatherings are coming soon — join us and we&apos;ll keep you
              posted.
            </p>
          ) : (
            <div className="vp-event-grid">
              {events.slice(0, 6).map((ev) => {
                const d = ev.start_datetime
                  ? new Date(ev.start_datetime)
                  : null;
                return (
                  <article key={ev.id} className="vp-event-card">
                    <div className="vp-event-date">
                      <strong>{d ? d.getDate() : '—'}</strong>
                      <span>
                        {d
                          ? d.toLocaleDateString('en-GH', { month: 'short' })
                          : ''}
                      </span>
                    </div>
                    <div className="vp-event-body">
                      <h3>{ev.title}</h3>
                      <p>
                        {d
                          ? d.toLocaleTimeString('en-GH', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : ''}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </p>
                      {ev.event_type && (
                        <span className="vp-type">{ev.event_type}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="vp-events-cta">
            <a href="#join" className="vp-btn vp-btn--join vp-btn--join-dark">
              <HeartHandshake size={18} />
              Join This Church
            </a>
          </div>
        </div>
      </section>

      {/* ─── JOIN FORM ─── */}
      <section className="vp-join vp-reveal" id="join">
        <div className="vp-join-card">
          <div className="vp-join-icon">
            <Church size={22} />
          </div>
          <h2>Ready to Belong?</h2>
          <p className="vp-join-sub">
            Fill this short form to join {church.name} — our team will welcome
            you personally.
          </p>

          {joined ? (
            <div className="vp-join-done">
              <strong>You&apos;re on the list.</strong>
              <p>
                Thank you. A member of {church.name} will reach out soon to
                welcome you.
              </p>
            </div>
          ) : (
            <form className="vp-form" onSubmit={submitJoin}>
              <div className="vp-form-row">
                <label>
                  First name
                  <input
                    required
                    value={form.first_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, first_name: e.target.value }))
                    }
                    placeholder="Akosua"
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    value={form.last_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, last_name: e.target.value }))
                    }
                    placeholder="Mensah"
                  />
                </label>
              </div>
              <label>
                Phone
                <input
                  required
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+233 24 412 3456 or any number"
                />
              </label>
              <label>
                WhatsApp <span>(optional)</span>
                <input
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsapp: e.target.value }))
                  }
                  placeholder="Same as phone is fine"
                />
              </label>
              <label>
                Email <span>(optional)</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="you@email.com"
                />
              </label>
              <label>
                City
                <input
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                  placeholder="Accra"
                />
              </label>
              <label>
                Anything you&apos;d like us to know?
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, note: e.target.value }))
                  }
                  placeholder="How you found us, prayer needs, family…"
                />
              </label>
              <button
                type="submit"
                className="vp-btn vp-btn--submit"
                disabled={submitting}
              >
                {submitting ? 'Sending…' : 'Join This Church'}
              </button>
            </form>
          )}

          {wa && !joined && (
            <div className="vp-join-alt">
              <p>Or message us directly</p>
              <a
                className="vp-btn vp-btn--wa-outline"
                href={wa}
                target="_blank"
                rel="noreferrer"
              >
                Chat on WhatsApp
              </a>
            </div>
          )}

          <p className="vp-privacy">
            Your information is only shared with the church admin.
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="vp-footer">
        <div className="vp-footer-brand">
          {logo ? (
            <img src={logo} alt="" />
          ) : (
            <Church size={18} />
          )}
          <span>Powered by ChristNerve</span>
        </div>
        <div className="vp-footer-links">
          <Link to="/market" className="vp-footer-login">
            Back to Marketplace
          </Link>
          <Link to="/login" className="vp-footer-login">
            Member / Staff Sign In
          </Link>
        </div>
      </footer>

      <style>{`
        .vp {
          min-height: 100dvh;
          background: #fff;
          color: #1a1625;
          font-family: var(--font-body, 'Inter', sans-serif);
          scroll-padding-top: calc(64px + env(safe-area-inset-top, 0px));
        }
        html:has(.vp) {
          scroll-behavior: smooth;
        }
        .vp--center {
          display: grid;
          place-items: center;
          min-height: 100dvh;
          gap: 12px;
          padding: 40px;
        }
        .vp a { color: inherit; }

        /* Sticky header — slides in after hero (market-style) */
        .vp-topbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 200;
          height: calc(56px + env(safe-area-inset-top, 0px));
          padding-top: env(safe-area-inset-top, 0px);
          box-sizing: border-box;
          background: rgba(255, 255, 255, 0.94);
          border-bottom: 1px solid rgba(232, 228, 220, 0.95);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transform: translateY(-110%);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition:
            transform 0.42s cubic-bezier(0.22, 1, 0.36, 1),
            opacity 0.32s ease,
            visibility 0.32s;
          box-shadow: 0 8px 28px rgba(20, 16, 12, 0.08);
        }
        .vp-topbar--visible {
          transform: translateY(0);
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }
        .vp-topbar-inner {
          max-width: 1100px;
          margin: 0 auto;
          height: 56px;
          padding: 0 16px;
          padding-left: max(16px, env(safe-area-inset-left, 0px));
          padding-right: max(16px, env(safe-area-inset-right, 0px));
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 12px;
        }
        .vp-topbar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          text-decoration: none;
          color: #1a1625;
        }
        .vp-topbar-logo {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          object-fit: contain;
          background: #fff;
          flex-shrink: 0;
          border: 1px solid rgba(232, 228, 220, 0.9);
        }
        .vp-topbar-logo--fallback {
          display: grid;
          place-items: center;
          background: #f4f0e8;
          color: #2d1b69;
        }
        .vp-topbar-name {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 17px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vp-topbar-nav {
          display: none;
          align-items: center;
          gap: 4px;
        }
        .vp-topbar-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          color: #6b6560;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .vp-topbar-link:hover {
          background: #f4f0e8;
          color: #1a1625;
        }
        .vp-topbar-link--join {
          color: #2d1b69;
          font-weight: 600;
        }
        .vp-topbar-link--market {
          background: #f4f0e8;
          color: #1a1625;
        }
        .vp-topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
        }
        .vp-topbar-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #f4f0e8;
          color: #1a1625;
          text-decoration: none;
        }
        .vp-topbar-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          background: #c4a035;
          color: #1a1625 !important;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          letter-spacing: 0.02em;
        }
        .vp-topbar-cta:hover {
          filter: brightness(1.05);
        }
        @media (min-width: 860px) {
          .vp-topbar-inner {
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          }
          .vp-topbar-nav { display: flex; }
          .vp-topbar-icon { display: none; }
          .vp-topbar-actions { justify-self: end; }
        }

        /* Hero */
        .vp-hero {
          position: relative;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          text-align: center;
          padding: 96px 24px 110px;
          overflow: hidden;
        }
        .vp-hero-bg {
          position: absolute;
          inset: -20px;
          z-index: 0;
        }
        .vp-hero-bg img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: blur(4px) saturate(1.05);
          transform: scale(1.06);
        }
        .vp-hero-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(180deg, rgba(8,6,14,0.55) 0%, rgba(8,6,14,0.62) 45%, rgba(8,6,14,0.78) 100%);
        }
        .vp-hero-inner {
          position: relative;
          z-index: 2;
          max-width: 720px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .vp-invite-pill {
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(8px);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          margin-bottom: 24px;
          color: #ffffff;
          text-shadow: 0 1px 8px rgba(0,0,0,0.35);
        }
        .vp-hero h1 {
          margin: 0;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(40px, 8vw, 64px);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.02em;
          color: #ffffff !important;
          text-shadow: 0 4px 28px rgba(0,0,0,0.45);
          max-width: 16ch;
        }
        .vp-tagline {
          margin: 16px auto 0;
          max-width: 34ch;
          font-size: clamp(16px, 2.4vw, 18px);
          color: rgba(255, 255, 255, 0.92);
          opacity: 1;
          line-height: 1.55;
          text-shadow: 0 2px 16px rgba(0,0,0,0.4);
        }
        .vp-loc {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 18px 0 0;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16);
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
          max-width: 100%;
        }
        .vp-loc span {
          text-align: left;
          line-height: 1.35;
        }
        .vp-hero-ctas {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-top: 34px;
          width: 100%;
          max-width: 420px;
        }
        .vp-hero-ctas-secondary {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          width: 100%;
        }
        .vp-hero-ctas .vp-btn--join {
          width: 100%;
          max-width: 360px;
        }
        .vp-hero-ctas-secondary .vp-btn {
          flex: 1 1 160px;
        }
        .vp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 0 22px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
        }
        .vp-btn:hover { transform: translateY(-1px); }
        .vp-btn--solid {
          background: #fff;
          color: #16131c;
        }
        .vp-btn--join {
          background: linear-gradient(180deg, #d4b24a 0%, #c4a035 100%);
          color: #1a1814;
          border: 1px solid rgba(255, 230, 160, 0.4);
          min-height: 56px;
          padding: 0 28px;
          font-size: 16px;
          font-weight: 700;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
          gap: 10px;
        }
        .vp-btn--join:hover {
          filter: brightness(1.05);
        }
        .vp-btn--join-light {
          margin-top: 28px;
          background: linear-gradient(180deg, #d4b24a 0%, #c4a035 100%);
          color: #1a1814;
          border: 1px solid rgba(255, 230, 160, 0.35);
          min-height: 52px;
          padding: 0 28px;
          font-size: 15px;
          font-weight: 700;
          gap: 8px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
        }
        .vp-btn--join-light:hover {
          filter: brightness(1.06);
        }
        .vp-btn--ghost {
          background: transparent;
          color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.28);
          min-height: 44px;
          font-size: 13px;
        }
        .vp-hero-hint {
          margin: 22px auto 0;
          max-width: 34ch;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.82);
          line-height: 1.5;
        }
        .vp-hero-hint strong {
          color: #f0d78c;
          font-weight: 700;
        }
        .vp-btn--outline {
          background: transparent;
          color: #fff;
          border: 1.5px solid rgba(255,255,255,0.65);
        }
        .vp-btn--outline:hover {
          background: rgba(255,255,255,0.1);
        }
        .vp-btn--accent,
        .vp-btn--submit {
          background: var(--accent, #2D1B69);
          color: #fff;
          width: 100%;
          min-height: 52px;
          border-radius: 12px;
          font-size: 15px;
        }
        .vp-btn--submit:disabled { opacity: 0.7; cursor: wait; }
        .vp-btn--wa {
          margin-top: 8px;
          background: #25D366;
          color: #fff;
          border-radius: 12px;
        }
        .vp-btn--wa-outline {
          border: 1.5px solid #25D366;
          color: #128C7E;
          background: transparent;
          border-radius: 12px;
          width: 100%;
        }
        .vp-scroll {
          position: absolute;
          left: 50%;
          bottom: 28px;
          transform: translateX(-50%);
          z-index: 1;
          color: rgba(255,255,255,0.75);
          animation: vpBounce 1.8s ease-in-out infinite;
        }
        @keyframes vpBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.7; }
          50% { transform: translateX(-50%) translateY(8px); opacity: 1; }
        }

        /* Welcome strip */
        .vp-welcome {
          background:
            radial-gradient(ellipse 70% 80% at 10% 20%, rgba(196, 160, 53, 0.14), transparent 55%),
            radial-gradient(ellipse 60% 70% at 90% 80%, rgba(196, 160, 53, 0.1), transparent 50%),
            linear-gradient(160deg, #3a3a3c 0%, #2a2a2c 45%, #1f1f21 100%);
          color: #fff;
          text-align: center;
          padding: 88px 24px;
          position: relative;
          overflow: hidden;
        }
        .vp-welcome::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #c4a035, transparent);
        }
        .vp-welcome::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(196, 160, 53, 0.55), transparent);
        }
        .vp-welcome-inner {
          position: relative;
          z-index: 1;
          max-width: 640px;
          margin: 0 auto;
        }
        .vp-welcome-kicker {
          margin: 0 0 16px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #c4a035;
        }
        .vp-welcome h2 {
          margin: 0;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(32px, 5.5vw, 42px);
          font-weight: 600;
          line-height: 1.15;
          color: #ffffff !important;
        }
        .vp-welcome-rule {
          width: 56px;
          height: 2px;
          margin: 20px auto;
          background: linear-gradient(90deg, transparent, #c4a035, transparent);
          border-radius: 2px;
        }
        .vp-welcome-body {
          margin: 0 auto;
          max-width: 40ch;
          font-size: 16px;
          line-height: 1.75;
          color: rgba(255, 255, 255, 0.78);
        }

        /* Watch / YouTube */
        .vp-watch {
          background: #fff;
          padding: 88px 24px;
        }
        .vp-watch-inner {
          max-width: 920px;
          margin: 0 auto;
          text-align: center;
        }
        .vp-watch h2 {
          margin: 0 0 10px;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(32px, 5vw, 40px);
          font-weight: 600;
        }
        .vp-watch-sub {
          margin: 0 auto 28px;
          max-width: 40ch;
          font-size: 15px;
          color: var(--text-muted, #9e9893);
          line-height: 1.5;
        }
        .vp-video {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          border-radius: var(--radius-lg, 20px);
          background: #0f0d14;
          box-shadow: 0 24px 60px rgba(15, 13, 20, 0.16);
          border: 1px solid rgba(45, 27, 105, 0.12);
        }
        .vp-video iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .vp-video-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          text-align: left;
        }
        .vp-video-grid--one {
          grid-template-columns: 1fr;
          max-width: 820px;
          margin: 0 auto;
        }

        .vp-gallery {
          background: var(--bg-secondary, #F8F7F5);
          padding: 88px 24px;
        }
        .vp-gallery-inner {
          max-width: 1080px;
          margin: 0 auto;
          text-align: center;
        }
        .vp-gallery h2 {
          margin: 0 0 28px;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(32px, 5vw, 40px);
          font-weight: 600;
        }
        .vp-gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 14px;
        }
        .vp-gallery-item {
          margin: 0;
          border-radius: 16px;
          overflow: hidden;
          background: #fff;
          border: 1px solid var(--border, #e8e4dc);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .vp-gallery-item:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 36px rgba(15,13,20,0.1);
        }
        .vp-gallery-item img {
          width: 100%;
          aspect-ratio: 4/3;
          object-fit: cover;
          display: block;
        }
        .vp-gallery-item figcaption {
          padding: 10px 12px;
          font-size: 12px;
          color: var(--text-muted, #9e9893);
          text-align: left;
        }

        .vp-reveal {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .vp-reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* About */
        .vp-about {
          background: var(--bg-secondary, #F8F7F5);
          padding: 88px 24px;
        }
        .vp-about-inner {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 48px;
          align-items: center;
        }
        .vp-label {
          margin: 0 0 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-muted, #9e9893);
        }
        .vp-about-copy h2 {
          margin: 0 0 18px;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(32px, 5vw, 40px);
          font-weight: 600;
          line-height: 1.15;
        }
        .vp-body {
          margin: 0;
          font-size: 16px;
          line-height: 1.7;
          color: #4a4554;
        }
        .vp-body--soft { margin-top: 14px; opacity: 0.9; }
        .vp-info {
          list-style: none;
          margin: 28px 0 20px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .vp-info li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 15px;
          color: #2f2a38;
        }
        .vp-info a {
          text-decoration: none;
          color: inherit;
        }
        .vp-info a:hover { color: var(--accent, #2D1B69); }
        .vp-info-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--accent-light, #EDE8FA);
          color: var(--accent, #2D1B69);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .vp-about-media img {
          width: 100%;
          height: 420px;
          object-fit: cover;
          border-radius: var(--radius-lg, 20px);
          display: block;
          box-shadow: 0 24px 60px rgba(15, 13, 20, 0.12);
        }

        /* Events */
        .vp-events {
          background: #fff;
          padding: 88px 24px;
        }
        .vp-events-inner {
          max-width: 920px;
          margin: 0 auto;
        }
        .vp-events h2 {
          margin: 0 0 36px;
          text-align: center;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(32px, 5vw, 40px);
          font-weight: 600;
        }
        .vp-empty {
          text-align: center;
          color: var(--text-muted, #9e9893);
          font-size: 15px;
          max-width: 36ch;
          margin: 0 auto;
        }
        .vp-event-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .vp-event-card {
          display: flex;
          gap: 16px;
          align-items: stretch;
          padding: 16px;
          border: 1px solid var(--border, #e8e4dc);
          border-radius: var(--radius-md, 12px);
          background: #fff;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .vp-event-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(15, 13, 20, 0.08);
        }
        .vp-event-date {
          width: 64px;
          flex-shrink: 0;
          border-radius: 12px;
          background: var(--accent, #2D1B69);
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 10px 6px;
        }
        .vp-event-date strong {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          line-height: 1;
          font-weight: 700;
        }
        .vp-event-date span {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.85;
        }
        .vp-event-body h3 {
          margin: 0 0 6px;
          font-size: 16px;
          font-weight: 700;
          line-height: 1.3;
        }
        .vp-event-body p {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted, #9e9893);
        }
        .vp-type {
          display: inline-block;
          margin-top: 10px;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--accent-light, #EDE8FA);
          color: var(--accent, #2D1B69);
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .vp-events-cta {
          display: flex;
          justify-content: center;
          margin-top: 36px;
        }
        .vp-btn--join-dark {
          color: #1a1814;
          width: auto;
          min-width: 240px;
          border-radius: 999px;
        }
        .vp-events-cta .vp-btn {
          width: auto;
          min-width: 240px;
          border-radius: 999px;
        }

        /* Join */
        .vp-join {
          background: var(--bg-dark, #0F0D0A);
          padding: 88px 20px;
        }
        .vp-join-card {
          max-width: 560px;
          margin: 0 auto;
          background: #fff;
          border-radius: var(--radius-lg, 20px);
          padding: 48px 40px;
          text-align: center;
        }
        .vp-join-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 18px;
          border-radius: 50%;
          background: var(--accent-light, #EDE8FA);
          color: var(--accent, #2D1B69);
          display: grid;
          place-items: center;
        }
        .vp-join-card h2 {
          margin: 0;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(30px, 5vw, 36px);
          font-weight: 600;
        }
        .vp-join-sub {
          margin: 10px auto 28px;
          max-width: 34ch;
          font-size: 15px;
          color: var(--text-muted, #9e9893);
          line-height: 1.5;
        }
        .vp-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          text-align: left;
        }
        .vp-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .vp-form label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #2f2a38;
        }
        .vp-form label span {
          font-weight: 500;
          color: var(--text-muted, #9e9893);
          font-size: 12px;
        }
        .vp-form input,
        .vp-form textarea {
          width: 100%;
          min-height: 48px;
          padding: 12px 14px;
          border: 1.5px solid var(--border, #e8e4dc);
          border-radius: 10px;
          font-family: inherit;
          font-size: 15px;
          background: #fff;
          color: #1a1625;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
        }
        .vp-form textarea { min-height: 96px; resize: vertical; }
        .vp-form input:focus,
        .vp-form textarea:focus {
          outline: none;
          border-color: var(--accent, #2D1B69);
          box-shadow: 0 0 0 3px rgba(45, 27, 105, 0.12);
        }
        .vp-join-done {
          padding: 24px;
          border-radius: 14px;
          background: #f3faf5;
          border: 1px solid #cfe8d7;
          color: #1f6b43;
          text-align: left;
        }
        .vp-join-done strong { display: block; margin-bottom: 6px; font-size: 17px; }
        .vp-join-done p { margin: 0; font-size: 14px; line-height: 1.5; }
        .vp-join-alt {
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid var(--border, #e8e4dc);
        }
        .vp-join-alt p {
          margin: 0 0 10px;
          font-size: 13px;
          color: var(--text-muted, #9e9893);
        }
        .vp-privacy {
          margin: 22px 0 0;
          font-size: 12px;
          color: var(--text-muted, #9e9893);
        }

        /* Footer */
        .vp-footer {
          background: var(--bg-dark, #0F0D0A);
          color: rgba(255,255,255,0.55);
          padding: 28px 24px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .vp-footer-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
        }
        .vp-footer-brand img {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          object-fit: cover;
        }
        .vp-footer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          justify-content: center;
          align-items: center;
        }
        .vp-footer-login {
          font-size: 13px;
          color: rgba(255,255,255,0.75);
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.25);
          padding-bottom: 1px;
          transition: color 0.2s ease;
        }
        .vp-footer-login:hover { color: #fff; }

        html { scroll-behavior: smooth; }
        .vp {
          scroll-behavior: smooth;
        }

        @media (max-width: 860px) {
          .vp-about-inner { grid-template-columns: 1fr; gap: 32px; }
          .vp-about-media { order: -1; }
          .vp-about-media img { height: 280px; }
          .vp-event-grid { grid-template-columns: 1fr; }
          .vp-video-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .vp-hero { padding: 80px 18px 96px; }
          .vp-hero-ctas-secondary { flex-direction: column; }
          .vp-hero-ctas-secondary .vp-btn { width: 100%; flex: none; }
          .vp-btn { width: 100%; }
          .vp-welcome, .vp-about, .vp-events, .vp-join, .vp-watch, .vp-gallery {
            padding: 64px 18px;
          }
          .vp-join-card { padding: 36px 20px; }
          .vp-form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
