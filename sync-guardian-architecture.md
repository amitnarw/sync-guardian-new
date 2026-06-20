# Sync Guardian: Product, Architecture, and Implementation Specification

This document is a complete implementation brief for building **Sync Guardian**, a single Android app that can operate in either **Parent** mode or **Child** mode. The app mirrors notifications from a Child device to a Parent device in near real time, persists mirrored notifications, and alerts the Parent with push notifications when the Parent app is not actively open.[cite:35][cite:46][cite:94]

The chosen stack is **Expo/React Native for the mobile app**, **Supabase for backend services**, **FCM for Android push delivery**, **MMKV for local device buffering**, and **react-native-android-notification-listener** for Android notification capture.[cite:46][cite:57][cite:83][cite:94]

## Product scope

### Core goal

The product mirrors notifications received on a Child Android device to a Parent device using a single shared app with role-based behavior.[cite:35][cite:46] The Parent receives a live in-app feed when actively using the app, and receives push notifications when the app is backgrounded or closed.[cite:75][cite:82][cite:124]

### Supported platform

The notification interception feature is **Android only** because Android provides `NotificationListenerService`, while iOS does not allow one app to read other apps' notifications due to sandbox restrictions.[cite:35][cite:41]

### Out of scope

This specification covers **notification mirroring only**. It does not include location tracking, iOS notification interception, browser support, or a separate admin web panel in the first implementation phase.[cite:35][cite:41]

## Final technology decisions

### Mobile app

- **Framework:** Expo + React Native, but tested and run as a native Android build rather than Expo Go because custom native notification-listener behavior requires native Android integration.[cite:15][cite:19]
- **Single app / dual roles:** one app binary for both Parent and Child; role is selected during onboarding and saved in app state and backend profile.[cite:124][cite:138]
- **Notification listener:** `react-native-android-notification-listener`, which wraps Android notification-listener functionality and exposes notification data to React Native.[cite:46]
- **Local buffer:** MMKV for fast local persistence of unsent notifications and lightweight device state.[cite:46]
- **Push reception:** FCM on Android for closed-app or inactive-app delivery and wake-up flows.[cite:57][cite:94]

### Backend

- **Backend platform:** Supabase for PostgreSQL, Auth, Realtime, Edge Functions, and Storage if needed later.[cite:83][cite:138]
- **Database:** PostgreSQL managed by Supabase.[cite:83]
- **Realtime:** Supabase Realtime for in-app live feed and presence-like connectivity tracking when the Parent app is open.[cite:67][cite:138]
- **Push orchestration:** Supabase Edge Functions calling FCM server APIs for Parent push notifications and Child wake-up messages when needed.[cite:75][cite:83][cite:94]

### Push provider

- **Push transport:** Firebase Cloud Messaging (FCM).[cite:94]
- **Reason:** FCM is the native Android push system, supports data and notification delivery, and is free to use.[cite:57][cite:94]
- **Current quota:** Firebase documents a default quota of **600,000 downstream messages per minute per project** for the HTTP v1 API, with additional device-level throttling rules.[cite:95]

## Why this architecture was chosen

### Why not Expo Go

Expo Go cannot run this app correctly because it is a shared sandbox app and does not contain the custom Android native service required for notification interception. Config plugins and native changes only take effect during native builds, not while running plain JavaScript inside Expo Go.[cite:15][cite:19]

### Development workflow

The mobile app should be developed with `npx expo run:android` or EAS Build rather than Expo Go. This allows full native Android code, local testing on a real APK, and standard React Native fast refresh for JavaScript changes.[cite:15][cite:19]

### Why not raw Socket.io as the main backend

Socket.io is valid for realtime delivery, but Supabase reduces backend maintenance by giving database, auth, functions, and realtime in one managed platform.[cite:61][cite:83] For this app, database persistence is required anyway, so using Supabase as the main backend keeps the system simpler to operate.[cite:67][cite:83]

### Why not PostgreSQL LISTEN/NOTIFY directly as the client transport

PostgreSQL `LISTEN/NOTIFY` is useful for backend signaling, but it is not the ideal direct mobile delivery layer for this product. This app needs persistent history, app presence checks, push integration, and mobile-friendly realtime subscriptions, which Supabase layers on top more cleanly than building directly on raw `LISTEN/NOTIFY` semantics.[cite:66][cite:72][cite:138]

