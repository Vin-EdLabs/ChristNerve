import multer from 'multer';
declare const uploadsRoot: string;
declare const churchUploadDir: string;
export declare const upload: multer.Multer;
/** Public URL path stored in DB for uploaded church files. */
export declare function uploadedFilePublicUrl(file?: Express.Multer.File | null): string | null;
export { uploadsRoot, churchUploadDir };
