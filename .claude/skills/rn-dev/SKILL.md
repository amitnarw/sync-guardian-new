---
name: rn-dev
description: React Native and Expo development workflow. Use when adding new screens, implementing navigation, installing packages, or any React Native development task.
when_to_use: When working on mobile app features, adding navigation, installing expo packages, creating components, or modifying the React Native app.
---

# React Native Development Skill

## Project Structure

```
mobile/
├── src/
│   ├── app/           # expo-router routes
│   ├── components/    # React components
│   ├── constants/     # Theme, config constants
│   ├── hooks/         # Custom hooks
│   └── assets/        # Images, fonts
├── app.json          # Expo configuration
└── package.json
```

## expo-router Patterns

### Adding a New Screen
1. Create file in `src/app/<route>/index.tsx`
2. Use default export for the screen component
3. Import shared components from `@/components/`

### Route File Example
```tsx
import { useColorScheme } from 'react-native';
import { ThemedText } from '@/components/themed-text';

export default function MyScreen() {
  const scheme = useColorScheme();
  return <ThemedText type="title">Hello</ThemedText>;
}
```

## Package Installation

Always use `npx expo install` instead of `npm install` for Expo packages:
```bash
npx expo install @react-navigation/native
npx expo install react-native-reanimated
```

## Key Packages (SDK 55)
- expo: ~55.0.15
- expo-router: ~55.0.12
- react-native: 0.83.4
- react-native-reanimated: 4.2.1
- react-native-screens: ~4.23.0
- react-native-safe-area-context: ~5.6.2

## Path Aliases
- `@/*` → `./src/*`
- Use `@/components/...` for components
- Use `@/hooks/...` for hooks
- Use `@/constants/...` for constants

## Testing
- Use Expo Go for quick testing
- For device-specific issues, test on physical device
- Use `console.log` and React Native Debugger for JS debugging
