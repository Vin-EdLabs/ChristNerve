import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ImagePlus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { MarketCategory, ChurchMember } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonCard } from '../../components/ui/SkeletonCard';

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.members)) return obj.members as T[];
  }
  return [];
}

type PreviewFile = { file: File; url: string };

export default function CreateListingPage() {
  const navigate = useNavigate();
  const { user, accountType } = useAuth();
  const isMember = accountType === 'member';
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [photos, setPhotos] = useState<PreviewFile[]>([]);
  const [form, setForm] = useState({
    member_id: '',
    category_id: '',
    title: '',
    description: '',
    price_min: '',
    price_max: '',
    price_label: '',
    location: '',
    whatsapp: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const catRes = await api.get('/market/categories');
        if (cancelled) return;
        const cats = asList<MarketCategory>(catRes.data);
        setCategories(cats);

        if (isMember) {
          setForm((f) => ({
            ...f,
            category_id: cats[0]?.id ? String(cats[0].id) : '',
            member_id: user?.id ? String(user.id) : '',
            whatsapp:
              (user as { whatsapp?: string; phone?: string })?.whatsapp ||
              (user as { phone?: string })?.phone ||
              '',
            location: 'Kumasi',
          }));
        } else {
          const membersRes = await api.get('/members', {
            params: { limit: 100, status: 'active' },
          });
          if (cancelled) return;
          const mems = asList<ChurchMember>(membersRes.data);
          setMembers(mems);
          setForm((f) => ({
            ...f,
            category_id: cats[0]?.id ? String(cats[0].id) : '',
            member_id: mems[0]?.id ? String(mems[0].id) : '',
            whatsapp: mems[0]?.whatsapp || mems[0]?.phone || '',
            location: mems[0]?.city || 'Kumasi',
          }));
        }
      } catch {
        toast.error('Failed to load form data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMember, user?.id]);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [photos]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next: PreviewFile[] = [];
    Array.from(list).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (photos.length + next.length >= 5) return;
      next.push({ file, url: URL.createObjectURL(file) });
    });
    if (next.length === 0) {
      toast.error('Add JPEG, PNG, or WebP images (max 5)');
      return;
    }
    setPhotos((prev) => [...prev, ...next].slice(0, 5));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].url);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.category_id) {
      toast.error('Title and category are required');
      return;
    }
    if (!isMember && !form.member_id) {
      toast.error('Select a member / seller');
      return;
    }
    if (!form.whatsapp.trim()) {
      toast.error('WhatsApp number is required');
      return;
    }
    if (!form.description.trim()) {
      toast.error('Description is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        member_id: isMember ? undefined : Number(form.member_id),
        category_id: Number(form.category_id),
        title: form.title.trim(),
        description: form.description.trim(),
        price_min: form.price_min ? Number(form.price_min) : null,
        price_max: form.price_max ? Number(form.price_max) : null,
        price_label: form.price_label.trim() || undefined,
        location: form.location.trim() || undefined,
        whatsapp: form.whatsapp.trim(),
      };
      const created = await api.post('/market/listings', payload);
      const listingId = created.data?.id;

      if (listingId && photos.length > 0) {
        const fd = new FormData();
        photos.forEach((p) => fd.append('images', p.file));
        // Let the browser set multipart boundary — do not force Content-Type
        await api.post(`/market/listings/${listingId}/images`, fd);
      }

      toast.success('Your listing is now live');
      navigate('/market/my-listings');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not create listing';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="create-listing">
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="create-listing">
      <h2 className="page-heading">Create Listing</h2>
      <form className="card create-form" onSubmit={handleSubmit}>
        {!isMember && (
          <>
            <label className="label">Member / Seller</label>
            <select
              className="input"
              value={form.member_id}
              onChange={(e) => {
                const id = e.target.value;
                const member = members.find((m) => String(m.id) === id);
                setForm((f) => ({
                  ...f,
                  member_id: id,
                  whatsapp: member?.whatsapp || member?.phone || f.whatsapp,
                  location: member?.city || f.location,
                }));
              }}
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                  {m.member_number ? ` (${m.member_number})` : ''}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="label">Category</label>
        <select
          className="input"
          value={form.category_id}
          onChange={(e) =>
            setForm((f) => ({ ...f, category_id: e.target.value }))
          }
          required
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <Input
          label="Title"
          value={form.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm((f) => ({ ...f, title: e.target.value }))
          }
          placeholder="Akosua's Kente Boutique"
          required
        />

        <label className="label">Description</label>
        <textarea
          className="input"
          rows={4}
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          placeholder="Handwoven kente cloth, ready-to-wear, and custom orders in Kumasi."
          required
        />

        <div className="create-grid">
          <Input
            label="Min Price (GHS)"
            type="number"
            min="0"
            step="0.01"
            value={form.price_min}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, price_min: e.target.value }))
            }
            placeholder="80"
          />
          <Input
            label="Max Price (GHS)"
            type="number"
            min="0"
            step="0.01"
            value={form.price_max}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, price_max: e.target.value }))
            }
            placeholder="350"
          />
        </div>

        <Input
          label="Price Label (optional)"
          value={form.price_label}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm((f) => ({ ...f, price_label: e.target.value }))
          }
          placeholder="From GHS 50"
        />

        <div className="create-grid">
          <Input
            label="Location"
            value={form.location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
            placeholder="Kumasi"
          />
          <Input
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, whatsapp: e.target.value }))
            }
            placeholder="0244123456"
            required
          />
        </div>

        <div className="photo-block">
          <label className="label">Product photos</label>
          <p className="photo-hint">
            Add up to 5 photos from your gallery, camera, or files (JPEG, PNG, WebP).
          </p>
          <div className="photo-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus size={16} />
              Gallery
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera size={16} />
              Camera
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => filesRef.current?.click()}
            >
              <Upload size={16} />
              Files
            </Button>
          </div>
          <input
            ref={galleryRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={filesRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {photos.length > 0 && (
            <div className="photo-grid">
              {photos.map((p, i) => (
                <div key={p.url} className="photo-thumb">
                  <img src={p.url} alt="" />
                  <button
                    type="button"
                    className="photo-remove"
                    aria-label="Remove photo"
                    onClick={() => removePhoto(i)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/market/my-listings')}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Publish Listing
          </Button>
        </div>
      </form>

      <style>{`
        .create-listing { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 720px; margin: 0 auto; }
        .page-heading {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
        }
        .create-form { display: flex; flex-direction: column; gap: 14px; }
        .create-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .photo-block { display: flex; flex-direction: column; gap: 10px; }
        .photo-hint {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted, #9e9893);
        }
        .photo-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
          gap: 10px;
        }
        .photo-thumb {
          position: relative;
          aspect-ratio: 1;
          border-radius: 10px;
          overflow: hidden;
          background: #f3f1ec;
        }
        .photo-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .photo-remove {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 8px;
          background: rgba(15, 13, 10, 0.72);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }
        @media (max-width: 640px) {
          .create-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
