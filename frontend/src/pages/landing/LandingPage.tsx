import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Users,
  Wallet,
  Store,
  ArrowRight,
  ImagePlus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { churchDomainUrl, goToChurchHost } from '../../utils/tenantHost';
import api from '../../services/api';
import { applyDefaultPWA } from '../../utils/applyTenantPWA';
import './LandingPage.css';

/** Demo tenant — ChristNerve Church (slug kept as `pka` for existing data). */
const DEMO_CHURCH_SLUG = 'pka';

function enterDemo(path = '/login') {
  goToChurchHost(DEMO_CHURCH_SLUG, path);
}

const MARKET_HOW = [
  {
    title: 'Members list what they sell',
    description:
      'A seamstress, phone repairer, or baker creates a listing with photos and price — right inside your church app.',
    image: '/landing/how-list.jpg',
  },
  {
    title: 'They share their storefront',
    description:
      'Each member gets a personal link they can send on WhatsApp or Facebook. Buyers open it and see real products.',
    image: '/landing/how-share.jpg',
  },
  {
    title: 'Buyers find the church',
    description:
      'People outside your congregation discover the church through trusted member businesses — growth without ads.',
    image: '/landing/how-buyers.jpg',
  },
  {
    title: 'Chat and close the deal',
    description:
      'Interested buyers message the seller in-app. Contact stays private until checkout — clean and safe.',
    image: '/landing/how-chat.jpg',
  },
];

const FEATURES = [
  {
    icon: Users,
    title: 'Member Management',
    description:
      'Complete member profiles, departments, attendance tracking, and records — all in one place.',
    image: '/landing/members.jpg',
    reverse: false,
  },
  {
    icon: Wallet,
    title: 'Finance & Giving',
    description:
      'Record tithes, offerings, and donations. Supports Mobile Money, cash, and bank transfers. Auto-generated receipts.',
    image: '/landing/finance.jpg',
    reverse: true,
  },
  {
    icon: Store,
    title: 'Member Marketplace',
    description:
      "Every member gets a personal storefront. They share it. Outsiders discover your church. Your community grows.",
    image: '/landing/market.jpg',
    reverse: false,
  },
];

const GH_REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Northern',
  'Volta', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo',
  'Western North', 'Oti', 'North East', 'Savannah',
];

const REGION_STORAGE_KEY = 'christnerve_custom_regions';

function loadCustomRegions(): string[] {
  try {
    const raw = localStorage.getItem(REGION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function saveCustomRegion(region: string) {
  const value = region.trim();
  if (!value) return;
  const existing = loadCustomRegions();
  if (
    GH_REGIONS.some((r) => r.toLowerCase() === value.toLowerCase()) ||
    existing.some((r) => r.toLowerCase() === value.toLowerCase())
  ) {
    return;
  }
  localStorage.setItem(
    REGION_STORAGE_KEY,
    JSON.stringify([value, ...existing].slice(0, 40))
  );
}

const RESERVED = new Set([
  'christnerve', 'app', 'www', 'api', 'admin', 'market', 'shop', 'localhost',
]);

function toSlug(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!base || RESERVED.has(base)) {
    return `church-${Date.now().toString(36).slice(-6)}`;
  }
  return base;
}

function getErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error || fallback
  );
}

