import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { churchDomainUrl, churchHostLabel } from '../../utils/tenantHost';
import { useSuperAdmin } from './SuperAdminLayout';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set([
  'christnerve',
  'app',
  'www',
  'api',
  'admin',
  'market',
  'shop',
]);

const GH_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Central',
  'Eastern',
  'Northern',
  'Volta',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
  'Western North',
  'Oti',
  'North East',
  'Savannah',
];

const DENOMINATIONS = [
  'Church of Pentecost',
  'Methodist',
  'Presbyterian',
  'Catholic',
  'Assemblies of God',
  'Baptist',
  'Charismatic',
  'Interdenominational',
  'Other',
];

interface ChurchForm {
  name: string;
  slug: string;
  tagline: string;
  denomination: string;
  city: string;
  region: string;
  phone: string;
  email: string;
  address: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
  admin_password: string;
  admin_role: 'pastor' | 'admin' | 'finance' | 'secretary';
}

const EMPTY: ChurchForm = {
  name: '',
  slug: '',
  tagline: '',
  denomination: '',
  city: '',
  region: '',
  phone: '',
  email: '',
  address: '',
  admin_first_name: '',
  admin_last_name: '',
  admin_email: '',
  admin_password: '',
  admin_role: 'pastor',
};

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error || fallback
  );
}

