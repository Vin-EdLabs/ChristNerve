import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, TextArea } from '../ui/Input';
import { Button } from '../ui/Button';
import type { PaymentMethod } from '../../types';

export type ExpenseFormValues = {
  category: string;
  description: string;
  amount: string;
  payment_method: PaymentMethod;
  expense_date: string;
};

const CATEGORIES = [
  'Utilities',
  'Transport',
  'Stationery',
  'Maintenance',
  'Salaries',
  'Events',
  'Other',
];

const PAYMENT_METHODS = [
  'Cash',
  'MTN Mobile Money',
  'Vodafone Cash',
  'AirtelTigo Money',
  'Bank Transfer',
];

export interface ExpenseFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ExpenseFormValues) => Promise<void> | void;
  loading?: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  open,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const [values, setValues] = useState<ExpenseFormValues>({
    category: 'Utilities',
    description: '',
    amount: '',
    payment_method: 'Cash',
    expense_date: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setValues({
        category: 'Utilities',
        description: '',
        amount: '',
        payment_method: 'Cash',
        expense_date: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open]);

  const set =
    (key: keyof ExpenseFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.description.trim()) {
      setError('Description is required');
      return;
    }
    if (!values.amount || Number(values.amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setError('');
    await onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Expense"
      subtitle="Fill in the details below"
      footer={
        <>
          <Button variant="primary" type="submit" form="expense-form" loading={loading}>
            Add Expense
          </Button>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit}>
        {error && <p className="form-error mb-16">{error}</p>}
        <Select
          label="Category"
          value={values.category}
          onChange={set('category')}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <TextArea
          label="Description"
          value={values.description}
          onChange={set('description')}
          required
        />
        <Input
          label="Amount (GHS)"
          type="number"
          min="0"
          step="0.01"
          value={values.amount}
          onChange={set('amount')}
          required
        />
        <Select
          label="Payment Method"
          value={values.payment_method}
          onChange={set('payment_method')}
          options={PAYMENT_METHODS.map((t) => ({ value: t, label: t }))}
        />
        <Input
          label="Expense Date"
          type="date"
          value={values.expense_date}
          onChange={set('expense_date')}
        />
      </form>
    </Modal>
  );
};

export default ExpenseForm;