## Role model: single app, two modes

### Parent mode

Parent mode allows the user to:
- pair with a Child device by scanning a QR code or entering a short code manually,
- receive a live notification feed while the app is open,
- receive Android push notifications while the app is not actively open,
- view persisted notification history,
- see Child connectivity or sync state,
- unpair the Child device when needed.[cite:75][cite:82][cite:124]

### Child mode

Child mode allows the user to:
- generate a pairing code and QR code,
- grant notification access permission,
- select which apps are mirrored,
- run notification capture in the background,
- buffer unsent mirrored notifications locally when offline,
- resend buffered notifications after reconnecting.[cite:35][cite:46]

## Core application flow

### Pairing flow

A Child device creates a short-lived pairing token using the backend. The app displays this token both as a numeric code and a QR code so the Parent can either type or scan it.[cite:83]

A recommended implementation is:
1. Child chooses Child mode.
2. Child requests a pairing token from Supabase Edge Function.
3. Backend creates a room or pair record with a short expiration, for example 10 minutes.
4. Child displays a 6-digit code and QR code encoding the same token.
5. Parent chooses Parent mode.
6. Parent enters the code or scans the QR code.
7. Backend validates the token, binds Parent and Child device records, and issues persistent pairing/session data.
8. Both devices move to their respective dashboards.[cite:83][cite:124]

This is preferable to QR-only pairing because manual numeric entry reduces friction when devices are not physically close.[cite:83]

### Child notification capture flow

1. Android receives a notification from another app.
2. `react-native-android-notification-listener` captures notification metadata such as app identifier, title, body, and timestamp.[cite:46]
3. The Child app applies app-filter rules chosen by the user.
4. The app sends the notification payload to a Supabase Edge Function or direct insert workflow.
5. If network delivery fails, the payload is stored in MMKV and marked pending.[cite:46]
6. When connectivity returns, pending payloads are flushed to the backend in order.[cite:46]

### Parent delivery flow

1. The backend persists the mirrored notification in PostgreSQL.[cite:83]
2. If the Parent app is in foreground, the Parent receives the update via Supabase Realtime and updates the live feed immediately.[cite:67][cite:138]
3. If the Parent app is backgrounded, screen-off, or closed, the backend sends an FCM push notification to the Parent device.[cite:75][cite:82][cite:124]
4. When the Parent opens the app again, the app loads missed history from the database and resumes live updates.[cite:83][cite:138]

## Realtime versus push: final rule

### Important principle

For this product, **push notifications are the primary alert channel**, and **realtime is the primary in-app sync channel**.[cite:75][cite:124] That means most Parent alerts will be delivered via push, because most of the time the Parent user will not be staring at the app in the foreground.[cite:124]

### Final delivery logic

Use the following policy:
- Parent app in foreground and active: send realtime update, no push by default.[cite:124]
- Parent app backgrounded, screen off, or app closed: send push notification.[cite:82][cite:124]
- Parent app reopens: fetch missed history from the database and continue realtime subscriptions.[cite:83][cite:138]

### Why screen-off still means push

It is not necessary to detect the literal screen-off state perfectly. The app only needs to know whether the Parent app is **foreground active** or not, and React Native `AppState` provides that information.[cite:124] If the Parent app is not active, push delivery should be enabled because mobile realtime connections are not reliable enough to be the sole alert path while apps are backgrounded or devices are sleeping.[cite:117][cite:123]

## Presence and activity model

### What should be stored

Do not overcomplicate presence with many separate booleans. For this app, store device/app presence fields such as:
- `is_foreground`
- `last_seen_at`
- `push_token`
- `role`
- `pair_id`
- `platform`
- `updated_at`[cite:124][cite:138]

A separate durable `userActive` field is usually unnecessary for the first version because each pairing effectively revolves around one Parent device and one Child device. Device presence is enough for push/realtime decisions.[cite:135][cite:138]

### When to update presence

