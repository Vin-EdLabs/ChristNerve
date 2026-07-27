import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, TextArea } from '../ui/Input';
import { Button } from '../ui/Button';
import type { ChurchMember, MembershipStatus } from '../../types';

export type MemberFormValues = {
  first_name: string;
  last_name: string;
  other_names: string;
  email: string;
  phone: string;
  whatsapp: string;
  gender: string;
  date_of_birth: string;
  marital_status: string;
  occupation: string;
  address: string;
  city: string;
  department: string;
  ministry: string;
  cell_group: string;
  membership_status: MembershipStatus | string;
  membership_date: string;
  baptism_date: string;
};

const EMPTY: MemberFormValues = {
  first_name: '',
  last_name: '',
  other_names: '',
  email: '',
  phone: '',
  whatsapp: '',
  gender: '',
  date_of_birth: '',
  marital_status: '',
  occupation: '',
  address: '',
  city: '',
  department: '',
  ministry: '',
  cell_group: '',
  membership_status: 'active',
  membership_date: '',
  baptism_date: '',
};

export interface MemberFormProps {
  /** When inline, form renders on the page (no popup). */
  variant?: 'modal' | 'inline';
  open?: boolean;
  onClose?: () => void;
  onSubmit: (values: MemberFormValues) => Promise<void> | void;
  member?: ChurchMember | null;
  loading?: boolean;
}

export const MemberForm: React.FC<MemberFormProps> = ({
  variant = 'modal',
  open = true,
  onClose,
  onSubmit,
  member,
  loading = false,
}) => {
  const [values, setValues] = useState<MemberFormValues>(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (variant === 'modal' && !open) return;
    if (member) {
      setValues({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        other_names: member.other_names || '',
        email: member.email || '',
        phone: member.phone || '',
        whatsapp: member.whatsapp || '',
        gender: member.gender || '',
        date_of_birth: member.date_of_birth?.slice(0, 10) || '',
        marital_status: member.marital_status || '',
        occupation: member.occupation || '',
        address: member.address || '',
        city: member.city || '',
        department: member.department || '',
        ministry: member.ministry || '',
        cell_group: member.cell_group || '',
        membership_status: member.membership_status || 'active',
        membership_date: member.membership_date?.slice(0, 10) || '',
        baptism_date: member.baptism_date?.slice(0, 10) || '',
      });
    } else {
      setValues(EMPTY);
    }
    setError('');
  }, [open, member, variant]);

  const set =
    (key: keyof MemberFormValues) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.first_name.trim() || !values.last_name.trim()) {
      setError('First and last name are required');
      return;
    }
    setError('');
    await onSubmit(values);
  };

  const fields = (
    <form id="member-form" className="member-form-fields" onSubmit={handleSubmit}>
      {error && <p className="form-error mb-16">{error}</p>}
      <div className="form-row">
        <Input label="First Name" value={values.first_name} onChange={set('first_name')} required />
        <Input label="Last Name" value={values.last_name} onChange={set('last_name')} required />
      </div>
      <Input label="Other Names" value={values.other_names} onChange={set('other_names')} />
      <div className="form-row">
        <Input label="Email" type="email" value={values.email} onChange={set('email')} />
        <Input label="Phone" value={values.phone} onChange={set('phone')} placeholder="0244 123 456" />
      </div>
      <Input label="WhatsApp" value={values.whatsapp} onChange={set('whatsapp')} />
      <div className="form-row">
        <Select
          label="Gender"
          value={values.gender}
          onChange={set('gender')}
          placeholder="Select"
          options={[
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
          ]}
        />
        <Input
          label="Date of Birth"
          type="date"
          value={values.date_of_birth}
          onChange={set('date_of_birth')}
        />
      </div>
      <div className="form-row">
        <Select
          label="Marital Status"
          value={values.marital_status}
          onChange={set('marital_status')}
          placeholder="Select"
          options={[
            { value: 'Single', label: 'Single' },
            { value: 'Married', label: 'Married' },
            { value: 'Widowed', label: 'Widowed' },
            { value: 'Divorced', label: 'Divorced' },
          ]}
        />
        <Input label="Occupation" value={values.occupation} onChange={set('occupation')} />
      </div>
      <TextArea label="Address" value={values.address} onChange={set('address')} />
      <Input label="City" value={values.city} onChange={set('city')} placeholder="Kumasi" />
      <div className="form-row">
        <Input label="Department" value={values.department} onChange={set('department')} />
        <Input label="Ministry" value={values.ministry} onChange={set('ministry')} />
      </div>
      <Input label="Cell Group" value={values.cell_group} onChange={set('cell_group')} />
      <div className="form-row">
        <Select
          label="Membership Status"
          value={values.membership_status}
          onChange={set('membership_status')}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'visitor', label: 'Visitor' },
            { value: 'transferred', label: 'Transferred' },
          ]}
        />
        <Input
          label="Membership Date"
          type="date"
          value={values.membership_date}
          onChange={set('membership_date')}
        />
      </div>
      <Input
        label="Baptism Date"
        type="date"
        value={values.baptism_date}
        onChange={set('baptism_date')}
      />

      {variant === 'inline' && (
        <div className="member-form-actions">
          {onClose && (
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button variant="primary" type="submit" loading={loading}>
            {member ? 'Save Changes' : 'Add Member'}
          </Button>
        </div>
      )}
    </form>
  );

  if (variant === 'inline') {
    return <div className="member-form-inline card">{fields}</div>;
  }

  return (
    <Modal
      open={!!open}
      onClose={onClose || (() => undefined)}
      title={member ? 'Edit Member' : 'Add Member'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="member-form" loading={loading}>
            {member ? 'Save Changes' : 'Add Member'}
          </Button>
        </>
      }
    >
      {fields}
    </Modal>
  );
};

export default MemberForm;
