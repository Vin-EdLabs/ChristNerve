import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { ChurchTenant, ChurchUser } from '../types';
import { getChurchSlug } from '../utils/tenantHost';
import { applyTenantPWA } from '../utils/applyTenantPWA';

interface AuthContextType {
  user: ChurchUser | null;
  tenant: ChurchTenant | null;
  accountType: 'staff' | 'member' | null;
  needsSetup: boolean;
  login: (
    email: string,
    password: string,
    churchSlug: string
  ) => Promise<'staff' | 'member'>;
  loginMemberFirst: (
    firstName: string,
    phone: string,
    churchSlug: string
  ) => Promise<{ needsSetup: boolean }>;
  setupMemberCredentials: (
    username: string,
    password: string
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<ChurchUser | null>(null);
  const [tenant, setTenant] = useState<ChurchTenant | null>(null);
  const [accountType, setAccountType] = useState<'staff' | 'member' | null>(
    null
  );
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const slug = getChurchSlug();
    if (slug) {
      api
        .get(`/public/church/${slug}`)
        .then((res) => {
          const church = (res.data.church || res.data) as ChurchTenant;
          setTenant((prev) => prev || church);
          applyTenantPWA(church);
        })
        .catch(() => undefined);
    }

    const token = localStorage.getItem('church_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        setTenant(res.data.tenant);
        applyTenantPWA(res.data.tenant);
        setAccountType(res.data.accountType === 'member' ? 'member' : 'staff');
        setNeedsSetup(Boolean(res.data.needsSetup));
      })
      .catch(() => {
        localStorage.removeItem('church_token');
        localStorage.removeItem('account_type');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (username: string, password: string, churchSlug: string) => {
      const slug = churchSlug || getChurchSlug() || '';
      const res = await api.post('/auth/login', {
        username,
        email: username,
        password,
        churchSlug: slug,
      });
      const type: 'staff' | 'member' =
        res.data.accountType === 'member' ? 'member' : 'staff';

      localStorage.setItem('church_token', res.data.token);
      localStorage.setItem('church_slug', slug);
      localStorage.setItem('account_type', type);
      setUser(res.data.user);
      setTenant(res.data.tenant);
      applyTenantPWA(res.data.tenant);
      setAccountType(type);
      setNeedsSetup(Boolean(res.data.needsSetup));
      return type;
    },
    []
  );

  const loginMemberFirst = useCallback(
    async (firstName: string, phone: string, churchSlug: string) => {
      const slug = churchSlug || getChurchSlug() || '';
      const res = await api.post('/auth/member/first-login', {
        first_name: firstName,
        phone,
        churchSlug: slug,
      });
      localStorage.setItem('church_token', res.data.token);
      localStorage.setItem('church_slug', slug);
      localStorage.setItem('account_type', 'member');
      setUser(res.data.user);
      setTenant(res.data.tenant);
      applyTenantPWA(res.data.tenant);
      setAccountType('member');
      setNeedsSetup(Boolean(res.data.needsSetup));
      return { needsSetup: Boolean(res.data.needsSetup) };
    },
    []
  );

  const setupMemberCredentials = useCallback(
    async (username: string, password: string) => {
      const res = await api.post('/auth/member/setup-credentials', {
        username,
        password,
      });
      if (res.data.token) {
        localStorage.setItem('church_token', res.data.token);
      }
      setUser(res.data.user);
      setNeedsSetup(false);
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.data.user);
    setTenant(res.data.tenant);
    applyTenantPWA(res.data.tenant);
    setAccountType(res.data.accountType === 'member' ? 'member' : 'staff');
    setNeedsSetup(Boolean(res.data.needsSetup));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('church_token');
    localStorage.removeItem('account_type');
    setUser(null);
    setTenant(null);
    setAccountType(null);
    setNeedsSetup(false);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        accountType,
        needsSetup,
        login,
        loginMemberFirst,
        setupMemberCredentials,
        refreshProfile,
        logout,
        isLoading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