Presence should be updated:
- on app launch,
- when `AppState` changes to `active`,
- when `AppState` changes to `background`,
- on reconnect to Supabase Realtime,
- and with a lightweight heartbeat while active, for example every 30 to 60 seconds.[cite:124][cite:126][cite:136]

### Realtime presence versus durable state

Use **Supabase Realtime Presence** or equivalent session tracking for temporary live connection state, and use the database `last_seen_at`/`is_foreground` fields as fallback truth.[cite:135][cite:138] In practice:
- database = durable state,
- realtime presence = live transient state.[cite:135][cite:138]

## Offline and reconnect behavior

### Child offline handling

If the Child device receives notifications while its network is unavailable or its outbound request fails, the app must store those notifications locally in MMKV and retry later.[cite:46] This ensures notifications are not lost merely because the Child temporarily lost connectivity.[cite:46]

### Parent offline handling

If the Parent device is offline, the backend still stores the notifications in PostgreSQL, and when the Parent reconnects the app loads missed records from the database.[cite:83][cite:138]

### App uninstall behavior

If the Child uninstalls the app, notification access is removed automatically by Android and local buffered data is lost with the app installation.[cite:35] This is unrecoverable by design. The correct behavior is for the Parent dashboard to eventually show the Child as disconnected or inactive based on presence timeout and failed delivery signals.[cite:124][cite:138]

## Handling service death and battery restrictions

### Child-side reliability problem

Some Android OEMs aggressively kill background components or apply custom battery restrictions beyond standard Android behavior. In such cases, the Child-side mirroring service may stop unexpectedly.[cite:121]

### Recovery strategy

Use a layered recovery strategy:
- request notification-access permission properly,
- educate the user to disable battery optimization for the app,
- keep local buffering with MMKV,
- optionally send a high-priority FCM data message to the Child device to wake or re-engage the app when service recovery is needed.[cite:31][cite:40][cite:121]

### UX for failure state

The Parent dashboard should show status such as:
- Child online,
- Child offline,
- Child app inactive,
- waiting for reconnect,
- battery optimization may be blocking sync.[cite:121][cite:124]

The Parent may also have a “wake child device” or “send recovery signal” action that triggers an FCM data message to the Child when appropriate.[cite:40][cite:57]

## Push notification strategy

### Why FCM is required

If the Parent app is closed or not foreground active, a live realtime channel is not enough to guarantee visible alert delivery. Android push notifications are the correct system-level alert path, and FCM is the standard transport for that on Android.[cite:57][cite:94]

### Is FCM free

Firebase states that there is **no cost to using Cloud Messaging**.[cite:94] Current Firebase documentation also states a default quota of **600,000 downstream messages per minute per project** for the HTTP v1 API.[cite:95]

### FCM use cases in this app

Use FCM for two distinct purposes:
1. **Parent alert push** — visible system notification when the Parent app is not active.[cite:75][cite:82]
2. **Child recovery/wake signal** — optional high-priority data message when the Child-side process needs recovery support.[cite:40][cite:57]

### Firebase setup requirement

Even though the main backend is Supabase, a Firebase project is still required to use FCM. The Android app must be registered in Firebase and the backend must have service-account credentials to send FCM messages.[cite:88][cite:94]

## High-volume notification handling

### Problem

A Child device may receive many notifications in a short time, for example large bursts from WhatsApp, Instagram, or SMS apps.[cite:109][cite:112]

### Correct approach

Do not send a visible Parent push for every single mirrored notification without rules. Instead, implement grouping and batching logic similar to messaging apps.[cite:105][cite:109]

### Recommended push policy

- If Parent is active: realtime only, no push.[cite:124]
- If Parent is inactive and 1–3 child notifications arrive within 15 seconds: send individual pushes.[cite:105]
- If 4 or more arrive within 15 seconds: send one summary push such as “8 new notifications from child device.”[cite:105][cite:109]
- The full underlying notifications must still be persisted individually in the database.[cite:83]

### Why this is necessary

This is how large messaging products avoid overwhelming users: they persist all events, but present grouped notifications to the system tray instead of flooding the user with one visible alert per event.[cite:108][cite:109][cite:111]

## Supabase usage model

### What Supabase will handle

