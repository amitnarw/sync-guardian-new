const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidNotificationListener(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // 1. Add tools namespace if it doesn't exist
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // 2. Add tools:replace="android:allowBackup" to <application> to fix merger issues
    const application = androidManifest.manifest.application[0];
    if (application.$['tools:replace']) {
      if (!application.$['tools:replace'].includes('android:allowBackup')) {
        application.$['tools:replace'] += ',android:allowBackup';
      }
    } else {
      application.$['tools:replace'] = 'android:allowBackup';
    }

    // 3. Add the RNAndroidNotificationListener service
    if (!application.service) {
      application.service = [];
    }

    const hasService = application.service.some(
      (s) => s.$['android:name'] === 'com.jhagoba.nl.RNAndroidNotificationListener'
    );

    if (!hasService) {
      application.service.push({
        $: {
          'android:name': 'com.jhagoba.nl.RNAndroidNotificationListener',
          'android:label': '@string/app_name',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};
