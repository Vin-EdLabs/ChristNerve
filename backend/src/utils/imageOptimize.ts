import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * Re-encodes an uploaded image to a capped-dimension, compressed JPEG in place.
 * Members' phone photos can arrive at 10-15MB; serving those raw in a listing
 * grid is what makes the marketplace feel slow, so every upload gets normalized
 * to a size that actually loads fast regardless of the original file.
 * Returns the new filename (always .jpg) to store in the DB.
 */
export async function optimizeUploadedImage(
  originalPath: string,
  opts: { maxDimension?: number; quality?: number } = {}
): Promise<string> {
  const { maxDimension = 1600, quality = 78 } = opts;
  const dir = path.dirname(originalPath);
  const base = path.basename(originalPath, path.extname(originalPath));
  const outPath = path.join(dir, `${base}.jpg`);

  const buffer = await sharp(originalPath)
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  await fs.promises.writeFile(outPath, buffer);
  if (outPath !== originalPath) {
    await fs.promises.unlink(originalPath).catch(() => undefined);
  }
  return path.basename(outPath);
}
