# Sync Guardian

Cross-platform mobile app with Express backend for real-time device synchronization and push notifications.

## Project Structure

```
sync-guardian/
├── mobile/          # React Native/Expo mobile app (SDK 55)
│   ├── src/
│   │   ├── app/     # expo-router file-based routes
│   │   ├── components/
│   │   ├── constants/
│   │   ├── hooks/
│   │   └── lib/
│   └── package.json
├── backend/         # Express 5 + Firebase backend
│   ├── src/
│   └── package.json
└── .claude/         # Claude Code configuration
```

## Tech Stack

### Mobile App
- **Framework**: Expo SDK 55.0.15
- **Runtime**: React Native 0.83.4, React 19.2.0
- **Routing**: expo-router ~55.0.12 (file-based routing)
- **Navigation**: Native tabs via `expo-router/unstable-native-tabs`
- **Animations**: react-native-reanimated 4.2.1
- **State**: Zustand (client) + TanStack Query (server)

### Backend
- **Runtime**: Node.js with Express 5
- **Firebase**: Admin SDK for push notifications
- **Language**: TypeScript

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Mobile App Setup

```bash
cd mobile
npm install
npm start        # Start Expo (all platforms)
npm run android  # Start for Android
npm run ios      # Start for iOS (macOS only)
npm run web      # Start for web
```

### Backend Setup

```bash
cd backend
npm install
npm run dev      # Development mode with hot reload
npm run build    # Build for production
npm start        # Run production server
```

### Environment Variables

**Backend** (create `.env` in backend directory):
```
PORT=5000
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sync/status` | Returns sync status (syncLevel, devices) |
| POST | `/api/notifications/send` | Send Firebase push notification |

### Sync Status Response
```json
{
  "syncLevel": 94,
  "lastSync": "2026-04-19T10:30:00.000Z",
  "devices": [
    { "name": "iPhone 15", "status": "connected" },
    { "name": "iPad Pro", "status": "connected" },
    { "name": "Samsung Tab S9", "status": "syncing" }
  ]
}
```

### Send Notification Request
```json
{
  "token": "device_fcm_token",
  "title": "Sync Complete",
  "body": "Your devices are now synced"
}
```

## Features

- Real-time device sync status monitoring
- Cross-platform mobile app (Android, iOS, Web)
- Firebase push notifications
- Native tab navigation
- File-based routing with type-safe routes

## Development Notes

### Metro Bundler Cache
If routing issues occur, clear the cache:
```bash
npx expo start --clear
```

### Typed Routes
The project has `typedRoutes: true` in `app.json > experiments` for type-safe routing.

## License

Private - All rights reserved