const EMPTY_REG = {
  name: '',
  tagline: '',
  city: '',
  region: '',
  phone: '',
  email: '',
};

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reg, setReg] = useState(EMPTY_REG);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedName, setSubmittedName] = useState('');
  const [regionOptions, setRegionOptions] = useState<string[]>(() => [
    ...GH_REGIONS,
    ...loadCustomRegions(),
  ]);
  const [regionOpen, setRegionOpen] = useState(false);
  const regionWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyDefaultPWA();
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    root.classList.remove('theme-dark');
    root.classList.add('landing-light-lock');
    return () => {
      root.classList.remove('landing-light-lock');
      if (prev === 'dark' || prev === 'light') {
        root.setAttribute('data-theme', prev);
        root.classList.toggle('theme-dark', prev === 'dark');
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!regionWrapRef.current?.contains(e.target as Node)) {
        setRegionOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateReg = (key: keyof typeof EMPTY_REG, value: string) => {
    setReg((prev) => ({ ...prev, [key]: value }));
  };

  const filteredRegions = useMemo(() => {
    const q = reg.region.trim().toLowerCase();
    if (!q) return regionOptions;
    return regionOptions.filter((r) => r.toLowerCase().includes(q));
  }, [reg.region, regionOptions]);

  const rememberRegion = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveCustomRegion(trimmed);
    setRegionOptions((prev) => {
      if (prev.some((r) => r.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [trimmed, ...prev];
    });
  };

  const pickRegion = (value: string) => {
    updateReg('region', value);
    rememberRegion(value);
    setRegionOpen(false);
  };

  const onLogoPick = (file: File | null) => {
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setLogoFile(file);
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    const required: (keyof typeof EMPTY_REG)[] = [
      'name',
      'tagline',
      'city',
      'region',
      'phone',
      'email',
    ];
    for (const key of required) {
      if (!reg[key].trim()) {
        toast.error('Please fill in every field before submitting');
        return;
      }
    }

    rememberRegion(reg.region);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', reg.name.trim());
      fd.append('slug', toSlug(reg.name));
      fd.append('tagline', reg.tagline.trim());
      fd.append('city', reg.city.trim());
      fd.append('region', reg.region.trim());
      fd.append('phone', reg.phone.trim());
      fd.append('email', reg.email.trim());
      if (logoFile) fd.append('logo', logoFile);

      await api.post('/public/register-church', fd);
      setSubmittedName(reg.name.trim());
      toast.success('Registration submitted — awaiting review');
      setReg(EMPTY_REG);
      onLogoPick(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Could not submit registration'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-nav-left">
            <a href="#top" className="landing-logo" onClick={(e) => { e.preventDefault(); scrollTo('top'); }}>
              <BrandLogo size="md" />
            </a>
          </div>

          <ul className="landing-nav-links">
            <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
            <li><a href="#marketplace" onClick={(e) => { e.preventDefault(); scrollTo('marketplace'); }}>Marketplace</a></li>
            <li><a href="#register" onClick={(e) => { e.preventDefault(); scrollTo('register'); }}>Register</a></li>
            <li><a href="#contact" onClick={(e) => { e.preventDefault(); scrollTo('contact'); }}>Contact</a></li>
          </ul>

          <div className="landing-nav-right">
            <button
              type="button"
              className="landing-nav-cta landing-nav-cta--desktop"
              onClick={() => scrollTo('register')}
            >
              Register
            </button>

            <div className="landing-nav-actions-mobile">
              <button
                type="button"
                className="landing-nav-cta landing-nav-cta--compact"
                onClick={() => scrollTo('register')}
              >
                Register
              </button>
              <button
                type="button"
                className="landing-menu-btn"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                <span className="landing-menu-colon" aria-hidden>
                  :
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="landing-mobile-overlay">
          <div className="landing-mobile-overlay-header">
            <span className="landing-logo">
              <BrandLogo size="md" />
            </span>
            <button type="button" className="landing-menu-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <ul className="landing-mobile-links">
            <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
            <li><a href="#marketplace" onClick={(e) => { e.preventDefault(); scrollTo('marketplace'); }}>Marketplace</a></li>
            <li><a href="#register" onClick={(e) => { e.preventDefault(); scrollTo('register'); }}>Register</a></li>
            <li><a href="#contact" onClick={(e) => { e.preventDefault(); scrollTo('contact'); }}>Contact</a></li>
          </ul>
          <button
            type="button"
            className="landing-nav-cta"
            style={{ marginTop: 32, justifyContent: 'center', width: '100%' }}
            onClick={() => scrollTo('register')}
          >
            Register
          </button>
        </div>
      )}

      <section className="landing-hero" id="top">
        <div>
          <span className="landing-eyebrow">Church Management Platform</span>
          <h1 className="landing-headline">
            Your Church Deserves More Than a Spreadsheet.
          </h1>
          <p className="landing-subtext">
            ChristNerve brings your entire church together — members, finance, and a
            marketplace where your congregation&apos;s businesses thrive.
          </p>
          <div className="landing-cta-row">
            <button type="button" className="btn btn-primary" onClick={() => scrollTo('register')}>
              Register your church
              <ArrowRight size={16} />
            </button>
            <button type="button" className="btn btn-outline" onClick={() => enterDemo('/market')}>
              Explore Marketplace
            </button>
          </div>
          <div className="landing-trust">
            <span className="landing-trust-item"><Check size={14} /> Built for Ghana</span>
            <span className="landing-trust-item"><Check size={14} /> Mobile Money Accepted</span>
            <span className="landing-trust-item"><Check size={14} /> No per-member charges</span>
          </div>
        </div>

        <div className="landing-mockup-wrap">
          <div className="landing-device">
            <div className="landing-device-bar">
              <span className="landing-device-dot" />
              <span className="landing-device-dot" />
              <span className="landing-device-dot" />
            </div>
            <div className="landing-dash-mock">
              <div className="landing-dash-church">ChristNerve Church</div>
              <div className="landing-dash-stats">
                <div className="landing-dash-stat">
                  <span className="landing-dash-stat-label">Members</span>
                  <span className="landing-dash-stat-value">248</span>
                </div>
                <div className="landing-dash-stat">
                  <span className="landing-dash-stat-label">Attendance</span>
                  <span className="landing-dash-stat-value">186</span>
                </div>
                <div className="landing-dash-stat">
                  <span className="landing-dash-stat-label">Giving</span>
                  <span className="landing-dash-stat-value">GHS 12.4k</span>
                </div>
                <div className="landing-dash-stat">
                  <span className="landing-dash-stat-label">Listings</span>
                  <span className="landing-dash-stat-value">42</span>
                </div>
              </div>
              <div className="landing-dash-table">
                <div className="landing-dash-table-head">Recent giving</div>
                <div className="landing-dash-table-row">
                  <span>Ama Mensah</span>
                  <strong>Tithe</strong>
                  <span>GHS 200</span>
                </div>
                <div className="landing-dash-table-row">
                  <span>Kwesi Owusu</span>
                  <strong>Offering</strong>
                  <span>GHS 50</span>
                </div>
                <div className="landing-dash-table-row">
                  <span>Building Fund</span>
                  <strong>Gift</strong>
                  <span>GHS 500</span>
                </div>
              </div>
            </div>
          </div>
          <div className="landing-float-card">
            <div className="landing-float-avatar">AM</div>
            <p className="landing-float-text">
              <strong>Ama</strong> just recorded Sunday attendance
            </p>
          </div>
          <div className="landing-float-card landing-float-card--market">
            <div className="landing-float-avatar landing-float-avatar--gold">KA</div>
            <p className="landing-float-text">
              <strong>Kofi</strong> listed a new shop in the marketplace
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section" id="features">
        <h2 className="landing-section-title">Everything Your Church Needs</h2>
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className={`landing-feature-row${feature.reverse ? ' reverse' : ''}`}
            >
              <div>
                <div className="landing-feature-icon">
                  <Icon size={22} />
                </div>
                <h3 className="landing-feature-title">{feature.title}</h3>
                <p className="landing-feature-desc">{feature.description}</p>
              </div>
              <div className="landing-feature-visual">
                <img src={feature.image} alt="" loading="lazy" />
              </div>
            </div>
          );
        })}
      </section>

      <section className="landing-market-section" id="marketplace">
        <div className="landing-market-inner">
          <span className="landing-eyebrow">Marketplace</span>
          <h2 className="landing-section-title">How the marketplace works</h2>
          <p className="landing-market-lead">
            Your members sell what they already make or do. Shoppers discover them —
            and your church grows through real relationships, not ads.
          </p>
          <div className="landing-how-grid">
            {MARKET_HOW.map((step, i) => (
              <article key={step.title} className="landing-how-card">
                <div className="landing-how-media">
                  <img src={step.image} alt="" loading="lazy" />
                  <span className="landing-how-num">{i + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-register" id="register">
        <div className="landing-register-inner">
          <div className="landing-register-intro">
            <span className="landing-eyebrow">Get started</span>
            <h2 className="landing-section-title">Register your church</h2>
            <p>
              Share your church details for review. Logo is optional — everything else is required.
            </p>
          </div>

          {submittedName ? (
            <div className="landing-register-success">
              <Check size={28} />
              <h3>Registration received</h3>
              <p>
                <strong>{submittedName}</strong> is waiting for ChristNerve review.
                We&apos;ll contact you after approval.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSubmittedName('')}
              >
                Register another church
              </button>
            </div>
          ) : (
            <form className="landing-register-form" onSubmit={handleRegister}>
              <div className="landing-logo-picker">
                <div className="landing-logo-preview">
                  {logoPreview ? (
                    <img src={logoPreview} alt="" />
                  ) : (
                    <ImagePlus size={26} />
                  )}
                </div>
                <div>
                  <label className="label">Church logo (optional)</label>
                  <p className="landing-field-hint">
                    JPEG, PNG, or WebP. You can add this later if you prefer.
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => onLogoPick(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div className="landing-form-grid">
                <div>
                  <label className="label">Church name *</label>
                  <input
                    className="input"
                    value={reg.name}
                    onChange={(e) => updateReg('name', e.target.value)}
                    placeholder="Peace Kingdom Assembly"
                    required
                  />
                </div>
                <div>
                  <label className="label">Tagline *</label>
                  <input
                    className="input"
                    value={reg.tagline}
                    onChange={(e) => updateReg('tagline', e.target.value)}
                    placeholder="A church that believes in supporting one another"
                    required
                  />
                </div>
                <div>
                  <label className="label">City *</label>
                  <input
                    className="input"
                    value={reg.city}
                    onChange={(e) => updateReg('city', e.target.value)}
                    placeholder="Kumasi"
                    required
                  />
                </div>
                <div className="landing-region-field" ref={regionWrapRef}>
                  <label className="label">Region *</label>
                  <div className="landing-region-input-wrap">
                    <input
                      className="input"
                      value={reg.region}
                      onChange={(e) => {
                        updateReg('region', e.target.value);
                        setRegionOpen(true);
                      }}
                      onFocus={() => setRegionOpen(true)}
                      placeholder="Type or pick a region"
                      autoComplete="off"
                      required
                    />
                    {regionOpen && (
                      <ul className="landing-region-menu" role="listbox">
                        {filteredRegions.length === 0 ? (
                          <li className="landing-region-empty">
                            Keep typing to use “{reg.region.trim() || '…'}”
                          </li>
                        ) : (
                          filteredRegions.map((r) => (
                            <li key={r}>
                              <button
                                type="button"
                                className="landing-region-option"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pickRegion(r)}
                              >
                                {r}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  <p className="landing-field-hint">
                    Type to search — pick a suggestion or enter your own.
                  </p>
                </div>
                <div>
                  <label className="label">Church phone *</label>
                  <input
                    className="input"
                    value={reg.phone}
                    onChange={(e) => updateReg('phone', e.target.value)}
                    placeholder="0244 000 000"
                    required
                  />
                </div>
                <div>
                  <label className="label">Church email *</label>
                  <input
                    className="input"
                    type="email"
                    value={reg.email}
                    onChange={(e) => updateReg('email', e.target.value)}
                    placeholder="info@yourchurch.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary landing-register-submit"
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit for approval'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="landing-footer" id="contact">
        <div className="landing-footer-inner">
          <div>
            <div className="landing-footer-brand">
              <BrandLogo size="md" inverted />
            </div>
            <p className="landing-footer-tagline">The Nerve System of Your Church.</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', maxWidth: 360, marginTop: 12 }}>
              Demo church:{' '}
              <a href={churchDomainUrl(DEMO_CHURCH_SLUG, '/market')} style={{ color: 'var(--gold, #B8962E)' }}>
                ChristNerve Church
              </a>
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', maxWidth: 360, marginTop: 8 }}>
              Request a demo at{' '}
              <a href="mailto:hello@christnerve.com" style={{ color: '#fff' }}>
                hello@christnerve.com
              </a>
            </p>
          </div>
          <ul className="landing-footer-links">
            <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
            <li><a href="#marketplace" onClick={(e) => { e.preventDefault(); scrollTo('marketplace'); }}>Marketplace</a></li>
            <li><a href="#register" onClick={(e) => { e.preventDefault(); scrollTo('register'); }}>Register</a></li>
            <li><a href="mailto:hello@christnerve.com">Contact</a></li>
          </ul>
        </div>
        <p className="landing-footer-copy">
          © 2026 ChristNerve. Powered by ScholarNerve.
        </p>
      </footer>
    </div>
  );
}
