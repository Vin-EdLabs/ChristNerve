import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  List,
  Pencil,
  Plus,
  Search,
  ImagePlus,
  PauseCircle,
  PlayCircle,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { churchDomainUrl, churchHostLabel } from '../../utils/tenantHost';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { PageTabs } from '../../components/ui/PageTabs';
import { useSuperAdmin, type ChurchRow } from './SuperAdminLayout';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set([
  'christnerve', 'app', 'www', 'api', 'admin', 'market', 'shop',
]);

const GH_REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Northern',
  'Volta', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo',
  'Western North', 'Oti', 'North East', 'Savannah',
];

const DENOMINATIONS = [
  'Church of Pentecost', 'Methodist', 'Presbyterian', 'Catholic',
  'Assemblies of God', 'Baptist', 'Charismatic', 'Interdenominational', 'Other',
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
  name: '', slug: '', tagline: '', denomination: '', city: '', region: '',
  phone: '', email: '', address: '', admin_first_name: '', admin_last_name: '',
  admin_email: '', admin_password: '', admin_role: 'pastor',
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

type TabId = 'list' | 'add';

export default function SuperAdminChurches() {
  const { churches, refresh } = useSuperAdmin();
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'add' ? 'add' : 'list';

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState<ChurchForm>(EMPTY);
  const [slugManual, setSlugManual] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ChurchForm, string>>>({});
  const [creating, setCreating] = useState(false);
  const [createdSlug, setCreatedSlug] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [editing, setEditing] = useState<ChurchRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    tagline: '',
    denomination: '',
    city: '',
    region: '',
    phone: '',
    email: '',
    address: '',
    is_active: true,
    subscription_status: 'active',
    admin_name: '',
    admin_username: '',
    admin_password: '',
  });
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [editErrors, setEditErrors] = useState<Partial<Record<string, string>>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (tab !== 'add') {
      setCreatedSlug('');
      setForm(EMPTY);
      setSlugManual(false);
      setErrors({});
      setLogoFile(null);
      setLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [tab]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const setTab = (id: string) => {
    if (id === 'add') setParams({ tab: 'add' });
    else setParams({});
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return churches.filter((c) => {
      const pending =
        c.subscription_status === 'pending' ||
        c.subscription_status === 'approved';
      const active =
        c.is_active !== false &&
        c.subscription_status !== 'cancelled' &&
        c.subscription_status !== 'rejected' &&
        !pending;
      if (statusFilter === 'active' && !active) return false;
      if (statusFilter === 'inactive' && active) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q)
      );
    });
  }, [churches, query, statusFilter]);

  const slugPreview = form.slug.trim() || 'your-church';

  const update = <K extends keyof ChurchForm>(key: K, value: ChurchForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !slugManual) next.slug = toSlug(String(value));
      return next;
    });
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  const onLogoPick = (file: File | null) => {
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setLogoFile(file);
  };

  const onEditLogoPick = (file: File | null) => {
    setEditLogoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setEditLogoFile(file);
  };

  const openEdit = (c: ChurchRow) => {
    setEditing(c);
    const admin = c.primary_admin;
    const adminName = admin
      ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim()
      : '';
    setEditForm({
      name: c.name || '',
      slug: c.slug || '',
      tagline: c.tagline || '',
      denomination: c.denomination || '',
      city: c.city || '',
      region: c.region || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      is_active: c.is_active !== false,
      subscription_status: c.subscription_status || 'active',
      admin_name: adminName,
      admin_username: admin?.username || admin?.email || c.email || '',
      admin_password: '',
    });
    setEditErrors({});
    setEditLogoFile(null);
    setEditLogoPreview(resolveMediaUrl(c.logo_url));
  };

  const closeEdit = () => {
    setEditing(null);
    setEditLogoFile(null);
    setEditLogoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const updateEdit = (key: string, value: string | boolean) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
    setEditErrors((prev) => {
      if (!prev[key]) return prev;
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  const validateEdit = (): boolean => {
    const next: Partial<Record<string, string>> = {};
    if (!editForm.name.trim()) next.name = 'Church name is required';
    const slug = editForm.slug.trim();
    if (!slug) next.slug = 'Domain slug is required';
    else if (!SLUG_PATTERN.test(slug) || slug.length < 2) {
      next.slug = 'Use lowercase letters, numbers, and hyphens';
    } else if (RESERVED.has(slug)) next.slug = 'This domain slug is reserved';
    setEditErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !validateEdit()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/superadmin/churches/${editing.id}`, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        tagline: editForm.tagline.trim() || null,
        denomination: editForm.denomination.trim() || null,
        city: editForm.city.trim() || null,
        region: editForm.region.trim() || null,
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        address: editForm.address.trim() || null,
        is_active: editForm.is_active,
        subscription_status: editForm.subscription_status,
        admin_name: editForm.admin_name.trim() || undefined,
        admin_username: editForm.admin_username.trim() || undefined,
        admin_password: editForm.admin_password || undefined,
        admin_email: editForm.email.trim() || undefined,
      });
      if (editLogoFile) {
        const fd = new FormData();
        fd.append('logo', editLogoFile);
        await api.post(`/superadmin/churches/${editing.id}/logo`, fd);
      }
      toast.success(editForm.is_active ? 'Church updated' : 'Church suspended');
      closeEdit();
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update church'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async (c: ChurchRow) => {
    const nextActive = c.is_active === false;
    try {
      await api.put(`/superadmin/churches/${c.id}`, {
        is_active: nextActive,
        subscription_status: nextActive
          ? c.subscription_status === 'cancelled' || c.subscription_status === 'rejected'
            ? 'active'
            : c.subscription_status || 'active'
          : 'cancelled',
      });
      toast.success(nextActive ? 'Church activated' : 'Church suspended');
      await refresh();
      if (editing?.id === c.id) {
        setEditForm((prev) => ({
          ...prev,
          is_active: nextActive,
          subscription_status: nextActive ? 'active' : 'cancelled',
        }));
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    }
  };

  const handleDeleteChurch = async (c: ChurchRow) => {
    const ok = window.confirm(
      `Permanently delete “${c.name}” (${churchHostLabel(c.slug)})?\n\nThis removes the church, members, listings, events, and all related data. This cannot be undone.`
    );
    if (!ok) return;
    const typed = window.prompt(
      `Type the slug “${c.slug}” to confirm permanent deletion:`
    );
    if (typed?.trim().toLowerCase() !== c.slug.toLowerCase()) {
      toast.error('Slug did not match — church was not deleted');
      return;
    }
    try {
      await api.delete(`/superadmin/churches/${c.id}`);
      toast.success(`${c.name} deleted`);
      if (editing?.id === c.id) closeEdit();
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to delete church'));
    }
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
    else if (form.admin_password.length < 6) next.admin_password = 'At least 6 characters';
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
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('slug', form.slug.trim());
      if (form.tagline.trim()) fd.append('tagline', form.tagline.trim());
      if (form.denomination.trim()) fd.append('denomination', form.denomination.trim());
      if (form.city.trim()) fd.append('city', form.city.trim());
      if (form.region.trim()) fd.append('region', form.region.trim());
      if (form.phone.trim()) fd.append('phone', form.phone.trim());
      if (form.email.trim()) fd.append('email', form.email.trim());
      if (form.address.trim()) fd.append('address', form.address.trim());
      fd.append('admin_first_name', form.admin_first_name.trim() || 'Pastor');
      fd.append('admin_last_name', form.admin_last_name.trim() || 'Admin');
      fd.append('admin_email', form.admin_email.trim());
      fd.append('admin_password', form.admin_password);
      fd.append('admin_role', form.admin_role);
      if (logoFile) fd.append('logo', logoFile);

      const res = await api.post('/superadmin/churches', fd);
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

  const renderChurchCard = (c: (typeof churches)[number]) => {
    const pendingOrSetup =
      c.subscription_status === 'pending' ||
      c.subscription_status === 'approved';
    const active =
      c.is_active !== false &&
      c.subscription_status !== 'cancelled' &&
      c.subscription_status !== 'rejected' &&
      !pendingOrSetup;
    const logo = resolveMediaUrl(c.logo_url);

    return (
      <article key={c.id} className="sa-church-card">
        <div className="sa-church-card-top">
          <div className="sa-church-avatar">
            {logo ? <img src={logo} alt="" /> : c.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="sa-church-card-meta">
            <h3>{c.name}</h3>
            <Badge variant={active ? 'active' : 'inactive'}>
              {c.subscription_status || (active ? 'active' : 'inactive')}
            </Badge>
          </div>
          <span className="sa-church-id">#{c.id}</span>
        </div>
        <dl className="sa-church-dl">
          <div>
            <dt>Domain</dt>
            <dd className="sa-mono">{churchHostLabel(c.slug)}</dd>
          </div>
          <div>
            <dt>Local demo</dt>
            <dd className="sa-mono">localhost:5174?church={c.slug}</dd>
          </div>
          <div>
            <dt>City</dt>
            <dd>{c.city || '—'}</dd>
          </div>
          <div>
            <dt>Members</dt>
            <dd>{c.member_count ?? 0}</dd>
          </div>
        </dl>
        <div className="sa-church-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => openEdit(c)}
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => void handleToggleActive(c)}
          >
            {c.is_active === false ? (
              <>
                <PlayCircle size={14} />
                Activate
              </>
            ) : (
              <>
                <PauseCircle size={14} />
                Suspend
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => void handleDeleteChurch(c)}
          >
            <Trash2 size={14} />
            Delete
          </button>
          {active ? (
            <>
              <a
                className="btn btn-outline btn-sm"
                href={churchDomainUrl(c.slug)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Access
              </a>
              <a
                className="btn btn-primary sa-gold-btn btn-sm"
                href={churchDomainUrl(c.slug, '/login')}
                target="_blank"
                rel="noopener noreferrer"
              >
                Launch
                <ExternalLink size={14} />
              </a>
            </>
          ) : pendingOrSetup ? (
            <Link className="btn btn-outline btn-sm" to="/admin/registrations">
              Open Registrations
            </Link>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div className="sa-view">
      <div className="sa-page-head">
        <div className="sa-page-head-icon">
          <Building2 size={22} />
        </div>
        <div>
          <h2 className="sa-section-title">Church Management</h2>
          <p className="sa-section-sub">
            Create churches with logos, review registrations, and open domains.
          </p>
        </div>
      </div>

      <PageTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'list', label: 'View All', icon: <List size={16} /> },
          { id: 'add', label: 'Add Church', icon: <Plus size={16} /> },
        ]}
      />

      {tab === 'list' && (
        <>
          <div className="sa-filters">
            <div className="sa-search">
              <Search size={16} />
              <input
                className="input"
                placeholder="Search institutions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="input sa-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No churches yet"
              description="Open the Add Church tab to create a subdomain and pastor login, or review landing-page requests under Registrations."
              actionLabel="Add Church"
              onAction={() => setTab('add')}
            />
          ) : (
            <div className="sa-church-grid">
              {filtered.map((c) => renderChurchCard(c))}
            </div>
          )}
        </>
      )}

      {tab === 'add' && (
        <div className="sa-tab-panel">
          {createdSlug ? (
            <div className="sa-success-card">
              <div className="sa-success-icon">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="sa-section-title">{form.name || 'Church'} is live</h3>
              <p className="sa-section-sub">
                Pastor can sign in on the church domain — the logo shows on the login page.
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
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setCreatedSlug('');
                    setForm(EMPTY);
                    onLogoPick(null);
                    setTab('list');
                  }}
                >
                  Back to View All
                </button>
              </div>
            </div>
          ) : (
            <form className="sa-create-form" onSubmit={handleSubmit}>
              <section className="sa-panel">
                <h3 className="sa-panel-title">Church identity</h3>
                <p className="sa-panel-sub">
                  Design the subdomain, logo, and public profile for this church.
                </p>

                <div className="sa-logo-picker">
                  <div className="sa-logo-preview">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Church logo preview" />
                    ) : (
                      <ImagePlus size={28} />
                    )}
                  </div>
                  <div className="sa-logo-copy">
                    <label className="label">Church logo</label>
                    <p className="sa-field-hint">
                      Shown at the top of the church login page. JPEG, PNG, or WebP.
                    </p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => onLogoPick(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>

                <div className="sa-form-grid">
                  <div className="sa-field">
                    <label className="label">Church name *</label>
                    <input
                      className={`input${errors.name ? ' input-error' : ''}`}
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      placeholder="Peace Kingdom Assembly"
                    />
                    {errors.name && <span className="sa-error">{errors.name}</span>}
                  </div>
                  <div className="sa-field">
                    <label className="label">Domain slug *</label>
                    <input
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
                      <span className="sa-field-hint">Letters, numbers, hyphens</span>
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
                    <label className="label">Tagline</label>
                    <input
                      className="input"
                      value={form.tagline}
                      onChange={(e) => update('tagline', e.target.value)}
                    />
                  </div>
                  <div className="sa-field">
                    <label className="label">Denomination</label>
                    <select
                      className="input sa-select"
                      value={form.denomination}
                      onChange={(e) => update('denomination', e.target.value)}
                    >
                      <option value="">Select denomination</option>
                      {DENOMINATIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sa-field">
                    <label className="label">City</label>
                    <input
                      className="input"
                      value={form.city}
                      onChange={(e) => update('city', e.target.value)}
                    />
                  </div>
                  <div className="sa-field">
                    <label className="label">Region</label>
                    <select
                      className="input sa-select"
                      value={form.region}
                      onChange={(e) => update('region', e.target.value)}
                    >
                      <option value="">Select region</option>
                      {GH_REGIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sa-field">
                    <label className="label">Phone</label>
                    <input
                      className="input"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                    />
                  </div>
                  <div className="sa-field">
                    <label className="label">Email</label>
                    <input
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                    />
                  </div>
                </div>
                <div className="sa-field">
                  <label className="label">Address</label>
                  <input
                    className="input"
                    value={form.address}
                    onChange={(e) => update('address', e.target.value)}
                  />
                </div>
              </section>

              <section className="sa-panel">
                <h3 className="sa-panel-title">Pastor / admin login</h3>
                <p className="sa-panel-sub">
                  This account signs in on the church subdomain after creation.
                </p>
                <div className="sa-form-grid">
                  <div className="sa-field">
                    <label className="label">First name</label>
                    <input
                      className="input"
                      value={form.admin_first_name}
                      onChange={(e) => update('admin_first_name', e.target.value)}
                    />
                  </div>
                  <div className="sa-field">
                    <label className="label">Last name</label>
                    <input
                      className="input"
                      value={form.admin_last_name}
                      onChange={(e) => update('admin_last_name', e.target.value)}
                    />
                  </div>
                  <div className="sa-field">
                    <label className="label">Admin email *</label>
                    <input
                      className={`input${errors.admin_email ? ' input-error' : ''}`}
                      type="email"
                      value={form.admin_email}
                      onChange={(e) => update('admin_email', e.target.value)}
                    />
                    {errors.admin_email && (
                      <span className="sa-error">{errors.admin_email}</span>
                    )}
                  </div>
                  <div className="sa-field">
                    <label className="label">Password *</label>
                    <input
                      className={`input${errors.admin_password ? ' input-error' : ''}`}
                      type="password"
                      value={form.admin_password}
                      onChange={(e) => update('admin_password', e.target.value)}
                    />
                    {errors.admin_password && (
                      <span className="sa-error">{errors.admin_password}</span>
                    )}
                  </div>
                  <div className="sa-field">
                    <label className="label">Role</label>
                    <select
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

              <div className="sa-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary sa-gold-btn"
                  disabled={creating}
                >
                  {creating ? 'Creating…' : 'Create church'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={closeEdit}
        title={editing ? `Edit ${editing.name}` : 'Edit church'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={closeEdit}>
              Cancel
            </button>
            {editing && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void handleToggleActive(editing)}
              >
                {editForm.is_active ? 'Suspend' : 'Activate'}
              </button>
            )}
            {editing && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleDeleteChurch(editing)}
              >
                <Trash2 size={14} />
                Delete forever
              </button>
            )}
            <button
              type="submit"
              form="sa-edit-church-form"
              className="btn btn-primary sa-gold-btn"
              disabled={savingEdit}
            >
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        <form id="sa-edit-church-form" className="sa-create-form" onSubmit={handleSaveEdit}>
          <section className="sa-panel" style={{ boxShadow: 'none', border: 'none', padding: 0 }}>
            <div className="sa-logo-picker">
              <div className="sa-logo-preview">
                {editLogoPreview ? (
                  <img src={editLogoPreview} alt="" />
                ) : (
                  <ImagePlus size={28} />
                )}
              </div>
              <div className="sa-logo-copy">
                <label className="label">Church logo</label>
                <p className="sa-field-hint">JPEG, PNG, or WebP — shown on login, sidebar, and marketplace.</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => onEditLogoPick(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="sa-form-grid">
              <div className="sa-field">
                <label className="label">Church name *</label>
                <input
                  className={`input${editErrors.name ? ' input-error' : ''}`}
                  value={editForm.name}
                  onChange={(e) => updateEdit('name', e.target.value)}
                />
                {editErrors.name && <span className="sa-error">{editErrors.name}</span>}
              </div>
              <div className="sa-field">
                <label className="label">Domain slug *</label>
                <input
                  className={`input${editErrors.slug ? ' input-error' : ''}`}
                  value={editForm.slug}
                  onChange={(e) => updateEdit('slug', toSlug(e.target.value))}
                />
                {editErrors.slug ? (
                  <span className="sa-error">{editErrors.slug}</span>
                ) : (
                  <span className="sa-field-hint">
                    {(editForm.slug ? churchHostLabel(editForm.slug) : 'ch-your-church.scholarnerve.com')}
                  </span>
                )}
              </div>
              <div className="sa-field">
                <label className="label">Tagline</label>
                <input
                  className="input"
                  value={editForm.tagline}
                  onChange={(e) => updateEdit('tagline', e.target.value)}
                />
              </div>
              <div className="sa-field">
                <label className="label">Denomination</label>
                <select
                  className="input sa-select"
                  value={editForm.denomination}
                  onChange={(e) => updateEdit('denomination', e.target.value)}
                >
                  <option value="">Select denomination</option>
                  {DENOMINATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="sa-field">
                <label className="label">City</label>
                <input
                  className="input"
                  value={editForm.city}
                  onChange={(e) => updateEdit('city', e.target.value)}
                />
              </div>
              <div className="sa-field">
                <label className="label">Region</label>
                <select
                  className="input sa-select"
                  value={editForm.region}
                  onChange={(e) => updateEdit('region', e.target.value)}
                >
                  <option value="">Select region</option>
                  {GH_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="sa-field">
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={editForm.phone}
                  onChange={(e) => updateEdit('phone', e.target.value)}
                />
              </div>
              <div className="sa-field">
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => updateEdit('email', e.target.value)}
                />
              </div>
            </div>
            <div className="sa-field">
              <label className="label">Address</label>
              <input
                className="input"
                value={editForm.address}
                onChange={(e) => updateEdit('address', e.target.value)}
              />
            </div>
            <div className="sa-form-grid" style={{ marginTop: 12 }}>
              <div className="sa-field">
                <label className="label">Subscription status</label>
                <select
                  className="input sa-select"
                  value={editForm.subscription_status}
                  onChange={(e) => updateEdit('subscription_status', e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="approved">Approved (setup pending)</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled / Suspended</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="sa-field">
                <label className="label">Account status</label>
                <label className="sa-check-row">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => updateEdit('is_active', e.target.checked)}
                  />
                  Church is active (can sign in)
                </label>
              </div>
            </div>

            <h3 className="sa-panel-title" style={{ marginTop: 20 }}>Primary Admin</h3>
            <p className="sa-panel-sub">
              Update the church Primary Admin name and password. Leave password blank to keep the current one.
            </p>
            <div className="sa-form-grid">
              <div className="sa-field">
                <label className="label">Admin full name</label>
                <input
                  className="input"
                  value={editForm.admin_name}
                  onChange={(e) => updateEdit('admin_name', e.target.value)}
                  placeholder="Pastor Kwame Mensah"
                />
              </div>
              <div className="sa-field">
                <label className="label">Username</label>
                <input
                  className="input"
                  value={editForm.admin_username}
                  onChange={(e) => updateEdit('admin_username', e.target.value)}
                />
              </div>
              <div className="sa-field">
                <label className="label">Login email</label>
                <input className="input" value={editForm.email} readOnly disabled />
                <span className="sa-field-hint">Uses the church email above</span>
              </div>
              <div className="sa-field">
                <label className="label">New password</label>
                <input
                  className="input"
                  type="password"
                  value={editForm.admin_password}
                  onChange={(e) => updateEdit('admin_password', e.target.value)}
                  placeholder="Leave blank to keep current"
                  minLength={6}
                />
              </div>
            </div>
          </section>
        </form>
      </Modal>
    </div>
  );
}
