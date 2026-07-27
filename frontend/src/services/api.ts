import axios from 'axios';
import { getChurchSlug } from '../utils/tenantHost';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const url = `${config.baseURL || ''}${config.url || ''}`;
  const isSuperAdminCall =
    url.includes('/superadmin') || url.includes('/auth/superadmin');

  if (isSuperAdminCall) {
    const sa = localStorage.getItem('superadmin_token');
    if (sa) {
      config.headers.Authorization = `Bearer ${sa}`;
    }
  } else {
    const token = localStorage.getItem('church_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  const slug = getChurchSlug();
  if (slug) {
    config.headers['X-Church-Slug'] = slug;
  }

  // FormData needs the browser multipart boundary — never force JSON/multipart headers
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
      const isSuperAdminCall =
        url.includes('/superadmin') || url.includes('/auth/superadmin');
      const path = window.location.pathname;

      if (isSuperAdminCall) {
        localStorage.removeItem('superadmin_token');
      } else {
        localStorage.removeItem('church_token');
        if (
          !path.startsWith('/login') &&
          !path.startsWith('/admin') &&
          !path.startsWith('/superadmin') &&
          !path.startsWith('/market') &&
          !path.startsWith('/shop')
        ) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
