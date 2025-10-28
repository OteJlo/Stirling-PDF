import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';

// Helper to get JWT from localStorage for Authorization header
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('stirling_jwt');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface EndpointConfigContextType {
  endpointStatus: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  checkEndpoints: (endpoints: string[]) => Promise<void>;
  isEndpointEnabled: (endpoint: string) => boolean;
}

const EndpointConfigContext = createContext<EndpointConfigContextType>({
  endpointStatus: {},
  loading: true,
  error: null,
  checkEndpoints: async () => {},
  isEndpointEnabled: () => true,
});

/**
 * EndpointConfig Provider - Singleton pattern to prevent duplicate fetches
 * Caches endpoint status globally and only fetches once per unique set
 */
export function EndpointConfigProvider({ children }: { children: ReactNode }) {
  const [endpointStatus, setEndpointStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedSets, setFetchedSets] = useState<Set<string>>(new Set());

  const checkEndpoints = async (endpoints: string[]) => {
    if (!endpoints || endpoints.length === 0) {
      return;
    }

    // Create a unique key for this set of endpoints
    const endpointsKey = [...endpoints].sort().join(',');

    // Skip if we've already fetched this exact set
    if (fetchedSets.has(endpointsKey)) {
      console.debug('[EndpointConfigContext] Already fetched endpoints:', endpointsKey);
      return;
    }

    // Check which endpoints we haven't fetched yet
    const newEndpoints = endpoints.filter(ep => !(ep in endpointStatus));
    if (newEndpoints.length === 0) {
      console.debug('[EndpointConfigContext] All endpoints already cached');
      return;
    }

    // Don't fetch if we're on login page without JWT
    const isLoginPage = window.location.pathname.includes('/login');
    const hasJwt = !!localStorage.getItem('stirling_jwt');

    if (isLoginPage && !hasJwt) {
      console.debug('[EndpointConfigContext] On login page without JWT - optimistically enabling all endpoints');
      const optimisticStatus = newEndpoints.reduce((acc, endpoint) => {
        acc[endpoint] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setEndpointStatus(prev => ({ ...prev, ...optimisticStatus }));
      return;
    }

    // If no JWT, optimistically enable all endpoints
    if (!hasJwt) {
      console.debug('[EndpointConfigContext] No JWT found - optimistically enabling all endpoints');
      const optimisticStatus = newEndpoints.reduce((acc, endpoint) => {
        acc[endpoint] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setEndpointStatus(prev => ({ ...prev, ...optimisticStatus }));
      return;
    }

    try {
      console.debug('[EndpointConfigContext] Fetching endpoint status for:', newEndpoints);
      setLoading(true);
      setError(null);

      // Use batch API for efficiency
      const endpointsParam = newEndpoints.join(',');

      const response = await fetch(`/api/v1/config/endpoints-enabled?endpoints=${encodeURIComponent(endpointsParam)}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        // On 401 (auth error), use optimistic fallback
        if (response.status === 401) {
          console.warn('[EndpointConfigContext] 401 error - using optimistic fallback');
          const optimisticStatus = newEndpoints.reduce((acc, endpoint) => {
            acc[endpoint] = true;
            return acc;
          }, {} as Record<string, boolean>);
          setEndpointStatus(prev => ({ ...prev, ...optimisticStatus }));
          return;
        }
        throw new Error(`Failed to check endpoints: ${response.status} ${response.statusText}`);
      }

      const statusMap: Record<string, boolean> = await response.json();
      console.debug('[EndpointConfigContext] Endpoint status received:', statusMap);
      setEndpointStatus(prev => ({ ...prev, ...statusMap }));
      setFetchedSets(prev => new Set(prev).add(endpointsKey));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[EndpointConfigContext] Failed to check endpoints:', err);

      // Fallback: optimistically enable all endpoints
      const optimisticStatus = newEndpoints.reduce((acc, endpoint) => {
        acc[endpoint] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setEndpointStatus(prev => ({ ...prev, ...optimisticStatus }));
    } finally {
      setLoading(false);
    }
  };

  // Listen for JWT availability to refetch with auth
  useEffect(() => {
    const handleJwtAvailable = () => {
      console.debug('[EndpointConfigContext] JWT available - clearing cache to refetch with auth');
      // Clear the cache to allow refetch with JWT
      setFetchedSets(new Set());
      setEndpointStatus({});
    };

    window.addEventListener('jwt-available', handleJwtAvailable);
    return () => window.removeEventListener('jwt-available', handleJwtAvailable);
  }, []);

  // Helper to check if a specific endpoint is enabled
  const isEndpointEnabled = (endpoint: string): boolean => {
    // Default to true if not in cache (optimistic)
    return endpointStatus[endpoint] !== false;
  };

  const value = useMemo(() => ({
    endpointStatus,
    loading,
    error,
    checkEndpoints,
    isEndpointEnabled,
  }), [endpointStatus, loading, error]);

  return (
    <EndpointConfigContext.Provider value={value}>
      {children}
    </EndpointConfigContext.Provider>
  );
}

/**
 * Hook to use endpoint config from context
 */
export function useEndpointConfig() {
  const context = useContext(EndpointConfigContext);
  if (!context) {
    throw new Error('useEndpointConfig must be used within EndpointConfigProvider');
  }
  return context;
}

/**
 * Hook to check multiple endpoints - compatible with existing usage
 */
export function useMultipleEndpointsEnabled(endpoints: string[]) {
  const { endpointStatus, loading, error, checkEndpoints } = useEndpointConfig();

  useEffect(() => {
    checkEndpoints(endpoints);
  }, [endpoints.join(',')]);

  return {
    endpointStatus,
    loading,
    error,
    refetch: () => checkEndpoints(endpoints),
  };
}