import { Request, Response, NextFunction } from 'express';
export interface ChurchTenant {
    id: number;
    name: string;
    slug: string;
    tagline?: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
    address?: string;
    city?: string;
    region?: string;
    phone?: string;
    email?: string;
    denomination?: string;
    founded_year?: number;
    subscription_plan?: string;
    subscription_status: string;
    subscription_amount?: number;
    next_billing_date?: string;
    is_active: boolean;
    brand_color?: string;
    secondary_color?: string;
    created_at?: string;
    updated_at?: string;
}
declare global {
    namespace Express {
        interface Request {
            churchTenant?: ChurchTenant;
        }
    }
}
export declare const resolveChurchTenant: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireChurchTenant: (req: Request, res: Response, next: NextFunction) => void;
