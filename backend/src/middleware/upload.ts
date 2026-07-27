import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '../../uploads');

const churchUploadDir = path.join(uploadsRoot, 'church');

if (!fs.existsSync(churchUploadDir)) {
  fs.mkdirSync(churchUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(churchUploadDir)) {
      fs.mkdirSync(churchUploadDir, { recursive: true });
    }
    cb(null, churchUploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Public URL path stored in DB for uploaded church files. */
export function uploadedFilePublicUrl(file?: Express.Multer.File | null): string | null {
  if (!file?.filename) return null;
  return `/uploads/church/${file.filename}`;
}

export { uploadsRoot, churchUploadDir };
