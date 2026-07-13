import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';

/**
 * Protects a route by role. If the user's role doesn't match the required role,
 * redirects to /role-selection.
 * 
 * Usage: Call this hook in any route that should be restricted by role.
 */
export function useProtectedRoute(allowedRoles: 'parent' | 'child' | ('parent' | 'child')[]) {
  const { _hasHydrated, isAuthenticated, userRole } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!allowed.includes(userRole as any)) {
      router.replace('/role-selection');
    }
  }, [_hasHydrated, isAuthenticated, userRole, allowedRoles]);
}

/**
 * Guard for the admin section. Redirects to /login when not authenticated,
 * and to /onboarding when the user is not an admin.
 */
export function useProtectedRouteAdmin() {
  const { _hasHydrated, isAuthenticated, userRole } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (userRole !== 'admin') {
      router.replace('/onboarding');
    }
  }, [_hasHydrated, isAuthenticated, userRole]);
}
