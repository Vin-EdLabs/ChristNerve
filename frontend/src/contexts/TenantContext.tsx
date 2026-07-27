import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { getChurchSlug } from '../utils/tenantHost';
import type { ChurchTenant } from '../types';
import { applyTenantPWA } from '../utils/applyTenantPWA';

interface TenantContextType {
  tenant: ChurchTenant | null;
  slug: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | null>(null);

export const TenantProvider: React.FC<{ children: React.ReactNode; slug?: string }> = ({
  children,
  slug: slugProp,
}) => {
  const [tenant, setTenant] = useState<ChurchTenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const slug = slugProp ?? getChurchSlug();

  const refresh = useCallback(async () => {
    if (!slug) {
      setTenant(null);
      setIsLoading(false);
      setError('No church slug');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/public/church/${slug}`);
      const church = (res.data.church || res.data) as ChurchTenant;
      setTenant(church);
      applyTenantPWA(church);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load church';
      setError(message);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <TenantContext.Provider value={{ tenant, slug, isLoading, error, refresh }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextType => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
};
