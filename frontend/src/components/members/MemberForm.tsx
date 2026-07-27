import React, { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input, Select, TextArea } from '../ui/Input';
import { Button } from '../ui/Button';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import api from '../../services/api';
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
  department_ids: number[];
  ministry: string;
  cell_group: string;
  membership_status: MembershipStatus | string;
  membership_date: string;
  baptism_date: string;
  avatar_url?: string;
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
  department_ids: [],
  ministry: '',
  cell_group: '',
  membership_status: 'active',
  membership_date: '',
  baptism_date: '',
  avatar_url: '',
};

export interface MemberFormProps {
  /** When inline, form renders on the page (no popup). */
  variant?: 'modal' | 'inline';
  open?: boolean;
  onClose?: () => void;
  onSubmit: (
    values: MemberFormValues,
    avatarFile?: File | null
  ) => Promise<void> | void;
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
  const [preview, setPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [deptOptions, setDeptOptions] = useState<{ id: number; name: string }[]>(
    []
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/departments');
        const rows = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];
        if (!cancelled) {
          setDeptOptions(
            rows.map((d: { id: number; name: string }) => ({
              id: d.id,
              name: d.name,
            }))
          );
        }
      } catch {
        if (!cancelled) setDeptOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (variant === 'modal' && !open) return;
    if (member) {
      const ids = Array.isArray(
        (member as ChurchMember & { department_ids?: number[] }).department_ids
      )
        ? (member as ChurchMember & { department_ids?: number[] }).department_ids!
        : [];
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
        department_ids: ids,
        ministry: member.ministry || '',
        cell_group: member.cell_group || '',
        membership_status: member.membership_status || 'active',
        membership_date: member.membership_date?.slice(0, 10) || '',
        baptism_date: member.baptism_date?.slice(0, 10) || '',
        avatar_url: member.avatar_url || '',
      });
      setPreview(resolveMediaUrl(member.avatar_url));
    } else {
      setValues(EMPTY);
      setPreview('');
    }
    setAvatarFile(null);
    setError('');
  }, [open, member, variant]);

  useEffect(() => {
    return () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const set =
    (key: keyof MemberFormValues) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
    };

  const toggleDept = (id: number) => {
    setValues((v) => {
      const has = v.department_ids.includes(id);
      const department_ids = has
        ? v.department_ids.filter((x) => x !== id)
        : [...v.department_ids, id];
      return { ...v, department_ids };
    });
  };

  const onPickPhoto = (file: File | null) => {
    if (!file) return;
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.first_name.trim() || !values.last_name.trim()) {
      setError('First and last name are required');
      return;
    }
    const digits = values.phone.replace(/\D/g, '');
    let phone = digits;
    if (phone.startsWith('233') && phone.length >= 12) phone = `0${phone.slice(3)}`;
    else if (phone.length === 9) phone = `0${phone}`;
    if (!/^0\d{9}$/.test(phone)) {
      setError('Login phone must start with 0 (e.g. 0244123456)');
      return;
    }
    let whatsapp = values.whatsapp.trim();
    if (whatsapp) {
      const w = whatsapp.replace(/\D/g, '');
      let wn = w;
      if (wn.startsWith('233') && wn.length >= 12) wn = `0${wn.slice(3)}`;
      else if (wn.length === 9) wn = `0${wn}`;
      if (!/^0\d{9}$/.test(wn)) {
        setError('WhatsApp must start with 0 (e.g. 0244123456)');
        return;
      }
      whatsapp = wn;
    } else {
      whatsapp = phone;
    }
    setError('');
    await onSubmit({ ...values, phone, whatsapp }, avatarFile);
  };

  const initials =
    `${values.first_name?.[0] || ''}${values.last_name?.[0] || ''}`.toUpperCase() ||
    '?';

  const fields = (
    <form id="member-form" className="member-form-fields" onSubmit={handleSubmit}>
      {error && <p className="form-error mb-16">{error}</p>}

      <div className="member-photo-picker">
        <button
          type="button"
          className="member-photo-btn"
          onClick={() => fileRef.current?.click()}
          aria-label="Choose profile photo"
        >
          {preview ? (
            <img src={preview} alt="" className="member-photo-img" />
          ) : (
            <span className="member-photo-fallback">{initials}</span>
          )}
          <span className="member-photo-overlay">
            <Camera size={18} />
          </span>
        </button>
        <div className="member-photo-meta">
          <strong>Profile photo</strong>
          <p>JPEG, PNG, or WebP — looks great on lists and the marketplace.</p>
          <button
            type="button"
            className="member-photo-link"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? 'Change photo' : 'Add photo'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            onPickPhoto(e.target.files?.[0] || null);
            e.target.value = '';
          }}
        />
      </div>

      <div className="form-row">
        <Input label="First Name" value={values.first_name} onChange={set('first_name')} required />
        <Input label="Last Name" value={values.last_name} onChange={set('last_name')} required />
      </div>
      <Input label="Other Names" value={values.other_names} onChange={set('other_names')} />
      <div className="form-row">
        <Input label="Email" type="email" value={values.email} onChange={set('email')} />
        <Input
          label="Login phone"
          value={values.phone}
          onChange={set('phone')}
          placeholder="0244 123 456"
          required
          hint="Used to sign in with PIN"
        />
      </div>
      <Input
        label="WhatsApp number"
        value={values.whatsapp}
        onChange={set('whatsapp')}
        placeholder="Same as login phone is fine"
        hint="Shown to buyers for marketplace orders"
      />
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

      <div className="member-dept-picker">
        <label className="label">Departments</label>
        <p className="settings-hint" style={{ marginBottom: 8 }}>
          A member can belong to more than one department.
        </p>
        {deptOptions.length === 0 ? (
          <p className="settings-hint">
            No departments yet — create them under Departments first.
          </p>
        ) : (
          <div className="member-dept-checks">
            {deptOptions.map((d) => (
              <label key={d.id} className="member-dept-check">
                <input
                  type="checkbox"
                  checked={values.department_ids.includes(d.id)}
                  onChange={() => toggleDept(d.id)}
                />
                <span>{d.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="form-row">
        <Input label="Ministry" value={values.ministry} onChange={set('ministry')} />
        <Input label="Cell Group" value={values.cell_group} onChange={set('cell_group')} />
      </div>
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

      <style>{`
        .member-dept-checks {
          display: flex; flex-wrap: wrap; gap: 8px;
        }
        .member-dept-check {
          display: inline-flex; align-items: center; gap: 8px;
          border: 1px solid var(--border, #e8e4dc); border-radius: 999px;
          padding: 8px 12px; font-size: 13px; background: #fff; cursor: pointer;
        }
        .member-dept-check input { accent-color: var(--accent, #2d1b69); }
      `}</style>
    </form>
  );

  if (variant === 'inline') {
    return <div className="member-form-inline card">{fields}</div>;
  }

  return (
    <Modal
      open={!!open}
      onClose={onClose || (() => undefined)}
      title={member ? 'Edit Member' : 'Add New Member'}
      subtitle="Fill in the details below"
      size="lg"
      footer={
        <>
          <Button variant="primary" type="submit" form="member-form" loading={loading}>
            {member ? 'Save Changes' : 'Add Member'}
          </Button>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {fields}
    </Modal>
  );
};

export default MemberForm;
