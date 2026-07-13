package expo.modules.notificationaccess

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Base64
import com.facebook.react.HeadlessJsTaskService
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

const val ACTION_NOTIFICATION_POSTED = "expo.modules.notificationaccess.NOTIFICATION_POSTED"

class NotificationListenerService : NotificationListenerService() {

  private fun resolveAppInfo(pm: android.content.pm.PackageManager, pkg: String): Pair<String, String?> {
    return try {
      val info = pm.getApplicationInfo(pkg, 0)
      val label = pm.getApplicationLabel(info)?.toString() ?: pkg
      val icon = extractAndDownscaleIcon(pm.getApplicationIcon(info))
      Pair(label, icon)
    } catch (_: Exception) {
      Pair(pkg, null)
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val extras = sbn.notification.extras
    val title = extras.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = extras.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString() ?: ""
    val app = sbn.packageName

    val pm = packageManager
    val appInfo = resolveAppInfo(pm, app)
    val appLabel = appInfo.first
    val appIconBase64 = appInfo.second

    val textLines = extras.getCharSequenceArray(android.app.Notification.EXTRA_TEXT_LINES)
    val bigText = extras.getCharSequence(android.app.Notification.EXTRA_BIG_TEXT)?.toString()
    val isGroupSummary = extras.getBoolean("android.isGroupSummary", false)
    val group = sbn.notification.group

    val notificationJson = JSONObject().apply {
      put("app", app)
      put("app_label", appLabel)
      appIconBase64?.let { put("app_icon_base64", it) }
      put("title", title)
      put("text", text)
      put("time", sbn.postTime.toString())
      put("notification_key", sbn.key)
      bigText?.let { put("big_text", it) }
      put("is_group_summary", isGroupSummary)
      group?.let { put("group", it) }
      textLines?.let {
        val arr = JSONArray()
        for (line in it) {
          arr.put(line.toString())
        }
        put("text_lines", arr)
      }
    }.toString()

    if (isAppInForeground()) {
      val broadcast = Intent(ACTION_NOTIFICATION_POSTED).apply {
        putExtra("notification_json", notificationJson)
      }
      sendBroadcast(broadcast)
    } else {
      val intent = Intent(this, NotificationHeadlessTaskService::class.java).apply {
        putExtra("notification", Bundle().apply {
          putString("notification_json", notificationJson)
        })
      }
      startService(intent)
      HeadlessJsTaskService.acquireWakeLockNow(this)
    }
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification?) {}

  private fun extractAndDownscaleIcon(drawable: Drawable): String? {
    return try {
      val w = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 64
      val h = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 64
      val bitmap = (drawable as? BitmapDrawable)?.bitmap
        ?: run {
          val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
          val canvas = Canvas(bmp)
          drawable.setBounds(0, 0, w, h)
          drawable.draw(canvas)
          bmp
        }
      val targetSize = 64
      val scaled = if (bitmap.width > targetSize || bitmap.height > targetSize) {
        val scale = targetSize.toFloat() / maxOf(bitmap.width, bitmap.height)
        Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
      } else {
        bitmap
      }
      val stream = ByteArrayOutputStream()
      scaled.compress(Bitmap.CompressFormat.PNG, 80, stream)
      val bytes = stream.toByteArray()
      "data:image/png;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
    } catch (_: Exception) {
      null
    }
  }

  private fun isAppInForeground(): Boolean {
    val am = getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return false
    val processes = am.runningAppProcesses ?: return false
    return processes.any { process ->
      process.processName == packageName &&
        process.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }
  }
}