Supabase is the main backend and should handle:
- authentication and user identities,
- device and pairing records,
- notification history persistence,
- realtime subscriptions for Parent live feed,
- Edge Functions for pairing validation, push sending, and ingestion logic.[cite:83][cite:138]

### What Supabase will not replace by itself

Supabase does not eliminate the need for Android push transport. Closed-app Parent alerts still need a push provider such as FCM.[cite:75][cite:81] Supabase Edge Functions can trigger FCM, but Supabase itself is not the Android system push network.[cite:75][cite:83]

## Database design

### Recommended core tables

#### `users`

Stores authenticated users if account login is required.

Suggested fields:
- `id`
- `email` or phone-based identifier
- `created_at`
- `updated_at`

#### `devices`

Stores individual app installations/devices.

Suggested fields:
- `id`
- `user_id` nullable if anonymous pairing is allowed initially
- `role` (`parent` or `child`)
- `platform` (`android`)
- `device_name`
- `app_version`
- `push_token`
- `is_foreground`
- `last_seen_at`
- `battery_optimization_disabled` nullable
- `notification_permission_granted`
- `notification_listener_granted` for child mode
- `created_at`
- `updated_at`

#### `pairs`

Represents a Parent–Child relationship.

Suggested fields:
- `id`
- `parent_device_id`
- `child_device_id`
- `status` (`pending`, `active`, `revoked`)
- `paired_at`
- `revoked_at`
- `created_at`
- `updated_at`

#### `pairing_tokens`

Short-lived pairing codes/QR payloads.

Suggested fields:
- `id`
- `pair_id` nullable until claimed
- `child_device_id`
- `code`
- `token`
- `expires_at`
- `consumed_at`
- `created_at`

#### `child_app_filters`

Per-child app selection rules.

Suggested fields:
- `id`
- `child_device_id`
- `package_name`
- `is_enabled`
- `created_at`
- `updated_at`

#### `mirrored_notifications`

Persistent notification history.

Suggested fields:
- `id`
- `pair_id`
- `child_device_id`
- `source_package`
- `source_app_name`
- `notification_title`
- `notification_body`
- `notification_posted_at`
- `ingested_at`
- `delivery_mode` (`realtime`, `push`, `both`, `pending`)
- `batch_id` nullable
- `metadata_json`

#### `push_delivery_logs`

Optional delivery log for troubleshooting.

Suggested fields:
- `id`
- `notification_id`
- `target_device_id`
- `provider` (`fcm`)
- `status`
- `error_code` nullable
- `sent_at`
- `created_at`

## Edge Functions and backend logic

### Edge Functions to create

Recommended functions:
- `create-pairing-token`
- `claim-pairing-token`
- `ingest-child-notification`
- `flush-child-buffer`
- `send-parent-push`
- `send-child-recovery-push`
- `update-device-presence`
- `unpair-devices`[cite:75][cite:83]

### Notification ingestion function behavior

`ingest-child-notification` should:
1. authenticate the Child device,
2. validate pairing,
3. validate app filter policy,
4. store the notification in `mirrored_notifications`,
5. decide whether Parent is active or inactive,
6. emit or expose the row through Realtime for active Parents,
7. send FCM push for inactive Parents,
8. apply batching logic when bursts occur.[cite:75][cite:83][cite:124]

## Mobile application structure

### Main app sections

#### Common onboarding

- Welcome screen
- Role selection: Parent or Child
- Terms/privacy acknowledgement
- Optional sign-in or anonymous mode depending on product decision

#### Child screens

- setup guide for notification access,
- pairing code / QR generation,
- app selection filters,
- service status screen,
- battery optimization guidance,
- sync health and buffered count,
- unpair option.

#### Parent screens

- enter code or scan QR,
- dashboard live feed,
- grouped history list,
- Child status indicator,
- push settings,
- unpair option.

### State management suggestions

Use a lightweight store such as Zustand or similar for:
- auth/session state,
- device role,
- pair info,
- app presence,
- live notification list,
- local unsent buffer count,
- permission status.

## Permissions and Android requirements

### Child-side permissions and access

The Child flow needs notification access through Android notification-listener settings because that is how notification capture works.[cite:35][cite:46] The app must guide the user into the correct settings screen and verify the permission status after returning.[cite:35]

