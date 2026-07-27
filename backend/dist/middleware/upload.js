"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.churchUploadDir = exports.uploadsRoot = exports.upload = void 0;
exports.uploadedFilePublicUrl = uploadedFilePublicUrl;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadsRoot = process.env.UPLOADS_DIR
    ? path_1.default.resolve(process.env.UPLOADS_DIR)
    : path_1.default.join(__dirname, '../../uploads');
exports.uploadsRoot = uploadsRoot;
const churchUploadDir = path_1.default.join(uploadsRoot, 'church');
exports.churchUploadDir = churchUploadDir;
if (!fs_1.default.existsSync(churchUploadDir)) {
    fs_1.default.mkdirSync(churchUploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        if (!fs_1.default.existsSync(churchUploadDir)) {
            fs_1.default.mkdirSync(churchUploadDir, { recursive: true });
        }
        cb(null, churchUploadDir);
    },
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path_1.default.extname(file.originalname).toLowerCase()}`);
    },
});
const fileFilter = (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});
/** Public URL path stored in DB for uploaded church files. */
function uploadedFilePublicUrl(file) {
    if (!file?.filename)
        return null;
    return `/uploads/church/${file.filename}`;
}
//# sourceMappingURL=upload.js.map