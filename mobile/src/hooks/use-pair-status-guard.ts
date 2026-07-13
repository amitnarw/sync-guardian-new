import { useEffect, useCallback, useRef } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/use-auth-store'
import { useAppModal } from '@/hooks/use-app-modal'
import { logger } from '@/services/logger'

export function usePairStatusGuard(role: 'parent' | 'child') {
  const pairId = useAuthStore((s) => s.pairId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const clearPair = useAuthStore((s) => s.clearPair)
  const { showModal } = useAppModal()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const redirectingRef = useRef(false)

  const shownRef = useRef(false);

  const handleRevoked = useCallback(() => {
    if (shownRef.current) return;
    shownRef.current = true;

    if (role === 'child') {
      clearPair()
      router.replace('/pairing')
    } else {
      showModal({
        title: 'Child Disconnected',
        message: 'A child device has disconnected from your account.',
        icon: 'warning',
        primaryButton: 'Okay',
      })
    }
  }, [role, clearPair, showModal])

  // When the child has no pairId but is authenticated, redirect to pairing.
  // Handles cold-restart after revocation (persisted pairId=null) and the
  // case where FCM clears pairId while the app is backgrounded.
  useEffect(() => {
    if (role !== 'child' || !isAuthenticated) return
    if (pairId) return
    if (redirectingRef.current) return
    redirectingRef.current = true
    router.replace('/pairing')
  }, [pairId, isAuthenticated, role])

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

  // Reset the redirect guard when the pairing screen re-mounts with a valid
  // pairId (user re-paired successfully).
  useEffect(() => {
    if (pairId) {
      redirectingRef.current = false
    }
  }, [pairId])
}
