import { Request, Response, NextFunction } from 'express';
export interface ChurchUser {
    id: number;
    church_id: number;
    first_name: string;
    last_name: string;
    email: string;
    password_hash?: string;
    phone?: string;
    role: string;
    avatar_url?: string;
    is_active?: boolean;
    last_login?: string;
    created_at?: string;
    marketplace_slug?: string;
}
export interface SuperAdminPayload {
    role: 'super-admin';
    email: string;
}
declare global {
    namespace Express {
        interface Request {
            churchUser?: ChurchUser;
            superAdmin?: SuperAdminPayload;
            accountType?: 'staff' | 'member';
        }
    }
}
export declare const requireChurchAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;
