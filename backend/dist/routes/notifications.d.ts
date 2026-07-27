declare const router: import("express-serve-static-core").Router;
export default router;
/** Helper used by superadmin when creating church-targeted notifications */
export declare function notifyChurchUsers(opts: {
    churchId: number;
    title: string;
    body: string;
    link?: string | null;
    userType?: 'staff' | 'member';
    userId?: number | null;
}): Promise<number>;
/**
 * Church-wide announcement broadcast — one in-app row (visible to all staff/members)
 * plus FCM to every registered device for that church (all tenants).
 */
export declare function notifyChurchBroadcast(opts: {
    churchId: number;
    title: string;
    body: string;
    link?: string | null;
}): Promise<number>;
