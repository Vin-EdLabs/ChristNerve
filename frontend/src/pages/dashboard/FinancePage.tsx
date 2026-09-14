import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGHS } from '../../utils/formatGHS';
import type {
  ChurchGiving,
  ChurchExpense,
  ChurchMember,
  GivingSummary as GivingSummaryType,
} from '../../types';
import { Button } from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { GivingForm } from '../../components/finance/GivingForm';
import type { GivingFormValues } from '../../components/finance/GivingForm';
import { ExpenseForm } from '../../components/finance/ExpenseForm';
import type { ExpenseFormValues } from '../../components/finance/ExpenseForm';
import { useCachedQuery } from '../../utils/useCachedQuery';

type Tab = 'dashboard' | 'income' | 'expenses' | 'reports';

const PIE_COLORS = ['#b4562f', '#7c5cbf', '#2f9a6e', '#e8a33d', '#2f8fa9', '#c0447a'];

function asList<T>(payload: unknown, keys: string[] = ['data']): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

function mapGivingSummary(raw: Record<string, unknown> | null): GivingSummaryType | null {
  if (!raw) return null;
  const byTypeRows = Array.isArray(raw.by_type) ? raw.by_type : [];
  const byType: Record<string, number> = {};
  for (const row of byTypeRows as { giving_type?: string; total?: number }[]) {
    if (row.giving_type) byType[row.giving_type] = Number(row.total || 0);
  }
  if (raw.by_type && !Array.isArray(raw.by_type) && typeof raw.by_type === 'object') {
    Object.assign(byType, raw.by_type as Record<string, number>);
  }
  return {
    total_this_month: Number(raw.this_month_total ?? raw.total_this_month ?? 0),
    tithes: byType.Tithe,
    offerings: byType.Offering,
    building_fund: byType['Building Fund'],
    other:
      Object.entries(byType)
        .filter(([k]) => !['Tithe', 'Offering', 'Building Fund'].includes(k))
        .reduce((s, [, v]) => s + Number(v || 0), 0) || Number(raw.other || 0),
    by_type: byType,
  };
}

type FinancePayload = {
  summary: GivingSummaryType | null;
  giving: ChurchGiving[];
  expenses: ChurchExpense[];
  report: Record<string, unknown> | null;
  members: ChurchMember[];
};

