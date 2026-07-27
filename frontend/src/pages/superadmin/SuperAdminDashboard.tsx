import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Plus,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { formatGHS } from '../../utils/formatGHS';
import { churchDomainUrl, churchHostLabel } from '../../utils/tenantHost';
import { Badge } from '../../components/ui/Badge';
import { useSuperAdmin } from './SuperAdminLayout';

function todayLabel() {
  return new Date().toLocaleDateString('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function SuperAdminDashboard() {
  const { stats, churches } = useSuperAdmin();
  const recent = churches.slice(0, 4);

  return (
    <div className="sa-view">
      <section className="sa-welcome">
        <div>
          <h2 className="sa-welcome-title">
            {greeting()}, admin
          </h2>
          <p className="sa-welcome-date">{todayLabel()}</p>
          <div className="sa-welcome-badges">
            <span className="sa-chip">Platform Active</span>
            <span className="sa-chip sa-chip--gold">
              {stats?.active_churches ?? 0} active
              {(stats?.pending_churches || 0) > 0
                ? ` · ${stats?.pending_churches} pending`
                : ''} churches
            </span>
          </div>
        </div>
        <div className="sa-welcome-actions">
          <Link to="/admin/registrations" className="btn btn-primary sa-gold-btn">
            <Plus size={16} />
            Review registrations
          </Link>
          <Link to="/admin/churches" className="btn btn-outline">
            Manage churches
          </Link>
        </div>
      </section>

      <div className="sa-stats sa-stats--5">
        <article className="sa-kpi">
          <div className="sa-kpi-icon"><Building2 size={18} /></div>
          <p className="sa-kpi-label">Total institutions</p>
          <p className="sa-kpi-value">{stats?.total_churches ?? 0}</p>
        </article>
        <article className="sa-kpi">
          <div className="sa-kpi-icon"><CheckCircle2 size={18} /></div>
          <p className="sa-kpi-label">Active churches</p>
          <p className="sa-kpi-value">{stats?.active_churches ?? 0}</p>
        </article>
        <article className="sa-kpi">
          <div className="sa-kpi-icon"><Users size={18} /></div>
          <p className="sa-kpi-label">Members</p>
          <p className="sa-kpi-value">{stats?.total_members ?? 0}</p>
        </article>
        <article className="sa-kpi">
          <div className="sa-kpi-icon"><Store size={18} /></div>
          <p className="sa-kpi-label">Listings</p>
          <p className="sa-kpi-value">{stats?.total_listings ?? 0}</p>
        </article>
        <article className="sa-kpi">
          <div className="sa-kpi-icon"><Wallet size={18} /></div>
          <p className="sa-kpi-label">Monthly revenue</p>
          <p className="sa-kpi-value sa-kpi-value--sm">
            {formatGHS(Number(stats?.monthly_revenue ?? 0))}
          </p>
        </article>
      </div>

      <section className="sa-hub">
        <div className="sa-hub-head">
          <div>
            <h3 className="sa-panel-title">Institutional Hub</h3>
            <p className="sa-panel-sub">
              Coordinate and manage registered church tenants.
            </p>
          </div>
          <Link to="/admin/churches?tab=add" className="btn btn-primary sa-gold-btn">
            <Plus size={16} />
            Add Church
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="sa-hub-empty">
            <ClipboardList size={28} />
            <p>No churches yet. Use the Add Church tab to create one.</p>
            <Link to="/admin/churches?tab=add" className="btn btn-outline">
              Open Add Church
            </Link>
          </div>
        ) : (
          <div className="sa-church-grid">
            {recent.map((c) => (
              <article key={c.id} className="sa-church-card">
                <div className="sa-church-card-top">
                  <div className="sa-church-avatar">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="sa-church-card-meta">
                    <h3>{c.name}</h3>
                    <Badge variant="active">
                      {c.subscription_status || 'active'}
                    </Badge>
                  </div>
                </div>
                <p className="sa-mono sa-muted">{churchHostLabel(c.slug)}</p>
                <div className="sa-church-actions">
                  <a
                    className="btn btn-outline btn-sm"
                    href={churchDomainUrl(c.slug, '/login')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Launch
                    <ExternalLink size={14} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
