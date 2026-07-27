import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { ChurchMember } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { MemberTable } from '../../components/members/MemberTable';
import { MemberForm } from '../../components/members/MemberForm';
import type { MemberFormValues } from '../../components/members/MemberForm';

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
  const [panelOpen, setPanelOpen] = useState(false);
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
    void load(query);
  }, [load, query]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setPanelOpen(true);
  };

  const openEdit = (member: ChurchMember) => {
    setEditing(member);
    setPanelOpen(true);
  };

  const closePanel = () => {
    if (saving) return;
    setPanelOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (data: MemberFormValues, avatarFile?: File | null) => {
    setSaving(true);
    try {
      let memberId = editing?.id;
      if (editing?.id) {
        const { avatar_url: _a, ...rest } = data;
        await api.put(`/members/${editing.id}`, rest);
        toast.success('Member updated successfully');
      } else {
        const { avatar_url: _a, ...rest } = data;
        const res = await api.post('/members', rest);
        memberId = res.data?.id ?? res.data?.member?.id ?? res.data?.data?.id;
        toast.success('Member added successfully');
      }

      if (avatarFile && memberId) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        await api.post(`/members/${memberId}/avatar`, fd);
      }

      setPanelOpen(false);
      setEditing(null);
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
        <div style={{ flex: 1 }}>
          <h2 className="page-head-title">Members</h2>
          <p className="page-head-sub">
            Congregation profiles, verification, and storefronts.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus size={16} /> Add Member
        </Button>
      </div>

      <div className="members-toolbar">
        <div className="members-search">
          <Input
            placeholder="Search name, ID, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>
      </div>

      {loading ? (
        <div className="members-skeleton">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Add your first member — the form slides in from the right."
          actionLabel="Add Member"
          onAction={openCreate}
        />
      ) : (
        <>
          <MemberTable members={members} onEdit={openEdit} onAdd={openCreate} />
          <p className="members-count">Showing {members.length} members</p>
        </>
      )}

      <MemberForm
        open={panelOpen}
        member={editing}
        onSubmit={handleSubmit}
        loading={saving}
        onClose={closePanel}
      />
    </div>
  );
}
