# Sync Guardian

Cross-platform mobile app with Express backend.

## Project Structure

```
sync-guardian/
├── mobile/          # React Native/Expo mobile app (SDK 55)
│   ├── src/
│   │   ├── app/     # expo-router file-based routes
│   │   ├── components/
│   │   ├── constants/
│   │   ├── hooks/
│   │   └── assets/
│   ├── app.json     # Expo configuration
│   └── package.json
├── backend/         # Express 5 + Firebase backend
│   ├── src/
│   └── package.json
└── .claude/         # Claude Code configuration
```

## Mobile App (Expo SDK 55)

### Tech Stack
- **Framework**: Expo SDK 55.0.15
- **Runtime**: React Native 0.83.4, React 19.2.0
- **Routing**: expo-router ~55.0.12 (file-based routing)
- **Navigation**: Native tabs via `expo-router/unstable-native-tabs`
- **Animations**: react-native-reanimated 4.2.1
- **Path Aliases**: `@/*` maps to `./src/*`

### Routing Structure (`src/app/`)
Routes are defined using expo-router file-based routing in `src/app/`:

| File | Route | Description |
|------|-------|-------------|
| `src/app/_layout.tsx` | - | Root layout with ThemeProvider + AppTabs |
| `src/app/index.tsx` | `/` | Home screen |
| `src/app/explore/index.tsx` | `/explore` | Explore screen (docs showcase) |

### App Directory Configuration
The `appDirectory` is set to `./src/app` in `app.json > experiments` for expo-router.

### Development Commands
```bash
cd mobile
npm start        # Start Expo (all platforms)
npm run android  # Start for Android
npm run ios      # Start for iOS
npm run web      # Start for web
npm run reset-project  # Reset to template
```

### Key Components
- `src/components/app-tabs.tsx` - Native mobile tabs
- `src/components/app-tabs.web.tsx` - Web tabs (expo-router/ui)
- `src/components/animated-icon.tsx` - Animated Expo logo
- `src/components/ui/collapsible.tsx` - Reanimated collapsible sections
- `src/hooks/use-theme.ts` - Theme hook
- `src/constants/theme.ts` - Colors, fonts, spacing constants

### Expo Go Specifics
- Uses `NativeTabs` from `expo-router/unstable-native-tabs`
- Tab triggers must match route names (e.g., `NativeTabs.Trigger name="explore"` maps to `/explore`)
- The app runs on Android and iOS via Expo Go

## Backend

### Tech Stack
- **Runtime**: Node.js with Express 5
- **Firebase**: Admin SDK for push notifications
- **Language**: TypeScript

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sync/status` | Returns sync status (syncLevel, devices) |
| POST | `/api/notifications/send` | Send Firebase push notification |

## Claude Code Configuration

### MCP Servers
Configured in `.claude/settings.local.json`:
- WebSearch for internet research
- WebFetch for Expo documentation (docs.expo.dev)

### Path Aliases
TypeScript path aliases configured in `mobile/tsconfig.json`:
- `@/*` → `./src/*`
- `@/assets/*` → `./assets/*`

## Development Notes

### Metro Bundler Cache
If routing issues occur, clear the cache:
```bash
npx expo start --clear
```

### Typed Routes
The project has `typedRoutes: true` in `app.json > experiments` for type-safe routing.

---

## Coding Rules & Conventions

### General
- TypeScript strict mode always — no `any` types ever
- Use `@/*` path aliases, never relative `../../` imports
- Every component must handle 3 states: loading, error, empty
- No inline styles — use StyleSheet or Tailwind classes only
- Prefer named exports over default exports for components

### React Native Specific
- Use `FlashList` from `@shopify/flash-list` — NEVER use `FlatList`
- Use `KeyboardAvoidingView` on all screens with inputs
- Use `SafeAreaView` from `react-native-safe-area-context` not RN core
- Avoid `useEffect` for data fetching — use TanStack Query instead
- All animations via `react-native-reanimated` — never `Animated` from RN core

### Navigation (Expo Router v7)
- File-based routing only — no programmatic route registration
- Use `router.push()` for navigation, `router.replace()` for auth redirects
- `NativeTabs` triggers must exactly match route folder/file names
- `unstable-native-tabs` is beta — always test on physical Android device
- Protected routes go in `(auth)` group, public routes in `(public)` group

### Components
- UI components in `src/components/ui/` — pure, no business logic
- Screen-level components in `src/app/` — connected to state/queries
- Reusable components must accept `style` prop for overrides
- Always add `testID` props to interactive elements

### State Management
- Server state (API data) → TanStack Query only
- Client/UI state → Zustand only
- Never store server data in Zustand
- MMKV for persisting Zustand state
- Expo SecureStore for tokens and sensitive credentials only

### API Calls (Backend)
- All API calls through a centralized `src/lib/api.ts` client
- Always handle 401 → redirect to login
- Use TanStack Query mutations for POST/PUT/DELETE
- Never call `fetch()` directly in components

### Backend (Express 5 + Firebase Admin)
- Initialize Firebase Admin SDK once in `src/config/firebase.ts`
- Verify Firebase ID tokens in middleware, not in route handlers
- Use `async/await` with try/catch — never `.then().catch()` chains
- Environment variables via `process.env` — never hardcode credentials
- All routes return `{ success, data, error }` shape consistently

### NativeTabs (SDK 55 specific)
- Use `NativeTabs.Trigger.Icon` with `md="icon_name"` for Android Material icons
- Tab icons must use `md` prop (Material Design) for Android, `sf` for iOS
- Wrap NativeTabs in `ThemeProvider` from `@react-navigation/native` for dark mode
- Known bug: safe area flash on first tab visit — use `initialRouteName` to preload [web:215]

### Anti-Patterns (Never Do These)
- ❌ Never use `FlatList` — always `FlashList`
- ❌ Never use `AsyncStorage` — use MMKV or SecureStore
- ❌ Never store JWT tokens in MMKV — use SecureStore only
- ❌ Never call API directly in `useEffect` — use TanStack Query
- ❌ Never use `any` type in TypeScript
- ❌ Never hardcode API URLs — use `src/constants/config.ts`
- ❌ Never use `expo-router/unstable-native-tabs` without physical device testing