import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { ChurchDepartment } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function DepartmentsPage() {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<ChurchDepartment[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/departments');
      setDepartments(asList<ChurchDepartment>(res.data));
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Department name is required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/departments', {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Department created');
      setOpen(false);
      setName('');
      setDescription('');
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not create department';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dept-page">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="dept-page">
      <div className="dept-toolbar">
        <h2 className="page-heading">Departments</h2>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} />
          Create Department
        </Button>
      </div>

      {departments.length === 0 ? (
        <EmptyState
          title="No departments yet."
          description="Organise Choir, Ushering, Youth, Media, and more."
          actionLabel="Create Department"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="dept-grid">
          {departments.map((d) => (
            <article key={d.id} className="card dept-card">
              <h3>{d.name}</h3>
              <p>{d.description || 'No description yet.'}</p>
              {(d as ChurchDepartment & { member_count?: number }).member_count !=
                null && (
                <span className="dept-count">
                  {(d as ChurchDepartment & { member_count?: number }).member_count}{' '}
                  members
                </span>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Create Department"
      >
        <form className="dept-form" onSubmit={handleCreate}>
          <Input
            label="Name"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            placeholder="Choir"
            required
          />
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Leads worship every Sunday and midweek."
          />
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <style>{`
        .dept-page { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 1100px; margin: 0 auto; }
        .dept-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .page-heading {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
        }
        .dept-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }
        .dept-card h3 {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .dept-card p {
          font-size: 14px;
          color: var(--text-secondary, #6b6560);
          line-height: 1.5;
        }
        .dept-count {
          display: inline-block;
          margin-top: 12px;
          font-size: 12px;
          color: var(--text-muted, #9e9893);
        }
        .dept-form { display: flex; flex-direction: column; gap: 12px; }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
