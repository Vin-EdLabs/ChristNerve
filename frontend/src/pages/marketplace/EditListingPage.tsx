import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, ImagePlus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import type { MarketCategory, MarketListing } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonCard } from '../../components/ui/SkeletonCard';

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

type PreviewFile = { file: File; url: string };

export default function EditListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [listing, setListing] = useState<MarketListing | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PreviewFile[]>([]);
  const [form, setForm] = useState({
    category_id: '',
    title: '',
    description: '',
    price_min: '',
    price_max: '',
    price_label: '',
    location: '',
    whatsapp: '',
    is_active: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [catRes, detailRes] = await Promise.all([
          api.get('/market/categories'),
          api.get(`/market/my-listings/${id}`),
        ]);
        if (cancelled) return;
        const cats = asList<MarketCategory>(catRes.data);
        const found = detailRes.data as MarketListing & {
          images?: { image_url: string }[];
        };
        if (!found?.id) {
          toast.error('Listing not found');
          navigate('/market/my-listings');
          return;
        }
        setCategories(cats);
        setListing(found);
        const imgs = Array.isArray(found.images)
          ? found.images.map((i) => i.image_url).filter(Boolean)
          : found.primary_image
            ? [found.primary_image]
            : [];
        setExistingImages(imgs);
        setForm({
          category_id: found.category_id ? String(found.category_id) : '',
          title: found.title || '',
          description: found.description || '',
          price_min: found.price_min != null ? String(found.price_min) : '',
          price_max: found.price_max != null ? String(found.price_max) : '',
          price_label: found.price_label || '',
          location: found.location || '',
          whatsapp: found.whatsapp || '',
          is_active: found.is_active !== false,
        });
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || 'Failed to load listing';
        toast.error(msg);
        navigate('/market/my-listings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

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
      if (existingImages.length + photos.length + next.length >= 5) return;
      next.push({ file, url: URL.createObjectURL(file) });
    });
    if (next.length === 0) {
      toast.error('Add JPEG, PNG, or WebP images (max 5 total)');
      return;
    }
    setPhotos((prev) => [...prev, ...next].slice(0, 5 - existingImages.length));
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
    if (!listing) return;
    if (!form.title.trim() || !form.description.trim() || !form.whatsapp.trim()) {
      toast.error('Title, description, and WhatsApp are required');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/market/listings/${listing.id}`, {
        category_id: form.category_id ? Number(form.category_id) : null,
        title: form.title.trim(),
        description: form.description.trim(),
        price_min: form.price_min ? Number(form.price_min) : null,
        price_max: form.price_max ? Number(form.price_max) : null,
        price_label: form.price_label.trim() || null,
        location: form.location.trim() || null,
        whatsapp: form.whatsapp.trim(),
        is_active: form.is_active,
      });

      if (photos.length > 0) {
        const fd = new FormData();
        photos.forEach((p) => fd.append('images', p.file));
        await api.post(`/market/listings/${listing.id}/images`, fd);
      }

      toast.success('Listing updated');
      navigate('/market/my-listings');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not update listing';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !listing) {
    return (
      <div className="create-listing">
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="create-listing">
      <div className="edit-head">
        <h2 className="page-heading">Edit Listing</h2>
        <Link to={`/market/listing/${listing.slug}`} className="edit-view-link">
          View public page
        </Link>
      </div>
      <form className="card create-form" onSubmit={handleSubmit}>
        <label className="label">Category</label>
        <select
          className="input"
          value={form.category_id}
          onChange={(e) =>
            setForm((f) => ({ ...f, category_id: e.target.value }))
          }
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
          />
        </div>

        <Input
          label="Price Label (optional)"
          value={form.price_label}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm((f) => ({ ...f, price_label: e.target.value }))
          }
        />

        <div className="create-grid">
          <Input
            label="Location"
            value={form.location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
          />
          <Input
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, whatsapp: e.target.value }))
            }
            required
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_active: e.target.checked }))
            }
          />
          Listing is active
        </label>

        <div className="photo-block">
          <label className="label">Photos</label>
          <p className="photo-hint">
            Current images stay. Add more from gallery, camera, or files.
          </p>
          {(existingImages.length > 0 || photos.length > 0) && (
            <div className="photo-grid">
              {existingImages.map((url) => (
                <div key={url} className="photo-thumb">
                  <img src={resolveMediaUrl(url)} alt="" />
                </div>
              ))}
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
          <div className="photo-actions">
            <Button type="button" variant="ghost" onClick={() => galleryRef.current?.click()}>
              <ImagePlus size={16} />
              Gallery
            </Button>
            <Button type="button" variant="ghost" onClick={() => cameraRef.current?.click()}>
              <Camera size={16} />
              Camera
            </Button>
            <Button type="button" variant="ghost" onClick={() => filesRef.current?.click()}>
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
            Save Changes
          </Button>
        </div>
      </form>

      <style>{`
        .create-listing { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 720px; margin: 0 auto; }
        .edit-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
        }
        .page-heading {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
        }
        .edit-view-link {
          font-size: 14px;
          color: var(--accent, #2d1b69);
          text-decoration: none;
        }
        .create-form { display: flex; flex-direction: column; gap: 14px; }
        .create-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .photo-block { display: flex; flex-direction: column; gap: 10px; }
        .photo-hint {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted, #9e9893);
        }
        .photo-actions { display: flex; flex-wrap: wrap; gap: 8px; }
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
        .photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
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
