import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileTabBar } from './MobileTabBar';
import { Spinner } from '../ui/Spinner';
import { NotificationPrompt } from '../notifications/NotificationPrompt';
import { useAuth } from '../../contexts/AuthContext';

const TITLE_MAP: Record<string, string> = {
  '/': 'Dashboard',
  '/members': 'Members',
  '/attendance': 'Attendance',
  '/my-department': 'My Department',
  '/finance': 'Finance Dashboard',
  '/finance/giving': 'Giving',
  '/finance/expenses': 'Expenses',
  '/events': 'Events',
  '/announcements': 'Announcements',
  '/departments': 'Departments',
  '/prayer-requests': 'Prayer Requests',
  '/follow-up': 'Follow-Up',
  '/welfare': 'Welfare',
  '/cell-groups': 'Cell Groups',
  '/sermons': 'Sermons',
  '/live': 'Live Stream',
  '/devotionals': 'Devotionals',
  '/bulletin': 'Sunday Bulletin',
  '/feed': 'Church Feed',
  '/sunday-report': 'Sunday Report',
  '/growth': 'Growth Dashboard',
  '/whatsapp-actions': 'WhatsApp Actions',
  '/settings': 'Settings',
  '/more': 'More',
  '/users': 'Users',
  '/church-page': 'Church Page',
  '/audit': 'Audit Log',
  '/market/my-listings': 'My Shop',
  '/market/create': 'Create Listing',
  '/market/orders': 'Orders',
};

const MEMBER_ALLOWED = [
  '/',
  '/my-department',
  '/my-attendance',
  '/sermons',
  '/live',
  '/devotionals',
  '/bulletin',
  '/feed',
  '/whatsapp-actions',
  '/market/my-listings',
  '/market/create',
  '/market/edit',
  '/market/orders',
  '/settings',
  '/more',
  '/announcements',
  '/prayer-requests',
  '/welfare',
];

const FINANCE_ALLOWED = [
  '/finance',
  '/more',
  '/settings',
  '/audit',
];

function resolveTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  if (pathname.startsWith('/members/')) return 'Member Detail';
  if (pathname.startsWith('/market/edit')) return 'Edit Listing';
  if (pathname.startsWith('/market')) return 'Marketplace';
  return 'ChristNerve';
}

function isFinanceRole(role?: string | null) {
  return String(role || '').toLowerCase() === 'finance';
}

export const DashboardLayout: React.FC = () => {
  const { isAuthenticated, isLoading, accountType, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Spinner fullPage size="lg" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (
    accountType === 'member' &&
    !MEMBER_ALLOWED.some(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
    )
  ) {
    return <Navigate to="/" replace />;
  }

  if (
    accountType === 'staff' &&
    isFinanceRole(user?.role) &&
    !FINANCE_ALLOWED.some(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
    )
  ) {
    return <Navigate to="/finance" replace />;
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-main">
        <TopBar title={resolveTitle(location.pathname)} />
        <main className="dashboard-content">
          <Outlet />
        </main>
        <MobileTabBar />
        <NotificationPrompt mode="church" />
      </div>
    </div>
  );
};

export default DashboardLayout;
