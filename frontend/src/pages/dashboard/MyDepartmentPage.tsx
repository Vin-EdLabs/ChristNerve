import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Network, Users } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

interface DeptInfo {
  name?: string;
  description?: string | null;
  leader_first_name?: string;
  leader_last_name?: string;
  member_count?: number | null;
}

export default function MyDepartmentPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<DeptInfo | null>(null);
  const [ministry, setMinistry] = useState<string | null>(null);
  const [cellGroup, setCellGroup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/departments/mine');
        if (cancelled) return;
        setDepartment(res.data?.department || null);
        setMinistry(res.data?.ministry || null);
        setCellGroup(res.data?.cell_group || null);
      } catch {
        if (!cancelled) setDepartment(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner fullPage />;

  const name = department?.name || user?.department;
  const leader = department
    ? `${department.leader_first_name || ''} ${department.leader_last_name || ''}`.trim()
    : '';

  return (
    <div className="member-page">
      <div className="page-head">
        <p className="member-home-kicker">Church life</p>
        <h1 className="page-title">My department</h1>
        <p className="page-sub">Where you serve in the church family.</p>
      </div>

      {!name ? (
        <EmptyState
          title="No department assigned"
          description="Ask your church admin to place you in a department or ministry."
        />
      ) : (
        <article className="glass-card member-dept-card">
          <div className="member-home-card-head">
            <Network size={20} />
            <h2>{name}</h2>
          </div>
          {department?.description && <p>{department.description}</p>}
          {ministry && <p className="member-home-meta">Ministry: {ministry}</p>}
          {cellGroup && <p className="member-home-meta">Cell group: {cellGroup}</p>}
          {leader && <p className="member-home-meta">Leader: {leader}</p>}
          {department?.member_count != null && (
            <p className="member-home-meta">
              <Users size={14} /> {department.member_count} members
            </p>
          )}
        </article>
      )}

      <Link to="/" className="member-home-link" style={{ marginTop: 16 }}>
        ← Back home
      </Link>
    </div>
  );
}
