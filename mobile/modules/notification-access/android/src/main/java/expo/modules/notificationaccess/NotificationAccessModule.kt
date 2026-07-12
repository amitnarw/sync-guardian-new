package expo.modules.notificationaccess

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
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
  private var receiverRegistered = false

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val json = intent.getStringExtra("notification_json") ?: return
      sendEvent("onNotificationReceived", mapOf("notification" to json))
    }
  }

  private fun ctx(): Context = requireNotNull(appContext.reactContext)
  private fun pkg(): String = ctx().packageName
  private fun notifListenerComponent(): String = "${pkg()}/expo.modules.notificationaccess.NotificationListenerService"

  private fun ensureReceiver() {
    if (receiverRegistered) return
    val context = ctx()
    val filter = IntentFilter(ACTION_NOTIFICATION_POSTED)
    context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    receiverRegistered = true
  }

  override fun definition() = ModuleDefinition {
    Name("NotificationAccess")
    Events("onNotificationReceived")

    OnCreate {
      ensureReceiver()
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

    Function("isFcmPermissionGranted") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(ctx(), Manifest.permission.POST_NOTIFICATIONS) ==
          android.content.pm.PackageManager.PERMISSION_GRANTED
      } else {
        true
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

    Function("openBatteryOptimizationSettings") {
      val pkgName = pkg()

      try {
        ctx().startActivity(
          Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        )
      } catch (_: Exception) {
        try {
          ctx().startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
              data = android.net.Uri.parse("package:$pkgName")
              addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
          )
        } catch (_: Exception) {}
      }
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

  companion object {
    // User-facing apps that should always be available for the parent to choose,
    // even if they share a package prefix with system components.
    private val SYSTEM_APP_ALLOWLIST = setOf(
      // Google
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
      // Meta
      "com.whatsapp",
      "com.whatsapp.w4b",
      "com.facebook.orca",
      "com.facebook.katana",
      "com.instagram.android",
      "com.oculus.appmanager",
      // Samsung (launcher apps, not framework)
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
      // Xiaomi
      "com.mi.globalbrowser",
      "com.miui.miime",
      // OnePlus
      "com.oneplus.mms",
      "com.oneplus.calculator",
      // Oppo/Realme/ColorOS
      "com.coloros.mms",
      "com.oppo.music",
      // Huawei
      "com.huawei.calculator",
      "com.huawei.android.launcher",
    )

    // Only pure framework / background system components should be hidden.
    // We block by explicit package names and narrow prefixes rather than whole
    // OEM namespaces, so real user apps are never dropped.
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
}
