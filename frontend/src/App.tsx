import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CartProvider } from './contexts/CartContext';
import {
  churchDomainUrl,
  getChurchSlug,
  isLocalHost,
  isPlatformHost,
  platformDomainUrl,
} from './utils/tenantHost';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { SplashScreen } from './components/ui/SplashScreen';
import { InstallPrompt } from './components/ui/InstallPrompt';

import LandingPage from './pages/landing/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import SetupCredentialsPage from './pages/auth/SetupCredentialsPage';
import DashboardHome from './pages/dashboard/DashboardHome';
import MembersPage from './pages/dashboard/MembersPage';
import MemberDetail from './pages/dashboard/MemberDetail';
import AttendancePage from './pages/dashboard/AttendancePage';
import FinancePage from './pages/dashboard/FinancePage';
import EventsPage from './pages/dashboard/EventsPage';
import AnnouncementsPage from './pages/dashboard/AnnouncementsPage';
import DepartmentsPage from './pages/dashboard/DepartmentsPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import MorePage from './pages/dashboard/MorePage';
import UsersPage from './pages/dashboard/UsersPage';
import ChurchPageAdmin from './pages/dashboard/ChurchPageAdmin';
import AuditPage from './pages/dashboard/AuditPage';
import MyAttendancePage from './pages/dashboard/MyAttendancePage';
import MyDepartmentPage from './pages/dashboard/MyDepartmentPage';
import VisitChurchPage from './pages/public/VisitChurchPage';
import PrayerRequestsPage from './pages/dashboard/PrayerRequestsPage';
import FollowUpPage from './pages/dashboard/FollowUpPage';
import WelfarePage from './pages/dashboard/WelfarePage';
import CellGroupsPage from './pages/dashboard/CellGroupsPage';
import MarketplacePage from './pages/marketplace/MarketplacePage';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './contexts/AuthContext';
import ListingDetailPage from './pages/marketplace/ListingDetailPage';
import MemberStorefront from './pages/marketplace/MemberStorefront';
import MyListingsPage from './pages/marketplace/MyListingsPage';
import CreateListingPage from './pages/marketplace/CreateListingPage';
import EditListingPage from './pages/marketplace/EditListingPage';
import VendorOrdersPage from './pages/marketplace/VendorOrdersPage';
import CartPage from './pages/marketplace/CartPage';
import ChatPage from './pages/marketplace/ChatPage';
import { MarketLayout } from './components/layout/MarketLayout';
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminChurches from './pages/superadmin/SuperAdminChurches';
import SuperAdminMonitor from './pages/superadmin/SuperAdminMonitor';
import SuperAdminRegistrations from './pages/superadmin/SuperAdminRegistrations';

/** Keep ?church=slug on every localhost church route. */
function PersistChurchParam({ slug }: { slug: string }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLocalHost()) return;
    const params = new URLSearchParams(location.search);
    if (params.get('church') === slug) return;
    params.set('church', slug);
    navigate(
      {
        pathname: location.pathname,
        search: `?${params.toString()}`,
        hash: location.hash,
      },
      { replace: true }
    );
  }, [location.pathname, location.search, location.hash, navigate, slug]);

  return null;
}

function PlatformApp() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin" element={<SuperAdminLayout />}>
            <Route index element={<SuperAdminDashboard />} />
            <Route path="monitor" element={<SuperAdminMonitor />} />
            <Route path="registrations" element={<SuperAdminRegistrations />} />
            <Route path="churches" element={<SuperAdminChurches />} />
            <Route
              path="churches/new"
              element={<Navigate to="/admin/churches?tab=add" replace />}
            />
          </Route>
          <Route path="/superadmin" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

/** Signed-in users get the portal dashboard at `/`. Guests go to login (visit page is `/visit` only). */
function ChurchRoot() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Spinner fullPage size="lg" />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname || '/' }}
      />
    );
  }

  return <DashboardLayout />;
}

function ChurchApp() {
  const slug = getChurchSlug();

  if (!slug) {
    return (
      <div style={{ padding: 48, textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1>Church not found</h1>
        <p>
          Local demo:{' '}
          <a href={churchDomainUrl('pka', '/login')}>
            localhost:5174?church=pka
          </a>
        </p>
        <p>
          Or open the landing page:{' '}
          <a href={platformDomainUrl('/')}>localhost:5174</a>
        </p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <CartProvider>
            <PersistChurchParam slug={slug} />
            <SplashScreen />
            <InstallPrompt />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/setup-credentials" element={<SetupCredentialsPage />} />
              <Route path="/visit" element={<VisitChurchPage />} />
              <Route path="/about" element={<VisitChurchPage />} />

              <Route path="/" element={<ChurchRoot />}>
                <Route index element={<DashboardHome />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="members/:id" element={<MemberDetail />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="church-page" element={<ChurchPageAdmin />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="finance" element={<FinancePage />} />
                <Route path="finance/giving" element={<FinancePage />} />
                <Route path="finance/expenses" element={<FinancePage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="prayer-requests" element={<PrayerRequestsPage />} />
                <Route path="follow-up" element={<FollowUpPage />} />
                <Route path="welfare" element={<WelfarePage />} />
                <Route path="cell-groups" element={<CellGroupsPage />} />
                <Route path="audit" element={<AuditPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="more" element={<MorePage />} />
                <Route path="my-attendance" element={<MyAttendancePage />} />
                <Route path="my-department" element={<MyDepartmentPage />} />
                <Route path="market/my-listings" element={<MyListingsPage />} />
                <Route path="market/create" element={<CreateListingPage />} />
                <Route path="market/edit/:id" element={<EditListingPage />} />
                <Route path="market/orders" element={<VendorOrdersPage />} />
              </Route>

              <Route element={<MarketLayout />}>
                <Route path="/market" element={<MarketplacePage />} />
                <Route path="/market/listing/:slug" element={<ListingDetailPage />} />
                <Route path="/market/cart" element={<CartPage />} />
                <Route path="/market/chat" element={<ChatPage />} />
                <Route path="/market/chat/:conversationId" element={<ChatPage />} />
                <Route path="/shop/:memberSlug" element={<MemberStorefront />} />
              </Route>
              <Route path="/cart" element={<Navigate to="/market/cart" replace />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CartProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function App() {
  if (isPlatformHost()) {
    return <PlatformApp />;
  }
  return <ChurchApp />;
}
