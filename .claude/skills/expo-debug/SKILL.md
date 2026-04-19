---
name: expo-debug
description: Debug Expo and React Native issues. Use when encountering build errors, Metro bundler issues, routing problems, or device-specific bugs in Expo SDK 55 projects.
when_to_use: When user reports "app not loading", "Metro error", "route not found", "expo go not working", "build failed", or any Expo/React Native debugging scenario.
---

# Expo Debug Skill

## Quick Diagnostics

When debugging Expo issues, follow this checklist:

### 1. Clear Cache & Restart
```bash
npx expo start --clear
```
This clears Metro bundler cache and restarts.

### 2. Check Route Configuration
For routing issues with expo-router:
- Verify `appDirectory` is set in `app.json > experiments` (e.g., `"appDirectory": "./src/app"`)
- Ensure route files are in the correct location
- Check that `NativeTabs.Trigger name` matches the route name

### 3. Common Error Solutions

**"Route is extraneous" error:**
- Run `npx expo start --clear`
- Check for duplicate route definitions
- Verify app.json has correct appDirectory

**"Too many screens defined":**
- Usually caused by stale route manifest
- Clear .expo folder or run with --clear

**Native module issues:**
```bash
npx expo install --check
npx expo install --fix
```

### 4. Device Testing (Expo Go)

For Android:
- Shake device or press `m` in terminal to open dev menu
- Enable "Debug JS Remotely" for network inspection

For iOS:
- Shake device to open dev menu
- Use Safari Web Inspector for JS debugging

## Project-Specific Info

- Routes are in `src/app/` (not default `app/`)
- App directory: `./src/app` in app.json
- Uses NativeTabs from `expo-router/unstable-native-tabs`
- Entry: `expo-router/entry` in package.json
