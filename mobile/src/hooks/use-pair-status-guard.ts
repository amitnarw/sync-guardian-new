import { useEffect, useCallback, useRef } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { isValidUUID } from '@/lib/uuid'
import { useAuthStore } from '@/hooks/use-auth-store'
import { useAppModal } from '@/hooks/use-app-modal'
import { logger } from '@/services/logger'

export function usePairStatusGuard(role: 'parent' | 'child') {
  const pairId = useAuthStore((s) => s.pairId)
  const deviceId = useAuthStore((s) => s.deviceId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const clearPair = useAuthStore((s) => s.clearPair)
  const markPairRevoked = useAuthStore((s) => s.markPairRevoked)
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
      markPairRevoked()
    }
  }, [role, clearPair, showModal, markPairRevoked])

  // Allow the parent disconnect modal to surface again the next time a
  // different child's status changes.
  const lastShownPairRef = useRef<string | null>(null)
  const showRevokedModal = useCallback(
    (pairIdValue: string) => {
      if (lastShownPairRef.current === pairIdValue && shownRef.current) return;
      lastShownPairRef.current = pairIdValue;
      handleRevoked();
    },
    [handleRevoked],
  )
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

  // Parents: watch every active/pending pair that belongs to this parent
  // device. Revoked pairs are deleted immediately by `revoke-pair`, so a
  // DELETE event on the `pairs` table signals that a child disconnected.
  // Children: continue watching the single pairId (their own pairing).
  useEffect(() => {
    if (role === 'parent') {
      if (!isValidUUID(deviceId)) return

      const channel = supabase
        .channel(`pairs_parent_${deviceId}_${Math.random().toString(36).slice(2)}`)
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'pairs',
            filter: `parent_device_id=eq.${deviceId}`,
          },
          (payload) => {
            const oldRow = payload.old as any
            if (oldRow?.id) showRevokedModal(oldRow.id)
            markPairRevoked()
          },
        )
        .subscribe()

      channelRef.current = channel

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
        }
        // Reset modal state so the next mount can surface disconnects
        // again, even for the same pair.
        shownRef.current = false
        lastShownPairRef.current = null
      }
    }

    if (!isValidUUID(pairId)) return

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
          event: '*',
          schema: 'public',
          table: 'pairs',
          filter: `id=eq.${pairId}`,
        },
        (payload) => {
          // Revoked pairs are deleted from the `pairs` table by
          // `revoke-pair`, so a DELETE event is the only signal.
          // The initial `validate()` above also catches the case
          // where the row is already missing.
          const eventType = (payload as any).eventType
          if (eventType === 'DELETE') {
            handleRevoked()
          }
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      shownRef.current = false
      lastShownPairRef.current = null
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [pairId, deviceId, role, handleRevoked, markPairRevoked, showRevokedModal])

  // Reset the redirect guard when the pairing screen re-mounts with a valid
  // pairId (user re-paired successfully).
  useEffect(() => {
    if (pairId) {
      redirectingRef.current = false
    }
  }, [pairId])
}
