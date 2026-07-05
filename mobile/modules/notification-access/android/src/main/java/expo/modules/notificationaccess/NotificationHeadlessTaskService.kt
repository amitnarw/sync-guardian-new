package expo.modules.notificationaccess

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class NotificationHeadlessTaskService : HeadlessJsTaskService() {

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val notificationJson = intent?.getBundleExtra("notification")
      ?.getString("notification_json") ?: return null

    val params = Arguments.createMap().apply {
      putString("notification", notificationJson)
    }

    return HeadlessJsTaskConfig(
      "RNAndroidNotificationListenerHeadlessJs",
      params,
      30000L,
      false
    )
  }
}
