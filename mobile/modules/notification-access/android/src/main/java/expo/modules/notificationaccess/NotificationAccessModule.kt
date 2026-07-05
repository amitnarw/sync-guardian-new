package expo.modules.notificationaccess

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.Manifest
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.provider.Settings
import android.util.Base64
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
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = android.net.Uri.parse("package:${pkg()}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        ctx().startActivity(intent)
      } catch (_: Exception) {
        ctx().startActivity(
          Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        )
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
  }
}
