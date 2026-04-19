---
name: native-data-fetching
description: Network requests, API calls, caching, and offline support
version: 1.0.0
license: MIT
---

# Expo Networking Skill

The document has been provided above in its entirety. It is a comprehensive guide covering:

- **Core Networking**: Fetch API usage, avoiding axios in favor of expo/fetch
- **React Query Integration**: Setup, data fetching, mutations, caching, offline sync
- **Error Handling**: Custom error classes, retry logic with exponential backoff
- **Authentication**: Secure token storage with expo-secure-store, token refresh flows
- **Offline Support**: NetInfo for connectivity detection, React Query persistence
- **Environment Variables**: EXPO_PUBLIC_ prefix for client-side config, build-time inlining
- **Request Cancellation**: AbortController patterns
- **Common Mistakes**: Security warnings against AsyncStorage for tokens, importance of response.ok checks

The document includes TypeScript examples throughout and a decision tree for selecting the appropriate approach.

**Key constraint highlighted**: Only `EXPO_PUBLIC_` prefixed variables are exposed to the client bundle. Non-prefixed variables are server-only (API routes). Never store secrets in client-accessible variables.
