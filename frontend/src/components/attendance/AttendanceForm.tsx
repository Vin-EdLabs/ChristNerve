import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, TextArea } from '../ui/Input';
import { Button } from '../ui/Button';
import type { ServiceType } from '../../types';

export type AttendanceFormValues = {
  service_type: ServiceType;
  service_date: string;
  men_count: string;
  women_count: string;
  children_count: string;
  visitors_count: string;
  notes: string;
};

const SERVICE_TYPES = [
  'Sunday Service',
  'Midweek',
  'Prayer Meeting',
  'Youth Service',
  'Special',
];

export interface AttendanceFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AttendanceFormValues & { total_count: number }) => Promise<void> | void;
  loading?: boolean;
}

export const AttendanceForm: React.FC<AttendanceFormProps> = ({
  open,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const [values, setValues] = useState<AttendanceFormValues>({
    service_type: 'Sunday Service',
    service_date: new Date().toISOString().slice(0, 10),
    men_count: '0',
    women_count: '0',
    children_count: '0',
    visitors_count: '0',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      setValues({
        service_type: 'Sunday Service',
        service_date: new Date().toISOString().slice(0, 10),
        men_count: '0',
        women_count: '0',
        children_count: '0',
        visitors_count: '0',
        notes: '',
      });
    }
  }, [open]);

  const total = useMemo(() => {
    return (
      (Number(values.men_count) || 0) +
      (Number(values.women_count) || 0) +
      (Number(values.children_count) || 0) +
      (Number(values.visitors_count) || 0)
    );
  }, [values]);

  const set =
    (key: keyof AttendanceFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ ...values, total_count: total });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Service Attendance"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="attendance-form" loading={loading}>
            Save Attendance
          </Button>
        </>
      }
    >
      <form id="attendance-form" onSubmit={handleSubmit}>
        <Select
          label="Service Type"
          value={values.service_type}
          onChange={set('service_type')}
          options={SERVICE_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <Input
          label="Date"
          type="date"
          value={values.service_date}
          onChange={set('service_date')}
        />
        <div className="form-row">
          <Input
            label="Men"
            type="number"
            min="0"
            value={values.men_count}
            onChange={set('men_count')}
          />
          <Input
            label="Women"
            type="number"
            min="0"
            value={values.women_count}
            onChange={set('women_count')}
          />
        </div>
        <div className="form-row">
          <Input
            label="Children"
            type="number"
            min="0"
            value={values.children_count}
            onChange={set('children_count')}
          />
          <Input
            label="Visitors"
            type="number"
            min="0"
            value={values.visitors_count}
            onChange={set('visitors_count')}
          />
        </div>
        <div className="card mb-16" style={{ padding: 16, background: 'var(--bg-secondary)' }}>
          <span className="text-muted" style={{ fontSize: 13 }}>
            Total (auto-calculated)
          </span>
          <div className="stat-card-value" style={{ fontSize: 32 }}>
            {total}
          </div>
        </div>
        <TextArea label="Notes" value={values.notes} onChange={set('notes')} />
      </form>
    </Modal>
  );
};

export default AttendanceForm;
