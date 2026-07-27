import { FormEvent, useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { ChurchUser } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';

const ROLES = [
  { value: 'pastor', label: 'Pastor' },
  { value: 'admin', label: 'Admin' },
  { value: 'finance', label: 'Finance' },
  { value: 'secretary', label: 'Secretary' },
];

interface MemberLoginRow {
  id: number;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  credentials_set?: boolean;
  membership_status?: string;
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

function getErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error || fallback
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const canManage = ['pastor', 'admin'].includes(
    String(me?.role || '').toLowerCase()
  );
  const canSetMemberLogin = ['pastor', 'admin', 'secretary'].includes(
    String(me?.role || '').toLowerCase()
  );

  const [section, setSection] = useState<'staff' | 'members'>('staff');
  const [tab, setTab] = useState<'view' | 'add'>('view');
  const [users, setUsers] = useState<ChurchUser[]>([]);
  const [members, setMembers] = useState<MemberLoginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'secretary',
    password: '',
  });

  const [credOpen, setCredOpen] = useState(false);
  const [credTarget, setCredTarget] = useState<{
    kind: 'staff' | 'member';
    id: number;
    name: string;
    username?: string;
  } | null>(null);
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');

  const loadStaff = useCallback(async () => {
    const res = await api.get('/users');
    setUsers(asList<ChurchUser>(res.data));
  }, []);

  const loadMembers = useCallback(async () => {
    const res = await api.get('/members', { params: { limit: 100, page: 1 } });
    const rows = asList<MemberLoginRow>(res.data).map((m) => ({
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      email: m.email,
      phone: m.phone,
      username: m.username,
      credentials_set: Boolean(m.credentials_set),
      membership_status: m.membership_status,
    }));
    setMembers(rows);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (section === 'staff') await loadStaff();
      else await loadMembers();
    } catch {
      toast.error(
        section === 'staff' ? 'Failed to load users' : 'Failed to load members'
      );
      if (section === 'staff') setUsers([]);
      else setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [section, loadStaff, loadMembers]);

  useEffect(() => {
    void load();
  }, [load]);

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('User created');
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: 'secretary',
        password: '',
      });
      setTab('view');
      await loadStaff();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Could not create user'));
    } finally {
      setSaving(false);
    }
  };

  const setRole = async (id: number, role: string) => {
    if (!canManage) return;
    try {
      await api.put(`/users/${id}`, { role });
      toast.success('Role updated');
      await loadStaff();
    } catch {
      toast.error('Could not update role');
    }
  };

  const toggleActive = async (u: ChurchUser) => {
    if (!canManage) return;
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      toast.success(u.is_active ? 'User deactivated' : 'User activated');
      await loadStaff();
    } catch {
      toast.error('Could not update user');
    }
  };

  const openStaffPassword = (u: ChurchUser) => {
    setCredTarget({
      kind: 'staff',
      id: u.id,
      name: `${u.first_name} ${u.last_name}`,
      username: u.email,
    });
    setCredUsername(u.email);
    setCredPassword('');
    setCredOpen(true);
  };

  const openMemberLogin = (m: MemberLoginRow) => {
    setCredTarget({
      kind: 'member',
      id: m.id,
      name: `${m.first_name} ${m.last_name}`,
      username: m.username || '',
    });
    setCredUsername(m.username || '');
    setCredPassword('');
    setCredOpen(true);
  };

  const saveCredentials = async (e: FormEvent) => {
    e.preventDefault();
    if (!credTarget) return;
    if (!credPassword || credPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      if (credTarget.kind === 'staff') {
        await api.put(`/users/${credTarget.id}`, { password: credPassword });
        toast.success('Password updated');
      } else {
        if (!credUsername.trim()) {
          toast.error('Username is required');
          return;
        }
        await api.put(`/members/${credTarget.id}/credentials`, {
          username: credUsername.trim(),
          password: credPassword,
        });
        toast.success('Member login set — they can sign in now');
        await loadMembers();
      }
      setCredOpen(false);
      setCredTarget(null);
      setCredPassword('');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Could not save credentials'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="users-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">
            Manage staff roles and member login usernames &amp; passwords.
          </p>
        </div>
      </div>

      <div className="page-tabs">
        <button
          type="button"
          className={`page-tab${section === 'staff' ? ' active' : ''}`}
          onClick={() => {
            setSection('staff');
            setTab('view');
          }}
        >
          Staff
        </button>
        <button
          type="button"
          className={`page-tab${section === 'members' ? ' active' : ''}`}
          onClick={() => {
            setSection('members');
            setTab('view');
          }}
        >
          Members
        </button>
        {section === 'staff' && canManage && (
          <button
            type="button"
            className={`page-tab${tab === 'add' ? ' active' : ''}`}
            onClick={() => setTab('add')}
          >
            <Plus size={16} /> Add Staff
          </button>
        )}
      </div>

      {section === 'staff' && tab === 'add' && canManage && (
        <form className="card glass-card users-form" onSubmit={createUser}>
          <div className="form-row">
            <Input
              label="First name"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
            <Input
              label="Last name"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <Input
              label="Email (login)"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label className="field">
              <span className="field-label">Role</span>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Temporary password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <Button type="submit" loading={saving}>
            Create user
          </Button>
        </form>
      )}

      {section === 'staff' && tab === 'view' && (
        <>
          {loading ? (
            <SkeletonCard />
          ) : users.length === 0 ? (
            <EmptyState
              title="No staff users yet"
              description="Add your first church admin."
            />
          ) : (
            <div className="users-list">
              {users.map((u) => (
                <article key={u.id} className="users-row glass-card">
                  <div className="avatar avatar-sm">
                    {`${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase()}
                  </div>
                  <div className="users-row-main">
                    <strong>
                      {u.first_name} {u.last_name}
                    </strong>
                    <span>{u.email}</span>
                  </div>
                  <div className="users-row-meta">
                    {canManage ? (
                      <select
                        className="input input-sm"
                        value={u.role}
                        onChange={(e) => void setRole(u.id, e.target.value)}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="role-chip">
                        <Shield size={12} /> {u.role}
                      </span>
                    )}
                    <span className={`status-dot${u.is_active ? ' on' : ''}`}>
                      {u.is_active ? 'Active' : 'Off'}
                    </span>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openStaffPassword(u)}
                      >
                        <KeyRound size={14} /> Password
                      </Button>
                    )}
                    {canManage && u.id !== me?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void toggleActive(u)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {section === 'members' && (
        <>
          {loading ? (
            <SkeletonCard />
          ) : members.length === 0 ? (
            <EmptyState
              title="No members yet"
              description="Add members first, then set their login here."
            />
          ) : (
            <div className="users-list">
              {members.map((m) => (
                <article key={m.id} className="users-row glass-card">
                  <div className="avatar avatar-sm">
                    {`${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase()}
                  </div>
                  <div className="users-row-main">
                    <strong>
                      {m.first_name} {m.last_name}
                    </strong>
                    <span>
                      {m.credentials_set && m.username
                        ? `Login: ${m.username}`
                        : 'No login set yet'}
                      {m.phone ? ` · ${m.phone}` : ''}
                    </span>
                  </div>
                  <div className="users-row-meta">
                    <span
                      className={`status-dot${m.credentials_set ? ' on' : ''}`}
                    >
                      {m.credentials_set ? 'Can sign in' : 'Needs login'}
                    </span>
                    {canSetMemberLogin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openMemberLogin(m)}
                      >
                        <KeyRound size={14} />
                        {m.credentials_set ? 'Reset login' : 'Set login'}
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={credOpen}
        onClose={() => {
          setCredOpen(false);
          setCredTarget(null);
        }}
        title={
          credTarget?.kind === 'member'
            ? `Member login · ${credTarget.name}`
            : `Reset password · ${credTarget?.name || ''}`
        }
      >
        <form onSubmit={saveCredentials} className="users-cred-form">
          {credTarget?.kind === 'member' ? (
            <Input
              label="Username"
              value={credUsername}
              onChange={(e) => setCredUsername(e.target.value)}
              placeholder="e.g. akosua.m"
              required
            />
          ) : (
            <p className="page-sub" style={{ marginBottom: 12 }}>
              Login email stays <strong>{credTarget?.username}</strong>. Set a new password below.
            </p>
          )}
          <Input
            label={credTarget?.kind === 'member' ? 'Password' : 'New password'}
            type="password"
            value={credPassword}
            onChange={(e) => setCredPassword(e.target.value)}
            required
            minLength={6}
          />
          <div className="form-actions" style={{ marginTop: 16 }}>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
