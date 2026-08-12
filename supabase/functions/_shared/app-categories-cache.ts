// In-memory cache of the app_categories whitelist for use inside edge
// functions. The duration is short so admins can iterate on the list via
// SQL without forcing a deploy, but long enough to avoid hammering the DB
// across the many notifications a busy edge function processes.
//
// Note: this is per-instance. Supabase may run multiple isolate instances
// behind the function URL, so cache values are eventually consistent across
// instances but always read-at-most-once-per-TTL per instance.

interface Cache {
  ts: number
  packages: Set<string>
  categories: Map<string, string>
}

let cache: Cache | null = null
const TTL_MS = 5 * 60 * 1000

export type AdminClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => Promise<{ data: Array<{ package_name: string; category: string }> | null }>
    }
  }
}

export interface AppCategoriesData {
  packages: Set<string>
  categories: Map<string, string>
}

export async function getEnabledAppCategories(admin: AdminClient): Promise<AppCategoriesData> {
  if (cache && Date.now() - cache.ts < TTL_MS) {
    return { packages: cache.packages, categories: cache.categories }
  }

  const { data } = await admin
    .from('app_categories')
    .select('package_name, category')
    .eq('enabled', true)

  const packages = new Set<string>()
  const categories = new Map<string, string>()
  for (const row of data ?? []) {
    packages.add(row.package_name)
    categories.set(row.package_name, row.category)
  }

  cache = { ts: Date.now(), packages, categories }
  return { packages, categories }
}

export function isSocialMediaPackage(packages: Set<string>, packageName: string | null | undefined): boolean {
  if (!packageName) return false
  return packages.has(packageName)
}

// Test-only helper: clear the in-memory cache so the next call re-fetches.
export function _resetCacheForTests(): void {
  cache = null
}
