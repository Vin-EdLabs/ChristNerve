import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, TextArea } from '../ui/Input';
import { Button } from '../ui/Button';
import type { ChurchMember, GivingType, PaymentMethod } from '../../types';

export type GivingFormValues = {
  member_id: string;
  giving_type: GivingType;
  amount: string;
  payment_method: PaymentMethod;
  mobile_money_ref: string;
  service_date: string;
  notes: string;
};

const GIVING_TYPES = [
  'Tithe',
  'Offering',
  'Building Fund',
  'Thanksgiving',
  'Donation',
  'Mission Fund',
];

const PAYMENT_METHODS = [
  'Cash',
  'MTN Mobile Money',
  'Vodafone Cash',
  'AirtelTigo Money',
  'Bank Transfer',
];

export interface GivingFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: GivingFormValues) => Promise<void> | void;
  members: ChurchMember[];
  loading?: boolean;
}

export const GivingForm: React.FC<GivingFormProps> = ({
  open,
  onClose,
  onSubmit,
  members,
  loading = false,
}) => {
  const [values, setValues] = useState<GivingFormValues>({
    member_id: '',
    giving_type: 'Tithe',
    amount: '',
    payment_method: 'Cash',
    mobile_money_ref: '',
    service_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [error, setError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setMemberSearch('');
      setValues({
        member_id: '',
        giving_type: 'Tithe',
        amount: '',
        payment_method: 'Cash',
        mobile_money_ref: '',
        service_date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
    }
  }, [open]);

  const filtered = members.filter((m) => {
    const q = memberSearch.toLowerCase();
    if (!q) return true;
    return (
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      (m.member_number || '').toLowerCase().includes(q)
    );
  });

  const showRef =
    values.payment_method !== 'Cash' && values.payment_method !== 'Bank Transfer';

  const set =
    (key: keyof GivingFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.member_id) {
      setError('Select a member');
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
      title="Record Giving"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="giving-form" loading={loading}>
            Record Giving
          </Button>
        </>
      }
    >
      <form id="giving-form" onSubmit={handleSubmit}>
        {error && <p className="form-error mb-16">{error}</p>}
        <Input
          label="Search Member"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="Name or member number"
        />
        <Select
          label="Member"
          value={values.member_id}
          onChange={set('member_id')}
          placeholder="Select member"
          options={filtered.map((m) => ({
            value: String(m.id),
            label: `${m.first_name} ${m.last_name}${m.member_number ? ` (${m.member_number})` : ''}`,
          }))}
        />
        <Select
          label="Giving Type"
          value={values.giving_type}
          onChange={set('giving_type')}
          options={GIVING_TYPES.map((t) => ({ value: t, label: t }))}
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
        {showRef && (
          <Input
            label="Mobile Money Reference"
            value={values.mobile_money_ref}
            onChange={set('mobile_money_ref')}
            placeholder="e.g. 4521789630"
          />
        )}
        <Input
          label="Service Date"
          type="date"
          value={values.service_date}
          onChange={set('service_date')}
        />
        <TextArea label="Notes" value={values.notes} onChange={set('notes')} />
      </form>
    </Modal>
  );
};

export default GivingForm;
