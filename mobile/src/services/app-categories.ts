import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/services/logger';

interface CategoryRow {
  package_name: string;
  category: string;
}

interface Cache {
  ts: number;
  packages: Set<string>;
  categories: Map<string, string>;
}

const TTL_MS = 5 * 60 * 1000;
let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;
let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;

/**
 * Returns the cached social-media / messaging / dating whitelist. Refetches
 * from the `get-app-categories` edge function when the cache is empty or older
 * than TTL_MS. Multiple concurrent callers share a single in-flight request.
 */
export async function getAppCategories(): Promise<Cache> {
  if (cache && Date.now() - cache.ts < TTL_MS) {
    return cache;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke<{
        data: CategoryRow[];
        count: number;
      }>('get-app-categories');

      if (error || !data) {
        logger.warn(
          'getAppCategories',
          'fetch failed, returning previous cache if any',
          error?.message ?? 'no data',
        );
        return cache ?? { ts: 0, packages: new Set(), categories: new Map() };
      }

      const packages = new Set<string>();
      const categories = new Map<string, string>();
      for (const row of data.data) {
        packages.add(row.package_name);
        categories.set(row.package_name, row.category);
      }

      cache = { ts: Date.now(), packages, categories };
      return cache;
    } catch (e) {
      logger.error(
        'getAppCategories',
        'unexpected error',
        e instanceof Error ? e.message : '',
      );
      return cache ?? { ts: 0, packages: new Set(), categories: new Map() };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function isSocialMediaPackage(packageName: string | null | undefined): boolean {
  if (!packageName) return false;
  return cache?.packages.has(packageName) ?? false;
}

export function getCategoryFor(
  packageName: string | null | undefined,
): string | null {
  if (!packageName) return null;
  return cache?.categories.get(packageName) ?? null;
}

/**
 * Warms the cache when the app starts so the parent can open the app-selection
 * screen instantly. Also subscribes to AppState so the cache refreshes when
 * the app returns from background if the TTL has expired.
 */
export function primeAppCategoriesCache(): void {
  // Fire-and-forget; failures are logged inside getAppCategories().
  void getAppCategories().catch(() => {
    /* swallowed */
  });

  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    if (cache && Date.now() - cache.ts < TTL_MS) return;
    void getAppCategories().catch(() => {
      /* swallowed */
    });
  });
}
