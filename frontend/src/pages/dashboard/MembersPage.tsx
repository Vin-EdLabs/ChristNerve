import { useCallback, useEffect, useState } from 'react';
import { List, Plus, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { ChurchMember } from '../../types';
import { Input } from '../../components/ui/Input';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { MemberTable } from '../../components/members/MemberTable';
import { MemberCard } from '../../components/members/MemberCard';
import { MemberForm } from '../../components/members/MemberForm';
import type { MemberFormValues } from '../../components/members/MemberForm';
import { PageTabs } from '../../components/ui/PageTabs';

function asMembers(payload: unknown): ChurchMember[] {
  if (Array.isArray(payload)) return payload as ChurchMember[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as ChurchMember[];
    if (Array.isArray(obj.members)) return obj.members as ChurchMember[];
  }
  return [];
}

export default function MembersPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'list' | 'add'>('list');
  const [editing, setEditing] = useState<ChurchMember | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const res = await api.get('/members', {
        params: { search: q || undefined, limit: 50 },
      });
      setMembers(asMembers(res.data));
    } catch {
      toast.error('Failed to load members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(query);
  }, [load, query]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setTab('add');
  };

  const openEdit = (member: ChurchMember) => {
    setEditing(member);
    setTab('add');
  };

  const handleSubmit = async (data: MemberFormValues) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await api.put(`/members/${editing.id}`, data);
        toast.success('Member updated successfully');
      } else {
        await api.post('/members', data);
        toast.success('Member added successfully');
      }
      setEditing(null);
      setTab('list');
      await load(query);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not save member';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="members-page">
      <div className="page-head">
        <div className="page-head-icon">
          <Users size={22} />
        </div>
        <div>
          <h2 className="page-head-title">Members Management</h2>
          <p className="page-head-sub">
            Manage congregation profiles, verification, and storefronts.
          </p>
        </div>
      </div>

      <PageTabs
        active={tab}
        onChange={(id) => {
          if (id === 'add') {
            setEditing(null);
            setTab('add');
          } else {
            setEditing(null);
            setTab('list');
          }
        }}
        tabs={[
          { id: 'list', label: 'View All', icon: <List size={16} /> },
          {
            id: 'add',
            label: editing ? 'Edit Member' : 'Add Member',
            icon: <Plus size={16} />,
          },
        ]}
      />

      {tab === 'list' && (
        <>
          <div className="members-toolbar">
            <div className="members-search">
              <Input
                placeholder="Search name, ID, or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search size={16} />}
              />
            </div>
            <select className="input sa-select" defaultValue="active" style={{ maxWidth: 140 }}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="visitor">Visitors</option>
            </select>
          </div>

          {loading ? (
            <div className="members-skeleton">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              title="No members yet. Add your first member to get started."
              description="Use the Add Member tab — forms open inline, not in a popup."
              actionLabel="Add Member"
              onAction={openCreate}
            />
          ) : (
            <>
              <div className="members-desktop-only">
                <MemberTable members={members} onEdit={openEdit} onAdd={openCreate} />
              </div>
              <div className="members-mobile-only">
                {members.map((m) => (
                  <MemberCard key={m.id} member={m} />
                ))}
              </div>
              <p className="members-count">
                Showing {members.length} of {members.length} members
              </p>
            </>
          )}
        </>
      )}

      {tab === 'add' && (
        <MemberForm
          variant="inline"
          member={editing}
          onSubmit={handleSubmit}
          loading={saving}
          onClose={() => {
            setEditing(null);
            setTab('list');
          }}
        />
      )}
    </div>
  );
}
