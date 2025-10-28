import { useEffect } from 'react';
import { useEndpointConfig } from '../contexts/EndpointConfigContext';

/**
 * Re-export from context to maintain backward compatibility
 * All components now share the same endpoint status cache
 */
export { useEndpointConfig, useMultipleEndpointsEnabled } from '../contexts/EndpointConfigContext';

/**
 * Hook to check if a specific endpoint is enabled
 * This wraps the context for single endpoint checks
 */
export function useEndpointEnabled(endpoint: string) {
  const { endpointStatus, loading, error, checkEndpoints, isEndpointEnabled } = useEndpointConfig();

  // Check this endpoint on mount
  useEffect(() => {
    if (endpoint) {
      checkEndpoints([endpoint]);
    }
  }, [endpoint]);

  return {
    enabled: endpoint ? isEndpointEnabled(endpoint) : null,
    loading,
    error,
    refetch: () => checkEndpoints([endpoint]),
  };
}
