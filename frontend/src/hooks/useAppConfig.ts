import { useState, useEffect } from 'react';

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
  enableAnalytics?: boolean;
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

interface UseAppConfigReturn {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch and manage application configuration
 */
export function useAppConfig(): UseAppConfigReturn {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchConfig = async () => {
    // Prevent duplicate fetches
    if (hasFetched) {
      console.debug('[useAppConfig] Already fetched, skipping');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setHasFetched(true);

      const response = await fetch('/api/v1/config/app-config', {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        // On 401 (not authenticated), use default config with login enabled
        if (response.status === 401) {
          console.debug('[useAppConfig] 401 error - using default config (login enabled)');
          setConfig({ enableLogin: true });
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
      }

      const data: AppConfig = await response.json();
      console.debug('[useAppConfig] Config fetched successfully:', data);
      setConfig(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[useAppConfig] Failed to fetch app config:', err);
      // On error, assume login is enabled (safe default)
      setConfig({ enableLogin: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch config if we have JWT or if checking for anonymous mode
    const hasJwt = !!localStorage.getItem('stirling_jwt');

    // Always try to fetch config to check if login is disabled
    // The endpoint should be public and return proper JSON
    fetchConfig();
  }, []);

  // Listen for JWT availability (triggered on login/signup)
  useEffect(() => {
    const handleJwtAvailable = () => {
      console.debug('[useAppConfig] JWT available event - refetching config');
      // Reset the flag to allow refetch with JWT
      setHasFetched(false);
      fetchConfig();
    };

    window.addEventListener('jwt-available', handleJwtAvailable);
    return () => window.removeEventListener('jwt-available', handleJwtAvailable);
  }, []);

  return {
    config,
    loading,
    error,
    refetch: fetchConfig,
  };
}

