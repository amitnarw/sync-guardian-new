package expo.modules.notificationaccess

import android.content.Context
import android.content.Intent
import android.Manifest
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.provider.Settings
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

class NotificationAccessModule : Module() {

  private val SG_REQUEST_POST_NOTIFICATIONS = 0x5A47

  companion object {
    private var eventCallback: ((String) -> Unit)? = null

    @JvmStatic
    fun setEventCallback(callback: (String) -> Unit) {
      eventCallback = callback
    }

    @JvmStatic
    fun dispatchNotification(json: String) {
      Log.d("SG:NotificationAccess", "dispatchNotification: json=${json.take(100)}")
      eventCallback?.invoke(json)
    }

    // User-facing apps that should always be available for the parent to choose,
    // even if they share a package prefix with system components.
    private val SYSTEM_APP_ALLOWLIST = setOf(
      "com.android.chrome",
      "com.google.android.gm",
      "com.google.android.apps.messaging",
      "com.google.android.dialer",
      "com.google.android.calculator",
      "com.google.android.deskclock",
      "com.google.android.apps.photos",
      "com.google.android.apps.docs",
      "com.google.android.youtube",
      "com.google.android.play.games",
      "com.google.android.apps.maps",
      "com.whatsapp",
      "com.whatsapp.w4b",
      "com.facebook.orca",
      "com.facebook.katana",
      "com.instagram.android",
      "com.oculus.appmanager",
      "com.samsung.android.messaging",
      "com.samsung.android.dialer",
      "com.samsung.android.app.contacts",
      "com.sec.android.app.sbrowser",
      "com.samsung.android.email.provider",
      "com.samsung.android.calendar",
      "com.samsung.android.gallery3d",
      "com.samsung.android.notes",
      "com.samsung.android.messaging",
      "com.samsung.android.oneconnect",
      "com.mi.globalbrowser",
      "com.miui.miime",
      "com.oneplus.mms",
      "com.oneplus.calculator",
      "com.coloros.mms",
      "com.oppo.music",
      "com.huawei.calculator",
      "com.huawei.android.launcher",
    )

    private val SYSTEM_APP_BLOCKED_PREFIXES = listOf(
      "android",
      "com.android.systemui",
      "com.android.packageinstaller",
      "com.android.providers",
      "com.android.settings",
      "com.android.settings.intelligence",
      "com.android.vending",
      "com.android.defcontainer",
      "com.android.externalstorage",
      "com.android.htmlviewer",
      "com.android.inputmethod",
      "com.android.keychain",
      "com.android.localtransport",
      "com.android.location.fused",
      "com.android.managedprovisioning",
      "com.android.permissioncontroller",
      "com.android.printspooler",
      "com.android.providers",
      "com.android.shell",
      "com.android.statementservice",
      "com.android.traceur",
      "com.android.wallpaperbackup",
      "com.android.wallpapercropper",
      "com.android.webview",
      "com.google.android.gms",
      "com.google.android.gsf",
      "com.google.android.googlequicksearchbox",
      "com.google.android.packageinstaller",
      "com.google.android.providers",
      "com.google.android.backup",
      "com.google.android.feedback",
      "com.google.android.syncadapters",
      "com.google.android.partnersetup",
      "com.google.android.configupdater",
      "com.google.android.ims",
      "com.google.android.tts",
      "com.google.android.module.metadata",
      "com.samsung.android.bixby",
      "com.samsung.android.accessibility",
      "com.samsung.android.app.routines",
      "com.samsung.android.app.spage",
      "com.samsung.android.app.cocktailbarservice",
      "com.samsung.android.app.ledcover",
      "com.samsung.android.app.telephonyui",
      "com.samsung.android.MtpApplication",
      "com.samsung.android.dqagent",
      "com.samsung.android.game.gamehome",
      "com.samsung.android.honeyboard",
      "com.samsung.android.knox",
      "com.samsung.android.coreapps",
      "com.samsung.android.app.smartcapture",
      "com.samsung.android.themecenter",
      "com.samsung.android.app.dressroom",
      "com.samsung.android.smarthome",
      "com.samsung.android.lool",
      "com.samsung.android.ldm",
      "com.samsung.android.app.watchmanager",
      "com.miui.securitycenter",
      "com.miui.cloudservice",
      "com.miui.system",
      "com.xiaomi.misettings",
      "com.xiaomi.micloudsync",
      "com.coloros.phonemanager",
      "com.coloros.oppoguardelf",
      "com.coloros.safecenter",
      "com.huawei.systemmanager",
      "com.huawei.hwid",
      "com.huawei.android.hwouc",
      "com.huawei.android.internal.app",
    )
  }

