import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/use-auth-store';
import { logger } from '@/services/logger';

export interface SetupStatus {
  loading: boolean;
  hasPair: boolean;
  setupComplete: boolean;
  incompletePairId: string | null;
}

/**
 * Tracks the parent's onboarding/setup progress.
 *
 * - hasPair: at least one active/pending pair exists for this parent device
 * - setupComplete: at least one pair has parent_setup_completed = true
 * - incompletePairId: the id of a pair that still needs app filters chosen
 *
 * Used to show a gentle "finish setup" banner when the parent opens the
 * dashboard before completing onboarding, and to drive the setup hub.
 */
export function useSetupStatus(): SetupStatus {
  const deviceId = useAuthStore((s) => s.deviceId);
  const [loading, setLoading] = useState(true);
  const [hasPair, setHasPair] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [incompletePairId, setIncompletePairId] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      setHasPair(false);
      setSetupComplete(false);
      setIncompletePairId(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('pairs')
        .select('id, parent_setup_completed, status')
        .eq('parent_device_id', deviceId)
        .in('status', ['active', 'pending']);

      if (cancelled) return;

      if (error) {
        logger.warn('useSetupStatus: load failed', error.message);
        setLoading(false);
        return;
      }

      const pairs = data || [];
      const completed = pairs.some((p) => p.parent_setup_completed);
      const incomplete = pairs.find((p) => !p.parent_setup_completed);

      setHasPair(pairs.length > 0);
      setSetupComplete(completed);
      setIncompletePairId(incomplete ? incomplete.id : null);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`setup_status_${deviceId}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pairs',
          filter: `parent_device_id=eq.${deviceId}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  return { loading, hasPair, setupComplete, incompletePairId };
}
