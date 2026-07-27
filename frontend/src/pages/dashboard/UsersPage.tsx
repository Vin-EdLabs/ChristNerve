import { FormEvent, useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Shield, UserPlus } from 'lucide-react';
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
  const myRole = String(me?.role || '').toLowerCase();
  // Always allow pastor/admin/super-admin; secretaries can reset member PINs
  const canManageRoles = ['pastor', 'admin', 'super-admin'].includes(myRole);
  const canResetStaffPassword = canManageRoles;
  const canSetMemberLogin = [
    'pastor',
    'admin',
    'super-admin',
    'secretary',
  ].includes(myRole);

  const [section, setSection] = useState<'staff' | 'members'>('staff');
  const [addOpen, setAddOpen] = useState(false);
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
  const [credPassword, setCredPassword] = useState('');

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteMember, setPromoteMember] = useState<MemberLoginRow | null>(null);
  const [promoteForm, setPromoteForm] = useState({
    email: '',
    password: '',
    role: 'secretary',
  });

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
    if (!canManageRoles) return;
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('Staff user created');
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: 'secretary',
        password: '',
      });
      setAddOpen(false);
      await loadStaff();
      setSection('staff');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Could not create user'));
    } finally {
      setSaving(false);
    }
  };

  const setRole = async (id: number, role: string) => {
    if (!canManageRoles) return;
    try {
      await api.put(`/users/${id}`, { role });
      toast.success('Role updated');
      await loadStaff();
    } catch {
      toast.error('Could not update role');
    }
  };

  const toggleActive = async (u: ChurchUser) => {
    if (!canManageRoles) return;
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
    setCredPassword('');
    setCredOpen(true);
  };

  const openMemberLogin = (m: MemberLoginRow) => {
    setCredTarget({
      kind: 'member',
      id: m.id,
      name: `${m.first_name} ${m.last_name}`,
      username: m.phone || '',
    });
    setCredPassword('');
    setCredOpen(true);
  };

  const saveCredentials = async (e: FormEvent) => {
    e.preventDefault();
    if (!credTarget) return;
    setSaving(true);
    try {
      if (credTarget.kind === 'staff') {
        if (!credPassword || credPassword.length < 6) {
          toast.error('Password must be at least 6 characters');
          setSaving(false);
          return;
        }
        await api.put(`/users/${credTarget.id}`, { password: credPassword });
        toast.success('Password updated');
      } else {
        const pin = credPassword.trim();
        if (pin && !/^\d{4}$/.test(pin)) {
          toast.error(
            'PIN must be exactly 4 digits (or leave blank to use last 4 of phone)'
          );
          setSaving(false);
          return;
        }
        await api.put(`/members/${credTarget.id}/reset-pin`, {
          pin: pin || undefined,
        });
        toast.success(
          pin
            ? 'PIN set — member can sign in with phone + this PIN'
            : 'PIN reset to last 4 digits of their phone'
        );
        await loadMembers();
      }
      setCredOpen(false);
      setCredTarget(null);
      setCredPassword('');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const roleOptionsFor = (current: string) => {
    const r = String(current || '').toLowerCase();
    if (ROLES.some((x) => x.value === r)) return ROLES;
    return [{ value: r, label: r || 'Unknown' }, ...ROLES];
  };

  return (
    <div className="users-page">
      <div className="page-head users-head">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">
            Change staff roles, reset passwords, and manage member phone + PIN.
          </p>
        </div>
        {section === 'staff' && canManageRoles && (
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Add staff
          </Button>
        )}
      </div>

      {!canManageRoles && section === 'staff' && (
        <p className="users-perm-note">
          You can view staff here. Ask a pastor or admin to change roles or
          passwords.
        </p>
      )}

      <div className="users-seg">
        <button
          type="button"
          className={`users-seg-btn${section === 'staff' ? ' is-active' : ''}`}
          onClick={() => setSection('staff')}
        >
          Staff
        </button>
        <button
          type="button"
          className={`users-seg-btn${section === 'members' ? ' is-active' : ''}`}
          onClick={() => setSection('members')}
        >
          Members
        </button>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : section === 'staff' ? (
        users.length === 0 ? (
          <EmptyState
            title="No staff users yet"
            description="Add your first church admin."
          />
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email / login</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="users-name-cell">
                        <span className="users-avatar">
                          {`${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {u.first_name} {u.last_name}
                            {u.id === me?.id ? ' (you)' : ''}
                          </strong>
                          <div className="users-sub">{u.phone || 'No phone'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="users-mono">{u.email}</td>
                    <td>
                      {canManageRoles ? (
                        <select
                          className="users-select users-select--role"
                          value={String(u.role || '').toLowerCase()}
                          onChange={(e) => void setRole(u.id, e.target.value)}
                          aria-label={`Change role for ${u.first_name}`}
                        >
                          {roleOptionsFor(u.role).map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="users-role-pill">
                          <Shield size={12} /> {u.role}
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`users-status${u.is_active ? ' is-on' : ''}`}
                      >
                        {u.is_active ? 'Active' : 'Off'}
                      </span>
                    </td>
                    <td>
                      <div className="users-actions">
                        {canResetStaffPassword && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openStaffPassword(u)}
                          >
                            <KeyRound size={14} /> Reset password
                          </Button>
                        )}
                        {canManageRoles && u.id !== me?.id && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void toggleActive(u)}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : members.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Add members first, then set their login here."
        />
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login phone</th>
                <th>PIN status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="users-name-cell">
                      <span className="users-avatar">
                        {`${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase()}
                      </span>
                      <strong>
                        {m.first_name} {m.last_name}
                      </strong>
                    </div>
                  </td>
                  <td className="users-mono">{m.phone || '—'}</td>
                  <td>
                    <span
                      className={`users-status${m.credentials_set && m.phone ? ' is-on' : ''}`}
                    >
                      {m.credentials_set && m.phone
                        ? 'Can sign in'
                        : 'Needs setup'}
                    </span>
                  </td>
                  <td>
                    <div className="users-actions">
                      {canSetMemberLogin && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openMemberLogin(m)}
                        >
                          <KeyRound size={14} /> Reset PIN
                        </Button>
                      )}
                      {canManageRoles && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPromoteMember(m);
                            setPromoteForm({
                              email: m.email || '',
                              password: '',
                              role: 'secretary',
                            });
                            setPromoteOpen(true);
                          }}
                        >
                          <UserPlus size={14} /> Make staff
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add staff user"
        subtitle="Email + password login for church staff"
      >
        <form className="users-cred-form" onSubmit={createUser}>
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
              minLength={6}
            />
          </div>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <Button type="submit" loading={saving}>
              Create staff
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={promoteOpen}
        onClose={() => {
          setPromoteOpen(false);
          setPromoteMember(null);
        }}
        title={
          promoteMember
            ? `Make staff · ${promoteMember.first_name} ${promoteMember.last_name}`
            : 'Make staff'
        }
      >
        <form
          className="users-cred-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!promoteMember) return;
            setSaving(true);
            try {
              await api.post('/users/promote-member', {
                member_id: promoteMember.id,
                email: promoteForm.email,
                password: promoteForm.password,
                role: promoteForm.role,
                phone: promoteMember.phone,
              });
              toast.success('Staff account created');
              setPromoteOpen(false);
              setPromoteMember(null);
              await loadStaff();
              setSection('staff');
            } catch (err: unknown) {
              toast.error(getErrorMessage(err, 'Could not promote member'));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Input
            label="Staff email (login)"
            type="email"
            value={promoteForm.email}
            onChange={(e) =>
              setPromoteForm((f) => ({ ...f, email: e.target.value }))
            }
            required
          />
          <Input
            label="Temporary password"
            type="password"
            value={promoteForm.password}
            onChange={(e) =>
              setPromoteForm((f) => ({ ...f, password: e.target.value }))
            }
            required
            minLength={6}
          />
          <label className="field">
            <span className="field-label">Staff role</span>
            <select
              className="input"
              value={promoteForm.role}
              onChange={(e) =>
                setPromoteForm((f) => ({ ...f, role: e.target.value }))
              }
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <Button type="submit" loading={saving}>
              Create staff account
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={credOpen}
        onClose={() => {
          setCredOpen(false);
          setCredTarget(null);
        }}
        title={
          credTarget?.kind === 'member'
            ? `Reset PIN · ${credTarget.name}`
            : `Reset password · ${credTarget?.name || ''}`
        }
      >
        <form onSubmit={saveCredentials} className="users-cred-form">
          {credTarget?.kind === 'member' ? (
            <>
              <p className="page-sub" style={{ marginBottom: 12 }}>
                Login phone:{' '}
                <strong>{credTarget.username || 'set on member profile'}</strong>
                . Leave PIN blank to reset to the last 4 digits of their phone.
              </p>
              <Input
                label="New PIN (optional)"
                type="password"
                value={credPassword}
                onChange={(e) =>
                  setCredPassword(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                inputMode="numeric"
                maxLength={4}
                placeholder="Last 4 of phone if blank"
              />
            </>
          ) : (
            <>
              <p className="page-sub" style={{ marginBottom: 12 }}>
                Login email stays <strong>{credTarget?.username}</strong>.
              </p>
              <Input
                label="New password"
                type="password"
                value={credPassword}
                onChange={(e) => setCredPassword(e.target.value)}
                required
                minLength={6}
              />
            </>
          )}
          <div className="form-actions" style={{ marginTop: 16 }}>
            <Button type="submit" loading={saving}>
              {credTarget?.kind === 'member' ? 'Reset PIN' : 'Save password'}
            </Button>
          </div>
        </form>
      </Modal>

      <style>{`
        .users-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .users-perm-note {
          margin: 0 0 12px; padding: 10px 14px; border-radius: 10px;
          background: #f7f3ea; color: #6b5a2e; font-size: 13px;
        }
        .users-seg {
          display: inline-flex; gap: 4px; padding: 4px; background: #f3f0ea;
          border-radius: 12px; margin: 0 0 18px;
        }
        .users-seg-btn {
          border: 0; background: transparent; padding: 8px 16px; border-radius: 9px;
          font-size: 13px; font-weight: 600; color: #6b6570; cursor: pointer;
        }
        .users-seg-btn.is-active {
          background: #fff; color: #1a1523;
          box-shadow: 0 1px 3px rgba(15, 13, 20, 0.08);
        }
        .users-table-wrap {
          width: 100%; overflow-x: auto; border: 1px solid #e8e4dc;
          border-radius: 14px; background: #fff;
        }
        .users-table { width: 100%; border-collapse: collapse; min-width: 680px; }
        .users-table th {
          text-align: left; font-size: 11px; letter-spacing: 0.06em;
          text-transform: uppercase; color: #9a948c; font-weight: 700;
          padding: 12px 14px; border-bottom: 1px solid #ebe6de; background: #faf8f4;
        }
        .users-table td {
          padding: 14px; border-bottom: 1px solid #f0ece4; font-size: 14px;
          color: #2a2433; vertical-align: middle;
        }
        .users-table tr:last-child td { border-bottom: 0; }
        .users-name-cell { display: flex; align-items: center; gap: 10px; }
        .users-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: #efeaf6;
          color: #2d1b69; display: inline-grid; place-items: center;
          font-size: 12px; font-weight: 700; flex-shrink: 0;
        }
        .users-sub { font-size: 12px; color: #9a948c; font-weight: 400; margin-top: 2px; }
        .users-mono { word-break: break-all; }
        .users-select--role {
          min-height: 38px; min-width: 130px; border: 1px solid #d8d2c8;
          border-radius: 10px; padding: 0 10px; font-size: 13px; font-weight: 600;
          background: #fff; color: #1a1523; cursor: pointer;
        }
        .users-role-pill {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; text-transform: capitalize;
        }
        .users-status {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: #9a948c;
        }
        .users-status::before {
          content: ''; width: 7px; height: 7px; border-radius: 50%; background: #c9c3ba;
        }
        .users-status.is-on { color: #1f6b43; }
        .users-status.is-on::before { background: #2f9e63; }
        .users-actions {
          display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
        }
      `}</style>
    </div>
  );
}
