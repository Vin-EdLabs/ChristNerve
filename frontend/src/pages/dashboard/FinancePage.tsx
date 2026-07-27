import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
import { GivingSummary } from '../../components/finance/GivingSummary';

type Tab = 'dashboard' | 'tithes' | 'offerings' | 'other' | 'expenses';

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

export default function FinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: Tab =
    tabParam === 'expenses' ||
    tabParam === 'tithes' ||
    tabParam === 'offerings' ||
    tabParam === 'other' ||
    tabParam === 'dashboard'
      ? tabParam
      : 'dashboard';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<GivingSummaryType | null>(null);
  const [giving, setGiving] = useState<ChurchGiving[]>([]);
  const [expenses, setExpenses] = useState<ChurchExpense[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [givingOpen, setGivingOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, givingRes, expenseRes, reportRes, membersRes] =
        await Promise.allSettled([
          api.get('/finance/giving/summary'),
          api.get('/finance/giving', { params: { limit: 50 } }),
          api.get('/finance/expenses', { params: { limit: 50 } }),
          api.get('/finance/report'),
          api.get('/members', { params: { limit: 100 } }),
        ]);

      if (summaryRes.status === 'fulfilled') {
        setSummary(mapGivingSummary(summaryRes.value.data));
      }
      if (givingRes.status === 'fulfilled') {
        setGiving(asList<ChurchGiving>(givingRes.value.data, ['data', 'giving']));
      }
      if (expenseRes.status === 'fulfilled') {
        setExpenses(
          asList<ChurchExpense>(expenseRes.value.data, ['data', 'expenses'])
        );
      }
      if (reportRes.status === 'fulfilled') setReport(reportRes.value.data);
      if (membersRes.status === 'fulfilled') {
        setMembers(
          asList<ChurchMember>(membersRes.value.data, ['data', 'members'])
        );
      }
    } catch {
      toast.error('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (
      tabParam === 'expenses' ||
      tabParam === 'tithes' ||
      tabParam === 'offerings' ||
      tabParam === 'other' ||
      tabParam === 'dashboard'
    ) {
      setTab(tabParam);
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
          ? `Giving recorded â€” Receipt #${receipt}`
          : 'Giving recorded successfully'
      );
      setGivingOpen(false);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not record giving';
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
      await load();
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
            Tithes, offerings, other income, and expenses — clear and separate.
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

      <div className="page-tabs">
        {(
          [
            ['dashboard', 'Dashboard'],
            ['tithes', 'Tithes'],
            ['offerings', 'Offerings'],
            ['other', 'Other'],
            ['expenses', 'Expenses'],
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
          <GivingSummary summary={summary} />
          <div className="stats-row mb-24">
            <div className="stat-card glass-card">
              <span className="stat-card-label">Income</span>
              <div className="stat-card-value" style={{ fontSize: 22 }}>
                {formatGHS(incomeTotal)}
              </div>
              <span className="stat-card-sub">All giving types</span>
            </div>
            <div className="stat-card glass-card">
              <span className="stat-card-label">Expenses</span>
              <div className="stat-card-value" style={{ fontSize: 22 }}>
                {formatGHS(expenseTotal)}
              </div>
              <span className="stat-card-sub">Outflow</span>
            </div>
            <div className="stat-card glass-card">
              <span className="stat-card-label">By type</span>
              <ul className="finance-mini-list">
                {incomeByType.slice(0, 4).map((r) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <strong>{formatGHS(r.total)}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className="stat-card glass-card">
              <span className="stat-card-label">Expense categories</span>
              <ul className="finance-mini-list">
                {expensesByCategory.slice(0, 4).map((r) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <strong>{formatGHS(r.total)}</strong>
                  </li>
                ))}
                {expensesByCategory.length === 0 && (
                  <li>
                    <span>No expenses yet</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="finance-toolbar">
            <h2 className="page-heading">Quick actions</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="primary" onClick={() => setGivingOpen(true)}>
                <Plus size={16} /> Record Giving
              </Button>
              <Button variant="outline" onClick={() => setExpenseOpen(true)}>
                <Plus size={16} /> Record Expense
              </Button>
            </div>
          </div>
        </>
      )}

      {(tab === 'tithes' || tab === 'offerings' || tab === 'other') && (
        <>
          <div className="finance-toolbar">
            <h2 className="page-heading">
              {tab === 'tithes'
                ? 'Tithes'
                : tab === 'offerings'
                  ? 'Offerings'
                  : 'Other giving'}
            </h2>
            <Button variant="primary" onClick={() => setGivingOpen(true)}>
              <Plus size={16} />
              Record Giving
            </Button>
          </div>
          <section className="card glass-card">
            {giving.filter((g) => {
              const t = String(g.giving_type || '');
              if (tab === 'tithes') return t === 'Tithe';
              if (tab === 'offerings') return t === 'Offering';
              return t !== 'Tithe' && t !== 'Offering';
            }).length === 0 ? (
              <EmptyState
                title={`No ${tab} recorded yet.`}
                actionLabel="Record Giving"
                onAction={() => setGivingOpen(true)}
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Date</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {giving
                      .filter((g) => {
                        const t = String(g.giving_type || '');
                        if (tab === 'tithes') return t === 'Tithe';
                        if (tab === 'offerings') return t === 'Offering';
                        return t !== 'Tithe' && t !== 'Offering';
                      })
                      .map((g) => (
                        <tr key={g.id}>
                          <td>
                            {g.member_name ||
                              (g.first_name
                                ? `${g.first_name} ${g.last_name || ''}`
                                : g.member_id
                                  ? `Member #${g.member_id}`
                                  : 'Anonymous')}
                          </td>
                          <td>{g.giving_type}</td>
                          <td>{formatGHS(Number(g.amount))}</td>
                          <td>{g.payment_method || 'â€”'}</td>
                          <td>
                            {g.service_date
                              ? new Date(g.service_date).toLocaleDateString('en-GH')
                              : 'â€”'}
                          </td>
                          <td>{g.receipt_number || 'â€”'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
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
                        <td>{e.payment_method || 'â€”'}</td>
                        <td>
                          {e.expense_date
                            ? new Date(e.expense_date).toLocaleDateString('en-GH')
                            : 'â€”'}
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
      `}</style>
    </div>
  );
}
