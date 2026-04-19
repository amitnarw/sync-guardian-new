import { AuthColors } from '@/constants/auth-theme';

export function useAuthTheme() {
  // Auth screens only support light mode in this design system
  // The Digital Sanctuary is designed for light mode
  return AuthColors;
}