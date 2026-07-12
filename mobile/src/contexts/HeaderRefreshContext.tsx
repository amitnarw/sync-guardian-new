import React, { createContext, useContext, useCallback, useState } from 'react'
import { usePathname } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'

type RefreshFn = () => void | Promise<void>

interface HeaderRefreshContextValue {
  refreshMap: Record<string, RefreshFn>
  setRefresh: (key: string, fn: RefreshFn | null) => void
}

const HeaderRefreshContext = createContext<HeaderRefreshContextValue>({
  refreshMap: {},
  setRefresh: () => {},
})

export function HeaderRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshMap, setRefreshMap] = useState<Record<string, RefreshFn>>({})
  const setRefresh = useCallback((key: string, fn: RefreshFn | null) => {
    setRefreshMap(prev => {
      const next = { ...prev }
      if (fn) {
        next[key] = fn
      } else {
        delete next[key]
      }
      return next
    })
  }, [])
  return (
    <HeaderRefreshContext.Provider value={{ refreshMap, setRefresh }}>
      {children}
    </HeaderRefreshContext.Provider>
  )
}

export function useHeaderRefresh(): HeaderRefreshContextValue {
  return useContext(HeaderRefreshContext)
}

export function useRegisterHeaderRefresh(fn: RefreshFn | null) {
  const { setRefresh } = useHeaderRefresh()
  const pathname = usePathname()
  const key = pathname.split('/').filter(Boolean).pop() ?? ''

  useFocusEffect(
    useCallback(() => {
      if (key && fn) setRefresh(key, fn)
      return () => setRefresh(key, null)
    }, [key, fn, setRefresh]),
  )
}
