import { useRef, useCallback } from 'react';
import { Platform } from 'react-native';

const cache = new Map<string, { label: string; icon: string | null }>();

export function clearAppMetadataCache() {
  cache.clear();
}

export function useAppMetadata() {
  const pendingRef = useRef<Set<string>>(new Set());

  const getAppInfo = useCallback(async (packageName: string) => {
    if (!packageName || Platform.OS !== 'android') {
      return { label: packageName || 'Unknown', icon: null };
    }

    const cached = cache.get(packageName);
    if (cached) return cached;

    if (pendingRef.current.has(packageName)) {
      return { label: packageName, icon: null };
    }

    pendingRef.current.add(packageName);
    try {
      // Lazy-load the Android-only native module only when needed.
      const { resolveAppInfo } = require('notification-access');
      const info = resolveAppInfo(packageName);
      cache.set(packageName, info);
      return info;
    } catch {
      const fallback = { label: packageName, icon: null };
      cache.set(packageName, fallback);
      return fallback;
    } finally {
      pendingRef.current.delete(packageName);
    }
  }, []);

  return { getAppInfo };
}
