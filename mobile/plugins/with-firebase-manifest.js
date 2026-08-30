const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withFirebaseManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) return modConfig;

    application['meta-data'] = application['meta-data'] || [];

    const metaDataItems = [
      {
        name: 'com.google.firebase.messaging.default_notification_channel_id',
        replace: 'android:value',
      },
      {
        name: 'com.google.firebase.messaging.default_notification_color',
        replace: 'android:resource',
      },
      {
        name: 'com.google.firebase.messaging.default_notification_icon',
        replace: 'android:resource',
      },
    ];

    metaDataItems.forEach(({ name, replace }) => {
      let item = application['meta-data'].find((m) => m.$?.['android:name'] === name);
      if (!item) {
        item = { $: { 'android:name': name } };
        application['meta-data'].push(item);
      }
      item.$['tools:replace'] = replace;
    });

    return modConfig;
  });
};

