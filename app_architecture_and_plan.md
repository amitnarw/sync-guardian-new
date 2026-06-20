# Sync Guardian: Product, Architecture, and Implementation Specification

This document is the **definitive blueprint** for building Sync Guardian. It supersedes any previous plans (such as the old Express/Socket.io architecture).

## 1. Overview & Core Goal
Sync Guardian is a **single Android app** that operates in either **Parent** or **Child** mode. 
- The app intercepts and mirrors notifications from a Child device to a Parent device.
- It operates in near real-time, persists mirrored notifications to a database, and alerts the Parent with push notifications when the Parent app is not actively open.
- **Android Only**: This feature relies on Android's `NotificationListenerService`. Apple iOS strictly prohibits reading other apps' notifications due to sandboxing. There is no iOS support for this app.

## 2. Final Technology Decisions
The stack has been strictly defined to ensure reliability, offline support, and scalability without overwhelming maintenance.

### Mobile App
- **Framework:** Expo + React Native (Must be run as a native Android build `npx expo run:android`, not Expo Go).
- **Notification Capture:** `react-native-android-notification-listener` (Native Android module wrapper).
- **Local Buffer:** **MMKV** for ultra-fast local persistence of unsent notifications when the Child device loses internet.
- **State Management:** Zustand.
- **Push Delivery:** FCM (Firebase Cloud Messaging) for background wake-ups.

### Backend Infrastructure
We are **not** using a custom Node.js/Express backend.
- **Backend Platform:** **Supabase** (Provides Postgres DB, Auth, Realtime, and Edge Functions).
- **Realtime Transport:** Supabase Realtime (for the live dashboard when the Parent app is open).
- **Backend Logic:** Supabase Edge Functions (Typescript) for pairing logic and triggering pushes.

## 3. Why Supabase over Express / Socket.io?
While Socket.io is valid for real-time delivery, Supabase reduces backend maintenance by providing the database, auth, edge functions, and real-time sockets in one managed platform. Since we must persist notification history anyway, utilizing Supabase Realtime removes the need for a separate custom Express/Socket.io server.

## 4. Core Application Flows

### Pairing Flow
1. Child selects "Child mode" and requests a pairing token from the Supabase Edge Function.
2. App generates a short-lived token (10 mins) and displays it as both a **6-digit code** and a **QR Code**.
3. Parent chooses "Parent mode" and scans the QR code or manually enters the 6-digit code.
4. Supabase validates the token, binds the devices in the database, and both route to their dashboards.

### Child Capture Flow (Sender)
1. Android receives a notification.
2. `react-native-android-notification-listener` grabs the payload (Title, Body, App Name).
3. The app applies the user's filters (e.g., "Only mirror WhatsApp").
4. Sends payload to Supabase Database.
5. **Offline safety**: If offline, saves to `MMKV` buffer. Once online, flushes the MMKV buffer to Supabase in order.

### Parent Delivery Flow (Receiver)
- **If Parent app is FOREGROUND/ACTIVE**: Supabase Realtime pushes the event instantly to the dashboard.
- **If Parent app is BACKGROUND/CLOSED**: Supabase Edge Functions triggers an FCM Push Notification to wake the Parent device. (To avoid spam, if 4+ notifications arrive within 15 seconds, they are batched into a single push summary).
- **When Parent Re-opens App**: Missed history is fetched directly from the PostgreSQL database.

## 5. Database Design (Supabase Postgres)

The following tables are required:
- `devices`: `id`, `role`, `device_name`, `push_token`, `is_foreground`, `last_seen_at`.
- `pairs`: `id`, `parent_device_id`, `child_device_id`, `status`.
- `pairing_tokens`: `code`, `token`, `expires_at`.
- `child_app_filters`: Which apps the child has enabled for mirroring.
- `mirrored_notifications`: `id`, `pair_id`, `source_app_name`, `title`, `body`, `delivery_mode`.

## 6. Required Supabase Edge Functions
- `create-pairing-token`
- `claim-pairing-token`
- `ingest-child-notification` (Validates, stores in DB, and decides whether to trigger FCM push based on Parent's `is_foreground` state).
- `send-parent-push`

## 7. Implementation Checklist for AI Agents
If you are an AI agent reading this to continue development, follow this strict sequence:

- [ ] **Step 1**: Delete the old `backend` folder containing the Express server. It is obsolete.
- [ ] **Step 2**: Initialize a local Supabase project structure to replace the backend. Write the initial SQL migrations for the `devices`, `pairs`, and `mirrored_notifications` tables.
- [ ] **Step 3**: Write the core Supabase Edge Functions (pairing and ingestion).
- [ ] **Step 4**: Inside `mobile/`, install the new core dependencies: `react-native-android-notification-listener`, `react-native-mmkv`, and FCM push modules.
- [ ] **Step 5**: Set up the Expo Config Plugins for the native Android `NotificationListenerService`.
- [ ] **Step 6**: Build the mobile Pairing UI (QR Scanner) and link it to the Supabase Edge Functions.
- [ ] **Step 7**: Implement the Child notification interceptor and MMKV buffering.
- [ ] **Step 8**: Implement the Parent real-time dashboard using Supabase Realtime subscriptions.
