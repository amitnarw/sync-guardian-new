import { supabase } from '@/lib/supabase';
import { getInstalledApps } from 'notification-access';
import { logger } from '@/services/logger';
import { getAppCategories } from '@/services/app-categories';

interface InstalledAppPayload {
  package_name: string;
  app_name?: string | null;
  app_icon_base64?: string | null;
}

export interface SyncInstalledAppsResult {
  synced: boolean;
  count: number;
}

const EMPTY_RESULT: SyncInstalledAppsResult = { synced: false, count: 0 };

// Syncs the child device's installed social-media / messaging / dating apps to
// the backend so the parent can choose which ones to monitor. Non-social
// launcher apps are filtered out client-side; the edge function re-filters as
// a defense-in-depth check. New social-media apps are mirrored by default
// server-side; the parent opts out.
//
// The edge function is ALWAYS invoked, even when zero monitorable apps are
// found. It records the sync attempt on the pair row so the parent's wait
// screen can advance and show "no apps found" instead of waiting forever.
export async function syncInstalledApps(childDeviceId: string): Promise<SyncInstalledAppsResult> {
  try {
    if (!childDeviceId) {
      logger.warn('syncInstalledApps', 'missing child device id');
      return EMPTY_RESULT;
    }

    const apps = getInstalledApps();
    if (!apps || apps.length === 0) {
      logger.warn('syncInstalledApps', 'no installed apps returned from native module');
      return EMPTY_RESULT;
    }

    const { packages: allowedPackages } = await getAppCategories();
    const socialApps = apps.filter((a) => allowedPackages.has(a.packageName));

    const payload = {
      child_device_id: childDeviceId,
      apps: socialApps.map((a) => ({
        package_name: a.packageName,
        app_name: a.appName,
        app_icon_base64: a.appIconBase64,
      })) as InstalledAppPayload[],
    };

    const { data, error } = await supabase.functions.invoke('sync-installed-apps', { body: payload });
    if (error) {
      let detail = error.message;
      try {
        const ctx = (error as any)?.context;
        if (ctx) {
          const body = await ctx.json();
          if (body?.error) detail = body.error;
        }
      } catch {}
      logger.error('syncInstalledApps', 'failed to sync installed apps', detail);
      return EMPTY_RESULT;
    }

    const count = (data as any)?.data?.total ?? socialApps.length;
    logger.info('syncInstalledApps', `synced ${count} social-media apps`);
    return { synced: true, count };
  } catch (e) {
    logger.error('syncInstalledApps', 'unexpected error', e instanceof Error ? e.message : '');
    return EMPTY_RESULT;
  }
}
