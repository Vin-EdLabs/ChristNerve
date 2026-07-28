"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const churchTenant_1 = require("./middleware/churchTenant");
const socket_1 = require("./socket");
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
const churchPage_1 = __importStar(require("./routes/churchPage"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const pastoral_1 = __importDefault(require("./routes/pastoral"));
const churchLife_1 = __importDefault(require("./routes/churchLife"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const isProd = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
/** Localhost (any port) + christnerve / ch-* production hosts */
const productionOriginPattern = /^https:\/\/(christnerve|ch-[a-z0-9-]+)\.scholarnerve\.com$/i;
function isAllowedOrigin(origin) {
    if (!origin)
        return true;
    if (origin === frontendUrl)
        return true;
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isProduction = productionOriginPattern.test(origin);
    if (isLocalhost || isProduction)
        return true;
    return false;
}
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    // Allow <img> / font loads from the Vite origin (5174) and tenant hosts
    // when media is served from the API origin (5001) or a separate uploads host.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
exports.io = (0, socket_1.createSocketServer)(httpServer, isAllowedOrigin);
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
app.use(churchTenant_1.resolveChurchTenant);
app.use('/api/auth', auth_1.default);
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
app.use('/api/church-page', churchPage_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/pastoral', pastoral_1.default);
app.use('/api/church-life', churchLife_1.default);
app.post('/api/public/church/:slug/join', churchPage_1.publicJoinHandler);
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
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