### Parent-side permissions

The Parent side mainly needs push-notification permissions and normal app permissions required for QR scanning if QR is used.[cite:75][cite:82]

### Camera

Camera access is required only if QR scanning is supported in Parent mode.[cite:83]

## Security and privacy model

### Pairing token security

Pairing tokens must be short-lived, single-use, and unguessable. The numeric code may be human-friendly, but the QR should embed a secure backend-issued token rather than a permanent room identifier.[cite:83]

### Data access controls

RLS or backend authorization must ensure that only the paired Parent device can access the Child’s mirrored notification stream and history.[cite:83][cite:138]

### Data minimization

Only necessary notification fields should be persisted. If possible, do not over-store raw metadata that is not used by the product. This reduces privacy and compliance risk.

### User-visible safety controls

The app should include:
- unpair device,
- revoke access,
- clear history if required by product policy,
- visible indication that notification mirroring is active on the Child device.

## Recommended implementation order

### Phase 1: foundation

1. Create Supabase project.
2. Create Firebase project for FCM.
3. Build database schema.
4. Build Edge Functions.
5. Set up Expo native Android build workflow.
6. Integrate `react-native-android-notification-listener`.[cite:46][cite:83][cite:94]

### Phase 2: pairing and permissions

1. Implement role selection.
2. Implement Child notification-access permission flow.
3. Implement pairing token generation.
4. Implement Parent code entry / QR scan claim flow.
5. Persist pair state locally and in backend.[cite:35][cite:83]

### Phase 3: mirroring pipeline

1. Capture notifications on Child.
2. Apply child app filters.
3. Send to backend ingestion function.
4. Persist in database.
5. Realtime subscription on Parent.
6. Parent feed rendering.[cite:46][cite:67][cite:83]

### Phase 4: offline and push

1. Add MMKV local buffering on Child.
2. Add reconnect flush logic.
3. Add FCM Parent push flow.
4. Add presence-based delivery rules.
5. Add push batching/grouping logic.[cite:46][cite:75][cite:95]

### Phase 5: hardening

1. Add battery optimization guidance.
2. Add Child recovery push path.
3. Add delivery logs and failure status.
4. Add analytics and monitoring.
5. Add unpair and safety controls.[cite:31][cite:40][cite:121]

## Final architectural rules for the AI coding agent

The following rules should be treated as implementation constraints:

1. Build **one Android app** with **Parent** and **Child** roles.
2. Do **not** build iOS notification interception.
3. Use **Supabase** as the main backend platform.
4. Use **FCM** for Android push delivery and optional Child wake/recovery.
5. Use **react-native-android-notification-listener** for Child notification capture.[cite:46]
6. Use **MMKV** to buffer unsent Child notifications locally.
7. Use **database persistence for every mirrored notification**; the database is the source of truth.[cite:83]
8. Use **Supabase Realtime** for Parent live feed when Parent app is active.[cite:138]
9. Use **push notifications when Parent app is not active**.[cite:75][cite:124]
10. Implement notification batching/grouping for Parent push when Child message volume is high.[cite:105][cite:109]
11. Track device presence with `is_foreground` and `last_seen_at` rather than many complex activity flags.[cite:124][cite:138]
12. Develop with **native Android builds**, not Expo Go.[cite:15][cite:19]

## Concise final blueprint

The final product is a single Expo/React Native Android app with role-based Parent and Child flows. The Child uses Android notification-listener capability to capture selected app notifications, buffers failed sends locally in MMKV, and forwards data to Supabase-backed ingestion logic.[cite:46][cite:83]

Supabase stores all mirrored notifications, manages pairing and presence, and powers the Parent live feed through Realtime subscriptions when the Parent app is foreground active.[cite:83][cite:138] FCM handles Android push delivery when the Parent app is not active and can optionally send recovery signals to the Child app when OEM battery restrictions disrupt syncing.[cite:40][cite:57][cite:94]

This architecture is intended to be simple enough for fast implementation, but robust enough for real Android behavior: offline periods, app backgrounding, screen-off usage, push-heavy Parent behavior, and high-volume Child notification bursts.[cite:95][cite:105][cite:124]