export default function SuperAdminCreateChurch() {
  const navigate = useNavigate();
  const { refresh } = useSuperAdmin();
  const [form, setForm] = useState<ChurchForm>(EMPTY);
  const [slugManual, setSlugManual] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ChurchForm, string>>>({});
  const [creating, setCreating] = useState(false);
  const [createdSlug, setCreatedSlug] = useState('');

  const slugPreview = useMemo(
    () => form.slug.trim() || 'your-church',
    [form.slug]
  );

  const update = <K extends keyof ChurchForm>(key: K, value: ChurchForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !slugManual) {
        next.slug = toSlug(String(value));
      }
      return next;
    });
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof ChurchForm, string>> = {};
    if (!form.name.trim()) next.name = 'Church name is required';
    const slug = form.slug.trim();
    if (!slug) next.slug = 'Domain slug is required';
    else if (!SLUG_PATTERN.test(slug) || slug.length < 2) {
      next.slug = 'Use lowercase letters, numbers, and hyphens';
    } else if (RESERVED.has(slug)) next.slug = 'This domain slug is reserved';

    if (!form.admin_email.trim()) next.admin_email = 'Admin email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email.trim())) {
      next.admin_email = 'Enter a valid email';
    }
    if (!form.admin_password) next.admin_password = 'Password is required';
    else if (form.admin_password.length < 6) {
      next.admin_password = 'At least 6 characters';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/superadmin/churches', {
        name: form.name.trim(),
        slug: form.slug.trim(),
        tagline: form.tagline.trim() || undefined,
        denomination: form.denomination.trim() || undefined,
        city: form.city.trim() || undefined,
        region: form.region.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        admin_first_name: form.admin_first_name.trim() || 'Pastor',
        admin_last_name: form.admin_last_name.trim() || 'Admin',
        admin_email: form.admin_email.trim(),
        admin_password: form.admin_password,
        admin_role: form.admin_role,
      });
      const slug = (res.data?.slug as string) || form.slug.trim();
      setCreatedSlug(slug);
      toast.success(`Church created — ${churchHostLabel(slug)}`);
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to create church'));
    } finally {
      setCreating(false);
    }
  };

  if (createdSlug) {
    return (
      <div className="sa-view sa-create-success">
        <div className="sa-success-card">
          <div className="sa-success-icon">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="sa-section-title">{form.name || 'Church'} is live</h2>
          <p className="sa-section-sub">
            The pastor can sign in on the church domain with the admin email you set.
          </p>

          <div className="sa-success-domain">
            <span className="sa-success-domain-label">Production</span>
            <span className="sa-mono">{churchHostLabel(createdSlug)}</span>
          </div>
          <div className="sa-success-domain">
            <span className="sa-success-domain-label">Local</span>
            <span className="sa-mono">localhost:5174?church={createdSlug}</span>
          </div>

          <div className="sa-success-actions">
            <a
              className="btn btn-primary sa-gold-btn"
              href={churchDomainUrl(createdSlug, '/login')}
            >
              Open church login
              <ExternalLink size={16} />
            </a>
            <Link to="/admin/churches" className="btn btn-outline">
              Back to churches
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-view">
      <div className="sa-toolbar">
        <div>
          <Link to="/admin/churches" className="sa-back">
            <ArrowLeft size={16} />
            Churches
          </Link>
          <h2 className="sa-section-title" style={{ marginTop: 8 }}>
            Add Church
          </h2>
          <p className="sa-section-sub">
            Design the subdomain, church profile, and first pastor login.
          </p>
        </div>
      </div>

      <form className="sa-create-form" onSubmit={handleSubmit}>
        <section className="sa-panel">
          <h3 className="sa-panel-title">Church identity</h3>
          <p className="sa-panel-sub">
            This becomes the public face of the church on ChristNerve.
          </p>

          <div className="sa-form-grid">
            <div className="sa-field">
              <label className="label" htmlFor="church-name">Church name *</label>
              <input
                id="church-name"
                className={`input${errors.name ? ' input-error' : ''}`}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Peace Kingdom Assembly"
              />
              {errors.name && <span className="sa-error">{errors.name}</span>}
            </div>

            <div className="sa-field">
              <label className="label" htmlFor="church-slug">Domain slug *</label>
              <input
                id="church-slug"
                className={`input${errors.slug ? ' input-error' : ''}`}
                value={form.slug}
                onChange={(e) => {
                  setSlugManual(true);
                  update('slug', toSlug(e.target.value));
                }}
                placeholder="peace-kingdom"
              />
              {errors.slug ? (
                <span className="sa-error">{errors.slug}</span>
              ) : (
                <span className="sa-field-hint">Letters, numbers, hyphens only</span>
              )}
            </div>
          </div>

          <div className="sa-slug-preview">
            <p className="sa-slug-preview-label">Live domain preview</p>
            <div className="sa-slug-preview-rows">
              <code className="sa-slug-chip">
                <span className="sa-slug-chip-env">Prod</span>
                {churchHostLabel(slugPreview)}
              </code>
              <code className="sa-slug-chip">
                <span className="sa-slug-chip-env">Local</span>
                localhost:5174?church={slugPreview}
              </code>
            </div>
          </div>

          <div className="sa-form-grid">
            <div className="sa-field">
              <label className="label" htmlFor="tagline">Tagline</label>
              <input
                id="tagline"
                className="input"
                value={form.tagline}
                onChange={(e) => update('tagline', e.target.value)}
                placeholder="A church that believes in supporting one another"
              />
            </div>

            <div className="sa-field">
              <label className="label" htmlFor="denomination">Denomination</label>
              <select
                id="denomination"
                className="input sa-select"
                value={form.denomination}
                onChange={(e) => update('denomination', e.target.value)}
              >
                <option value="">Select denomination</option>
                {DENOMINATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="sa-field">
              <label className="label" htmlFor="city">City</label>
              <input
                id="city"
                className="input"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Kumasi"
              />
            </div>

            <div className="sa-field">
              <label className="label" htmlFor="region">Region</label>
              <select
                id="region"
                className="input sa-select"
                value={form.region}
                onChange={(e) => update('region', e.target.value)}
              >
                <option value="">Select region</option>
                {GH_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="sa-field">
              <label className="label" htmlFor="phone">Phone</label>
              <input
                id="phone"
                className="input"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="03220…"
              />
            </div>

            <div className="sa-field">
              <label className="label" htmlFor="email">Church email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="info@church.org"
              />
            </div>
          </div>

          <div className="sa-field">
            <label className="label" htmlFor="address">Address</label>
            <input
              id="address"
              className="input"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Street, suburb, city"
            />
          </div>
        </section>

        <section className="sa-panel">
          <h3 className="sa-panel-title">Pastor / admin account</h3>
          <p className="sa-panel-sub">
            This person signs in at{' '}
            <span className="sa-mono">localhost:5174/login?church={slugPreview}</span> to manage the church.
          </p>

          <div className="sa-form-grid">
            <div className="sa-field">
              <label className="label" htmlFor="admin-first">First name</label>
              <input
                id="admin-first"
                className="input"
                value={form.admin_first_name}
                onChange={(e) => update('admin_first_name', e.target.value)}
                placeholder="Kwame"
              />
            </div>
            <div className="sa-field">
              <label className="label" htmlFor="admin-last">Last name</label>
              <input
                id="admin-last"
                className="input"
                value={form.admin_last_name}
                onChange={(e) => update('admin_last_name', e.target.value)}
                placeholder="Mensah"
              />
            </div>
            <div className="sa-field">
              <label className="label" htmlFor="admin-email">Admin email *</label>
              <input
                id="admin-email"
                type="email"
                className={`input${errors.admin_email ? ' input-error' : ''}`}
                value={form.admin_email}
                onChange={(e) => update('admin_email', e.target.value)}
                placeholder="pastor@church.org"
              />
              {errors.admin_email && (
                <span className="sa-error">{errors.admin_email}</span>
              )}
            </div>
            <div className="sa-field">
              <label className="label" htmlFor="admin-password">Admin password *</label>
              <input
                id="admin-password"
                type="password"
                className={`input${errors.admin_password ? ' input-error' : ''}`}
                value={form.admin_password}
                onChange={(e) => update('admin_password', e.target.value)}
                placeholder="At least 6 characters"
              />
              {errors.admin_password && (
                <span className="sa-error">{errors.admin_password}</span>
              )}
            </div>
            <div className="sa-field">
              <label className="label" htmlFor="admin-role">Role</label>
              <select
                id="admin-role"
                className="input sa-select"
                value={form.admin_role}
                onChange={(e) =>
                  update(
                    'admin_role',
                    e.target.value as ChurchForm['admin_role']
                  )
                }
              >
                <option value="pastor">Pastor</option>
                <option value="admin">Admin</option>
                <option value="finance">Finance</option>
                <option value="secretary">Secretary</option>
              </select>
            </div>
          </div>
        </section>

        <div className="sa-create-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/admin/churches')}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary sa-gold-btn"
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create church account'}
          </button>
        </div>
      </form>
    </div>
  );
}
