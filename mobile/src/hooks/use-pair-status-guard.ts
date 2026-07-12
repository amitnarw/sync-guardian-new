import { useEffect, useCallback, useRef } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/use-auth-store'
import { useAppModal } from '@/hooks/use-app-modal'
import { logger } from '@/services/logger'

export function usePairStatusGuard(role: 'parent' | 'child') {
  const pairId = useAuthStore((s) => s.pairId)
  const clearPair = useAuthStore((s) => s.clearPair)
  const { showModal } = useAppModal()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const shownRef = useRef(false);

  const handleRevoked = useCallback(() => {
    if (shownRef.current) return;
    shownRef.current = true;

    if (role === 'child') {
      clearPair()
      showModal({
        title: 'Pair Disconnected',
        message: 'Your parent disconnected this device. Tap Reconnect to pair again.',
        icon: 'warning',
        primaryButton: 'Reconnect',
        onPrimaryPress: () => router.replace('/pairing'),
        secondaryButton: 'Cancel',
        onSecondaryPress: () => router.replace('/pairing'),
      })
    } else {
      showModal({
        title: 'Child Disconnected',
        message: 'A child device has disconnected from your account.',
        icon: 'warning',
        primaryButton: 'Okay',
      })
    }
  }, [role, clearPair, showModal])

  useEffect(() => {
    if (!pairId) return

    const validate = async () => {
      try {
        const { data, error } = await supabase
          .from('pairs')
          .select('status')
          .eq('id', pairId)
          .single()
        if (error || !data || data.status !== 'active') {
          handleRevoked()
        }
      } catch (err) {
        logger.warn('usePairStatusGuard: validation error', err)
      }
    }
    validate()

    const channel = supabase
      .channel(`pair_status_${pairId}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pairs',
          filter: `id=eq.${pairId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status
          if (newStatus === 'revoked') {
            handleRevoked()
          }
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      shownRef.current = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [pairId, handleRevoked])
}
