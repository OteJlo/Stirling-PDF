import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRequestHeaders } from '@app/hooks/useRequestHeaders';

// Helper to get JWT from localStorage for Authorization header
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('stirling_jwt');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export interface AppConfig {
  baseUrl?: string;
  contextPath?: string;
  serverPort?: number;
  appName?: string;
  appNameNavbar?: string;
  homeDescription?: string;
  languages?: string[];
  enableLogin?: boolean;
  enableAlphaFunctionality?: boolean;
  enableAnalytics?: boolean | null;
  enablePosthog?: boolean | null;
  enableScarf?: boolean | null;
  premiumEnabled?: boolean;
  premiumKey?: string;
  termsAndConditions?: string;
  privacyPolicy?: string;
  cookiePolicy?: string;
  impressum?: string;
  accessibilityStatement?: string;
  runningProOrHigher?: boolean;
  runningEE?: boolean;
  license?: string;
  SSOAutoLogin?: boolean;
  serverCertificateEnabled?: boolean;
  error?: string;
}

interface AppConfigContextType {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextValue | undefined>({
  config: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

/**
 * Provider component that fetches and provides app configuration
 * Should be placed at the top level of the app, before any components that need config
 */
export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const headers = useRequestHeaders();
  const [fetchCount, setFetchCount] = useState(0);

  const fetchConfig = async (force = false) => {
    // Prevent duplicate fetches unless forced
    if (!force && fetchCount > 0) {
      console.debug('[AppConfigContext] Config already fetched, skipping (fetch count:', fetchCount, ')');
      return;
    }

    // Don't fetch config if we're on the login page and don't have JWT
    const isLoginPage = window.location.pathname.includes('/login');
    const hasJwt = !!localStorage.getItem('stirling_jwt');

    if (isLoginPage && !hasJwt) {
      console.debug('[AppConfigContext] On login page without JWT - using default config');
      setConfig({ enableLogin: true });
      setLoading(false);
      return;
    }

  const fetchConfig = async () => {
    try {
      console.debug('[AppConfig] Fetching config (attempt #', fetchCount + 1, ')');
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/config/app-config', {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        // On 401 (not authenticated), use default config with login enabled
        if (response.status === 401) {
          console.debug('[AppConfig] 401 error - using default config (login enabled)');
          setConfig({ enableLogin: true });
          return;
        }
        throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
      }

      const data: AppConfig = await response.json();
      console.debug('[AppConfig] Config fetched successfully:', data);
      setConfig(data);
      setFetchCount(prev => prev + 1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[AppConfig] Failed to fetch app config:', err);
      // On error, assume login is enabled (safe default)
      setConfig({ enableLogin: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Listen for JWT availability (triggered on login/signup)
  useEffect(() => {
    const handleJwtAvailable = () => {
      console.debug('[AppConfig] JWT available event - refetching config with auth');
      fetchConfig(true); // Force refetch with JWT
    };

    window.addEventListener('jwt-available', handleJwtAvailable);
    return () => window.removeEventListener('jwt-available', handleJwtAvailable);
  }, []);

  return (
    <AppConfigContext.Provider value={{ config, loading, error, refetch: () => fetchConfig(true) }}>
      {children}
    </AppConfigContext.Provider>
  );
}

/**
 * Hook to use app config from context
 */
export function useAppConfig() {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error('useAppConfig must be used within AppConfigProvider');
  }

  return context;
}