  private fun ctx(): Context = requireNotNull(appContext.reactContext)
  private fun pkg(): String = ctx().packageName
  private fun notifListenerComponent(): String = "${pkg()}/expo.modules.notificationaccess.NotificationListenerService"

  override fun definition() = ModuleDefinition {
    Name("NotificationAccess")
    Events("onNotificationReceived")

    OnCreate {
      Log.d("SG:NotificationAccess", "OnCreate called, setting event callback")
      NotificationAccessModule.setEventCallback { json ->
        sendEvent("onNotificationReceived", mapOf("notification" to json))
        Log.d("SG:NotificationAccess", "Event sent to JS via callback")
      }
      Log.d("SG:NotificationAccess", "OnCreate done, callback set")
    }

    Function("isNotificationListenerEnabled") {
      val raw = try {
        Settings.Secure.getString(
          ctx().contentResolver,
          "enabled_notification_listeners"
        ) ?: ""
      } catch (_: Exception) {
        ""
      }
      raw.split(":").any { it.equals(notifListenerComponent(), ignoreCase = true) }
    }

    Function("openNotificationListenerSettings") {
      ctx().startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      )
    }

    // Opens the Notification Access settings screen, deep-linking to Sync
    // Guardian's own row. Two-tier fallback chain:
    // 1. ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS (API 30+, public API)
    //    Opens a single-screen view for just Sync Guardian's notification listener.
    // 2. ACTION_NOTIFICATION_LISTENER_SETTINGS + EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME
    //    Falls back to the full list but tries to deep-link to our row (AOSP behavior).
    Function("openNotificationListenerSettingsForApp") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val detail = Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).apply {
          putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, notifListenerComponent())
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (detail.resolveActivity(ctx().packageManager) != null) {
          try {
            ctx().startActivity(detail)
            return@Function true
          } catch (_: Exception) {}
        }
      }
      val fallback = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, notifListenerComponent())
        }
      }
      if (fallback.resolveActivity(ctx().packageManager) == null) return@Function false
      try {
        ctx().startActivity(fallback)
        true
      } catch (e: Exception) {
        android.util.Log.w("SG:NotificationAccess", "Failed to open notification listener settings for app", e)
        false
      }
    }

    Function("isFcmPermissionGranted") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(ctx(), Manifest.permission.POST_NOTIFICATIONS) ==
          android.content.pm.PackageManager.PERMISSION_GRANTED
      } else {
        true
      }
    }

    // AOSP ground-truth for "the POST_NOTIFICATIONS runtime dialog will no longer
    // be shown": permission not granted AND shouldShowRequestPermissionRationale
    // returns false (never-ask-again chosen, dialog auto-suppressed after
    // repeated denials, or notifications turned off in App Info). Only meaningful
    // on Android 13+ where the runtime permission exists.
    Function("wasFcmPermissionPermanentlyDenied") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return@Function false
      if (ContextCompat.checkSelfPermission(ctx(), Manifest.permission.POST_NOTIFICATIONS) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
      ) return@Function false
      val activity = appContext.currentActivity ?: return@Function false
      !activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)
    }

    // Direct ActivityCompat.requestPermissions bypass for the POST_NOTIFICATIONS
    // dialog. Bypasses expo-notifications' permissionService chain entirely
    // (which can silently return DENIED if currentActivity is null during a
    // modal-unmount frame). Polls the permission state on the main looper and
    // resolves the promise once the user decides Allow/Deny, or after a 60s
    // safety timeout. Only meaningful on Android 13+ (TIRAMISU).
    AsyncFunction("requestPostNotificationsPermission") { promise: expo.modules.kotlin.Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(true)
        return@AsyncFunction
      }
      if (ContextCompat.checkSelfPermission(ctx(), Manifest.permission.POST_NOTIFICATIONS) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
      ) {
        promise.resolve(true)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      androidx.core.app.ActivityCompat.requestPermissions(
        activity,
        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
        SG_REQUEST_POST_NOTIFICATIONS
      )
      val handler = android.os.Handler(android.os.Looper.getMainLooper())
      val startTime = android.os.SystemClock.uptimeMillis()
      val timeoutMs = 60000L
      val pollInterval = 200L
      val pollRunnable = object : Runnable {
        override fun run() {
          val granted = ContextCompat.checkSelfPermission(
            ctx(), Manifest.permission.POST_NOTIFICATIONS
          ) == android.content.pm.PackageManager.PERMISSION_GRANTED
          val elapsed = android.os.SystemClock.uptimeMillis() - startTime
          if (granted) {
            promise.resolve(true)
            return
          }
          if (elapsed >= timeoutMs) {
            promise.resolve(false)
            return
          }
          handler.postDelayed(this, pollInterval)
        }
      }
      handler.post(pollRunnable)
    }

    // Whether the POST_NOTIFICATION AppOps is not allowed. This is the signal
    // that notifications are functionally off (dialog-denied OR toggled off in
    // App Info). On OEMs where shouldShowRequestPermissionRationale lies, the
    // JS layer combines this with a persisted "asked before" flag to detect
    // permanent denial.
    Function("isFcmNotificationsBlocked") {
      try {
        val appOps = ctx().getSystemService(Context.APP_OPS_SERVICE)
          as? android.app.AppOpsManager ?: return@Function false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          appOps.unsafeCheckOpNoThrow(
            "POST_NOTIFICATION",
            android.os.Process.myUid(),
            pkg()
          )
        } else {
          @Suppress("DEPRECATION")
          appOps.checkOpNoThrow(
            "POST_NOTIFICATION",
            android.os.Process.myUid(),
            pkg()
          )
        }
        mode != android.app.AppOpsManager.MODE_ALLOWED
      } catch (_: Exception) {
        false
      }
    }

    Function("openAppNotificationSettings") {
      ctx().startActivity(
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
          putExtra(Settings.EXTRA_APP_PACKAGE, pkg())
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      )
    }

    Function("isBatteryOptimizationDisabled") {
      val pm = ctx().getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
      if (pm == null) return@Function true
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        !pm.isIgnoringBatteryOptimizations(pkg())
      } else {
        true
      }
    }

    // Fires the AOSP ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS dialog, which
    // asks the user "Allow Sync Guardian to ignore battery optimizations?" with
    // Allow/Deny buttons rendered over the app. Some OEMs silently accept this
    // intent without showing a dialog; callers should fall back to the settings
    // chain (openBatteryOptimizationSettings) when this returns false or when
    // the permission status does not change afterwards.
    Function("requestBatteryOptimizationExemption") {
      val pkgName = pkg()
      val pm = ctx().packageManager
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = android.net.Uri.parse("package:$pkgName")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      if (intent.resolveActivity(pm) == null) return@Function false
      try {
        ctx().startActivity(intent)
        true
      } catch (e: Exception) {
        android.util.Log.w("SG:NotificationAccess", "Failed to request battery optimization exemption", e)
        false
      }
    }

    Function("openBatteryOptimizationSettings") {
      val pkgName = pkg()
      val pm = ctx().packageManager

      // Order: App Info first (contains the OEM's per-app battery management
      // toggle on Nothing OS and other OEM ROMs). The AOSP global battery
      // optimization list is a fallback, since it may show the app as
      // "already optimized" while the OEM layer independently restricts it.
      // ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS is excluded because some
      // OEMs silently accept the intent without showing a dialog.
      val intents = listOf(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = android.net.Uri.parse("package:$pkgName")
        },
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
        Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS),
        Intent(Settings.ACTION_SETTINGS),
      )

      val opened = intents.firstNotNullOfOrNull { intent ->
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (intent.resolveActivity(pm) != null) {
          try {
            ctx().startActivity(intent)
            true
          } catch (e: Exception) {
            android.util.Log.w("SG:NotificationAccess", "Failed to start ${intent.action}", e)
            null
          }
        } else {
          android.util.Log.d("SG:NotificationAccess", "No activity for ${intent.action}")
          null
        }
      } ?: false

      opened
    }

    Function("resolveAppLabel") { packageName: String ->
      val pm = ctx().packageManager
      val label = try {
        val info = pm.getApplicationInfo(packageName, 0)
        pm.getApplicationLabel(info)?.toString() ?: packageName
      } catch (_: Exception) {
        packageName
      }
      label
    }

    Function("resolveAppInfo") { packageName: String ->
      val pm = ctx().packageManager
      val info = try {
        pm.getApplicationInfo(packageName, 0)
      } catch (_: Exception) {
        null
      }
      if (info == null) return@Function mapOf("label" to packageName, "icon" to null)

      val label = pm.getApplicationLabel(info)?.toString() ?: packageName

      val iconBase64 = try {
        val drawable: Drawable = pm.getApplicationIcon(info)
        val bitmap = (drawable as? BitmapDrawable)?.bitmap
        if (bitmap != null) {
          val stream = ByteArrayOutputStream()
          bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
          val bytes = stream.toByteArray()
          "data:image/png;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
        } else {
          null
        }
      } catch (_: Exception) {
        null
      }

      mapOf("label" to label, "icon" to iconBase64)
    }

    // Returns the list of launcher apps installed on the device (Android only).
    // System/framework packages are filtered out via a hardcoded blocklist so the
    // parent only sees meaningful, user-facing apps. Apps are disabled by default
    // server-side; the parent opts in to the apps whose notifications they want.
    Function("getInstalledApps") {
      val pm = ctx().packageManager
      val launcherIntent = Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolveInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.queryIntentActivities(launcherIntent, android.content.pm.PackageManager.ResolveInfoFlags.of(0))
      } else {
        pm.queryIntentActivities(launcherIntent, 0)
      }

      val result = mutableListOf<Map<String, String?>>()
      val seen = mutableSetOf<String>()
      var dropped = 0

      for (ri in resolveInfos) {
        val packageName = ri.activityInfo?.packageName ?: continue
        if (seen.contains(packageName)) continue
        if (isSystemBlocked(packageName)) {
          dropped++
          continue
        }
        seen.add(packageName)

        val label = try {
          pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
        } catch (_: Exception) {
          packageName
        }
        val icon = try {
          iconToBase64(pm.getApplicationIcon(packageName))
        } catch (_: Exception) {
          null
        }
        result.add(
          mapOf(
            "packageName" to packageName,
            "appName" to label,
            "appIconBase64" to icon,
          )
        )
      }

      android.util.Log.d("SG:NotificationAccess", "getInstalledApps: found=${resolveInfos.size} kept=${result.size} dropped=$dropped")

      result
    }
  }

  private fun iconToBase64(drawable: Drawable?): String? {
    if (drawable == null) return null
    return try {
      val size = 64
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      canvas.drawColor(Color.TRANSPARENT)
      drawable.setBounds(0, 0, size, size)
      drawable.draw(canvas)
      val stream = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
      bitmap.recycle()
      "data:image/png;base64,${Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)}"
    } catch (_: Exception) {
      null
    }
  }

  private fun isSystemBlocked(packageName: String): Boolean {
    if (SYSTEM_APP_ALLOWLIST.contains(packageName)) return false
    for (prefix in SYSTEM_APP_BLOCKED_PREFIXES) {
      if (packageName.startsWith(prefix)) return true
    }
    return false
  }

}
