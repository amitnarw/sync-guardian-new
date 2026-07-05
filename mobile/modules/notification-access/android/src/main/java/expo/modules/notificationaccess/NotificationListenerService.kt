package expo.modules.notificationaccess

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.facebook.react.HeadlessJsTaskService
import org.json.JSONObject

const val ACTION_NOTIFICATION_POSTED = "expo.modules.notificationaccess.NOTIFICATION_POSTED"

class NotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val extras = sbn.notification.extras
    val title = extras.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = extras.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString() ?: ""
    val app = sbn.packageName

    val notificationJson = JSONObject().apply {
      put("app", app)
      put("title", title)
      put("text", text)
      put("time", sbn.postTime.toString())
      put("key", sbn.key)
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

  private fun isAppInForeground(): Boolean {
    val am = getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return false
    val processes = am.runningAppProcesses ?: return false
    return processes.any { process ->
      process.processName == packageName &&
        process.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }
  }
}