export default function FinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: Tab =
    tabParam === 'expenses' ||
    tabParam === 'income' ||
    tabParam === 'reports' ||
    tabParam === 'dashboard'
      ? (tabParam as Tab)
      : 'dashboard';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [givingOpen, setGivingOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, loading, refetch } = useCachedQuery<FinancePayload>(
    'finance',
    async () => {
      try {
        const [summaryRes, givingRes, expenseRes, reportRes, membersRes] =
          await Promise.allSettled([
            api.get('/finance/giving/summary'),
            api.get('/finance/giving', { params: { limit: 50 } }),
            api.get('/finance/expenses', { params: { limit: 50 } }),
            api.get('/finance/report'),
            api.get('/members', { params: { limit: 100 } }),
          ]);

        return {
          summary:
            summaryRes.status === 'fulfilled'
              ? mapGivingSummary(summaryRes.value.data)
              : null,
          giving:
            givingRes.status === 'fulfilled'
              ? asList<ChurchGiving>(givingRes.value.data, ['data', 'giving'])
              : [],
          expenses:
            expenseRes.status === 'fulfilled'
              ? asList<ChurchExpense>(expenseRes.value.data, ['data', 'expenses'])
              : [],
          report: reportRes.status === 'fulfilled' ? reportRes.value.data : null,
          members:
            membersRes.status === 'fulfilled'
              ? asList<ChurchMember>(membersRes.value.data, ['data', 'members'])
              : [],
        };
      } catch {
        toast.error('Failed to load finance data');
        return { summary: null, giving: [], expenses: [], report: null, members: [] };
      }
    }
  );
  const summary = data?.summary ?? null;
  const giving = data?.giving ?? [];
  const expenses = data?.expenses ?? [];
  const report = data?.report ?? null;
  const members = data?.members ?? [];

  useEffect(() => {
    if (
      tabParam === 'expenses' ||
      tabParam === 'income' ||
      tabParam === 'reports' ||
      tabParam === 'dashboard'
    ) {
      setTab(tabParam as Tab);
    }
  }, [tabParam]);

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next === 'dashboard') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: next });
    }
  };

  const submitGiving = async (data: GivingFormValues) => {
    setSaving(true);
    try {
      const res = await api.post('/finance/giving', {
        member_id: data.member_id ? Number(data.member_id) : null,
        giving_type: data.giving_type,
        amount: Number(data.amount),
        payment_method: data.payment_method,
        mobile_money_ref: data.mobile_money_ref || undefined,
        service_date: data.service_date,
        notes: data.notes || undefined,
      });
      const receipt =
        res.data?.receipt_number || res.data?.data?.receipt_number;
      toast.success(
        receipt
          ? `Income recorded — Receipt #${receipt}`
          : 'Income recorded successfully'
      );
      setGivingOpen(false);
      refetch();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not record income';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const submitExpense = async (data: ExpenseFormValues) => {
    setSaving(true);
    try {
      await api.post('/finance/expenses', {
        category: data.category,
        description: data.description,
        amount: Number(data.amount),
        payment_method: data.payment_method,
        expense_date: data.expense_date,
      });
      toast.success('Expense recorded');
      setExpenseOpen(false);
      refetch();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not record expense';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="finance-page">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const incomeTotal = Number(
    report?.total_income ?? report?.income_total ?? summary?.total_this_month ?? 0
  );
  const expenseTotal = Number(
    report?.total_expenses ?? report?.expense_total ?? 0
  );
  const netBalance = incomeTotal - expenseTotal;
  const monthLabel = new Date().toLocaleDateString('en-GH', {
    month: 'long',
    year: 'numeric',
  });

  let incomeByType: { label: string; total: number }[] = [];
  const rawIncome = report?.income_by_type ?? report?.by_type;
  if (Array.isArray(rawIncome)) {
    incomeByType = (rawIncome as { giving_type?: string; type?: string; total?: number }[]).map(
      (r) => ({ label: r.giving_type || r.type || 'Other', total: Number(r.total || 0) })
    );
  } else if (rawIncome && typeof rawIncome === 'object') {
    incomeByType = Object.entries(rawIncome as Record<string, number>).map(
      ([label, total]) => ({ label, total: Number(total) })
    );
  } else if (summary?.by_type) {
    incomeByType = Object.entries(summary.by_type).map(([label, total]) => ({
      label,
      total: Number(total),
    }));
  }

  let expensesByCategory: { label: string; total: number }[] = [];
  const rawExp = report?.expenses_by_category ?? report?.by_category;
  if (Array.isArray(rawExp)) {
    expensesByCategory = (rawExp as { category?: string; total?: number }[]).map(
      (r) => ({ label: r.category || 'Other', total: Number(r.total || 0) })
    );
  } else if (rawExp && typeof rawExp === 'object') {
    expensesByCategory = Object.entries(rawExp as Record<string, number>).map(
      ([label, total]) => ({ label, total: Number(total) })
    );
  }

  return (
    <div className="finance-page">
      <div className="page-head finance-hero glass-card">
        <div>
          <h1 className="page-title">Church Treasury · {monthLabel}</h1>
          <p className="page-sub">
            Income and expenses — clear and separate.
          </p>
        </div>
        <div className="finance-treasury-stats">
          <div>
            <span>Total Income</span>
            <strong className="mono">{formatGHS(incomeTotal)}</strong>
          </div>
          <div>
            <span>Total Expenses</span>
            <strong className="mono">{formatGHS(expenseTotal)}</strong>
          </div>
          <div>
            <span>Net Balance</span>
            <strong className="mono">
              {formatGHS(netBalance)}
              {netBalance >= 0 ? ' ✓' : ''}
            </strong>
          </div>
        </div>
      </div>

      <div className="page-tabs finance-tabs">
        {(
          [
            ['dashboard', 'Overview'],
            ['income', 'Income'],
            ['expenses', 'Expenses'],
            ['reports', 'Reports'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`page-tab${tab === key ? ' active' : ''}`}
            onClick={() => selectTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="finance-dashboard-shell">
            <div className="finance-hero-metrics">
              <div className="finance-metric-card">
                <span>Income</span>
                <strong>{formatGHS(incomeTotal)}</strong>
              </div>
              <div className="finance-metric-card">
                <span>Expenses</span>
                <strong>{formatGHS(expenseTotal)}</strong>
              </div>
              <div className="finance-metric-card finance-metric-card--accent">
                <span>Net</span>
                <strong>{formatGHS(netBalance)}</strong>
              </div>
            </div>

            <div className="finance-chart-grid">
              <section className="glass-card finance-chart-card">
                <div className="finance-chart-head">
                  <div>
                    <p className="finance-section-eyebrow">Income vs. Expenses</p>
                    <h3 className="finance-chart-title">This month at a glance</h3>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[{ label: monthLabel, Income: incomeTotal, Expenses: expenseTotal }]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatGHS(v)} />
                    <Legend />
                    <Bar dataKey="Income" fill="#2f9a6e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#b4562f" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            </div>

            <div className="finance-section-grid">
              <section className="glass-card finance-section-card">
                <div className="finance-section-card-head">
                  <p className="finance-section-eyebrow">Income</p>
                  <h3 className="finance-detail-title">{formatGHS(incomeTotal)}</h3>
                  <Button variant="outline" size="sm" onClick={() => setGivingOpen(true)}>
                    <Plus size={14} /> Record Income
                  </Button>
                </div>
                {incomeByType.length === 0 ? (
                  <p className="finance-card-copy">No income recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={incomeByType}
                        dataKey="total"
                        nameKey="label"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {incomeByType.map((entry, i) => (
                          <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatGHS(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </section>

              <section className="glass-card finance-section-card">
                <div className="finance-section-card-head">
                  <p className="finance-section-eyebrow">Expenses</p>
                  <h3 className="finance-detail-title">{formatGHS(expenseTotal)}</h3>
                  <Button variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
                    <Plus size={14} /> Record Expense
                  </Button>
                </div>
                {expensesByCategory.length === 0 ? (
                  <p className="finance-card-copy">No expenses recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={expensesByCategory}
                        dataKey="total"
                        nameKey="label"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {expensesByCategory.map((entry, i) => (
                          <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatGHS(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      {tab === 'income' && (
        <>
          <div className="finance-toolbar">
            <h2 className="page-heading">Income</h2>
            <Button variant="primary" onClick={() => setGivingOpen(true)}>
              <Plus size={16} /> Record Income
            </Button>
          </div>
          <div className="finance-detail-grid">
            <section className="glass-card finance-detail-card">
              <p className="finance-section-eyebrow">This month</p>
              <h3 className="finance-detail-title">{formatGHS(incomeTotal)}</h3>
              <p className="finance-card-copy">Total received across tithe, offering, and other income.</p>
            </section>
            <section className="glass-card finance-detail-card">
              <p className="finance-section-eyebrow">By type</p>
              <ul className="finance-mini-list">
                {incomeByType.length === 0 ? (
                  <li><span>No income yet</span></li>
                ) : incomeByType.map((r) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <strong>{formatGHS(r.total)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <section className="card glass-card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {giving.slice(0, 12).map((g) => (
                    <tr key={g.id}>
                      <td>{g.member_name || (g.first_name ? `${g.first_name} ${g.last_name || ''}` : g.giving_type)}</td>
                      <td>{g.giving_type}</td>
                      <td>{formatGHS(Number(g.amount))}</td>
                      <td>{g.payment_method || '—'}</td>
                      <td>{g.service_date ? new Date(g.service_date).toLocaleDateString('en-GH') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'expenses' && (
        <>
          <div className="finance-toolbar">
            <h2 className="page-heading">Expenses</h2>
            <Button variant="primary" onClick={() => setExpenseOpen(true)}>
              <Plus size={16} />
              Record Expense
            </Button>
          </div>
          <div className="finance-detail-grid">
            <section className="glass-card finance-detail-card">
              <p className="finance-section-eyebrow">Outflow</p>
              <h3 className="finance-detail-title">{formatGHS(expenseTotal)}</h3>
              <p className="finance-card-copy">Current spending across ministry operations and events.</p>
            </section>
            <section className="glass-card finance-detail-card">
              <p className="finance-section-eyebrow">Categories</p>
              <ul className="finance-mini-list">
                {expensesByCategory.length === 0 ? (
                  <li><span>No expenses yet</span></li>
                ) : expensesByCategory.map((r) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <strong>{formatGHS(r.total)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <section className="card glass-card">
            {expenses.length === 0 ? (
              <EmptyState
                title="No expenses recorded."
                actionLabel="Record Expense"
                onAction={() => setExpenseOpen(true)}
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td>{e.category}</td>
                        <td>{e.description}</td>
                        <td>{formatGHS(Number(e.amount))}</td>
                        <td>{e.payment_method || '—'}</td>
                        <td>
                          {e.expense_date
                            ? new Date(e.expense_date).toLocaleDateString('en-GH')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'reports' && (
        <>
          <div className="finance-toolbar">
            <h2 className="page-heading">Reports</h2>
          </div>

          <div className="finance-hero-metrics">
            <div className="finance-metric-card">
              <span>Income</span>
              <strong>{formatGHS(incomeTotal)}</strong>
            </div>
            <div className="finance-metric-card">
              <span>Expenses</span>
              <strong>{formatGHS(expenseTotal)}</strong>
            </div>
            <div className="finance-metric-card finance-metric-card--accent">
              <span>Net Balance</span>
              <strong>{formatGHS(netBalance)}</strong>
            </div>
          </div>

          <div className="finance-chart-grid">
            <section className="glass-card finance-chart-card">
              <div className="finance-chart-head">
                <div>
                  <p className="finance-section-eyebrow">Income vs. Expenses</p>
                  <h3 className="finance-chart-title">{monthLabel}</h3>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[{ label: monthLabel, Income: incomeTotal, Expenses: expenseTotal }]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatGHS(v)} />
                  <Legend />
                  <Bar dataKey="Income" fill="#2f9a6e" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#b4562f" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <div className="finance-section-grid">
            <section className="glass-card finance-section-card">
              <p className="finance-section-eyebrow">Income by type</p>
              {incomeByType.length === 0 ? (
                <p className="finance-card-copy">No income recorded yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={incomeByType}
                      dataKey="total"
                      nameKey="label"
                      innerRadius={45}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {incomeByType.map((entry, i) => (
                        <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatGHS(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="glass-card finance-section-card">
              <p className="finance-section-eyebrow">Expenses by category</p>
              {expensesByCategory.length === 0 ? (
                <p className="finance-card-copy">No expenses recorded yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      dataKey="total"
                      nameKey="label"
                      innerRadius={45}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {expensesByCategory.map((entry, i) => (
                        <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatGHS(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>
        </>
      )}

      <GivingForm
        open={givingOpen}
        onClose={() => !saving && setGivingOpen(false)}
        members={members}
        onSubmit={submitGiving}
        loading={saving}
      />

      <ExpenseForm
        open={expenseOpen}
        onClose={() => !saving && setExpenseOpen(false)}
        onSubmit={submitExpense}
        loading={saving}
      />

      <style>{`
        .finance-page { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 1100px; margin: 0 auto; }
        .finance-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px;
          flex-wrap: wrap;
        }
        .finance-treasury-stats {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }
        .finance-treasury-stats > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 110px;
        }
        .finance-treasury-stats span {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .finance-treasury-stats strong {
          font-size: 20px;
        }
        .finance-hero-net {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .finance-hero-net span {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .finance-hero-net strong {
          font-family: var(--font-display);
          font-size: 28px;
        }
        .finance-mini-list {
          list-style: none;
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .finance-mini-list li {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
        }
        .finance-tabs {
          margin-top: -4px;
        }
        .finance-dashboard-shell {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .finance-chart-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .finance-chart-card { padding: 18px; }
        .finance-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .finance-chart-title { margin: 0; font-family: var(--font-display); font-size: 18px; font-weight: 600; }
        .finance-section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .finance-section-card { padding: 18px; display: flex; flex-direction: column; gap: 10px; }
        .finance-section-card-head { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
        .finance-section-eyebrow {
          margin: 0 0 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .finance-hero-metrics {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .finance-metric-card {
          min-width: 110px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.62);
          border: 1px solid rgba(0,0,0,0.06);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .finance-metric-card span {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .finance-metric-card strong {
          font-size: 16px;
          font-family: var(--font-mono);
        }
        .finance-metric-card--accent {
          background: rgba(180, 90, 40, 0.16);
        }
        .finance-card-copy {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }
        .finance-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .finance-detail-card {
          padding: 16px 18px;
        }
        .finance-detail-title {
          margin: 0 0 6px;
          font-size: 24px;
          font-family: var(--font-mono);
        }
        .finance-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .page-heading {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 600;
        }
        .table-wrap { overflow-x: auto; }
        .mono { font-family: var(--font-mono); font-size: 13px; }
        @media (max-width: 720px) {
          .finance-detail-grid,
          .finance-section-grid {
            grid-template-columns: 1fr;
          }
          .finance-hero {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
