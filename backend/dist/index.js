"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const churchTenant_1 = require("./middleware/churchTenant");
const upload_1 = require("./middleware/upload");
const reminderJob_1 = require("./jobs/reminderJob");
const auth_1 = __importDefault(require("./routes/auth"));
const members_1 = __importDefault(require("./routes/members"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const finance_1 = __importDefault(require("./routes/finance"));
const events_1 = __importDefault(require("./routes/events"));
const announcements_1 = __importDefault(require("./routes/announcements"));
const departments_1 = __importDefault(require("./routes/departments"));
const marketplace_1 = __importDefault(require("./routes/marketplace"));
const public_1 = __importDefault(require("./routes/public"));
const superadmin_1 = __importDefault(require("./routes/superadmin"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const chat_1 = __importDefault(require("./routes/chat"));
const users_1 = __importDefault(require("./routes/users"));
const audit_1 = __importDefault(require("./routes/audit"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const isProd = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
/** Production: only scholarnerve.com hosts. Dev: also localhost. */
const allowedOriginPattern = /^https:\/\/([a-z0-9-]+\.)?scholarnerve\.com$/i;
function isAllowedOrigin(origin) {
    if (!origin)
        return true;
    if (origin === frontendUrl)
        return true;
    if (allowedOriginPattern.test(origin))
        return true;
    if (!isProd) {
        try {
            const url = new URL(origin);
            const host = url.hostname.toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1')
                return true;
            if (host.endsWith('.localhost'))
                return true;
        }
        catch {
            return false;
        }
    }
    return false;
}
// Behind Nginx / Cloudflare
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({
    // SPA + API on same host; allow Vite assets / inline where needed
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
exports.io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            callback(null, isAllowedOrigin(origin));
        },
        credentials: true,
    },
});
exports.io.on('connection', (socket) => {
    socket.on('join-church', (churchId) => {
        socket.join(`church:${churchId}`);
    });
    socket.on('disconnect', () => {
        // no-op
    });
});
if (!fs_1.default.existsSync(upload_1.uploadsRoot)) {
    fs_1.default.mkdirSync(upload_1.uploadsRoot, { recursive: true });
}
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '2mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/uploads', express_1.default.static(upload_1.uploadsRoot));
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'christnerve-api',
        timestamp: new Date().toISOString(),
    });
});
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'christnerve-api',
        timestamp: new Date().toISOString(),
    });
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many login attempts. Try again in 15 minutes.',
    },
});
// Multi-tenant resolution (subdomain or X-Church-Slug)
app.use(churchTenant_1.resolveChurchTenant);
app.use('/api/auth', authLimiter, auth_1.default);
app.use('/api/members', members_1.default);
app.use('/api/attendance', attendance_1.default);
app.use('/api/finance', finance_1.default);
app.use('/api/events', events_1.default);
app.use('/api/announcements', announcements_1.default);
app.use('/api/departments', departments_1.default);
app.use('/api/market', marketplace_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/public', public_1.default);
app.use('/api/superadmin', superadmin_1.default);
app.use('/api/users', users_1.default);
app.use('/api/audit', audit_1.default);
app.use('/api/notifications', notifications_1.default);
// 404 for unknown API routes
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Error handler
app.use((err, _req, res, _next) => {
    console.error(err.stack || err.message);
    if (err.message?.includes('Only JPEG') || err.message === 'Not allowed by CORS') {
        res.status(err.message === 'Not allowed by CORS' ? 403 : 400).json({
            error: err.message,
        });
        return;
    }
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});
const PORT = parseInt(process.env.PORT || '5001', 10);
const listenHost = isProd ? '127.0.0.1' : '0.0.0.0';
httpServer.listen(PORT, listenHost, () => {
    console.log(`ChristNerve API running on ${listenHost}:${PORT}`);
    (0, reminderJob_1.startReminderJob)();
});
//# sourceMappingURL=index.js.map