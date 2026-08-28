export interface SourceAppTheme {
  accent: string;
  accentSoft: string;
  isChat: boolean;
  bubbleAlign?: 'left' | 'right';
  bubbleText: string;
  label: string;
  variant?: 'telegram';
}

export const SOURCE_APP_THEMES: Record<string, SourceAppTheme> = {
  'com.whatsapp': {
    accent: '#25D366',
    accentSoft: '#d3f5dd',
    isChat: true,
    bubbleAlign: 'left',
    bubbleText: '#0b3d1e',
    label: 'WhatsApp',
  },
  'org.telegram.messenger': {
    accent: '#0088cc',
    accentSoft: '#cce8f7',
    isChat: true,
    bubbleAlign: 'left',
    bubbleText: '#ffffff',
    label: 'Telegram',
    variant: 'telegram',
  },
  'com.facebook.orca': {
    accent: '#0084FF',
    accentSoft: '#cce4ff',
    isChat: true,
    bubbleAlign: 'left',
    bubbleText: '#ffffff',
    label: 'Messenger',
  },
  'com.Slack': {
    accent: '#4A154B',
    accentSoft: '#e2d3e3',
    isChat: true,
    bubbleAlign: 'left',
    bubbleText: '#ffffff',
    label: 'Slack',
  },
  'com.discord': {
    accent: '#5865F2',
    accentSoft: '#dadcf8',
    isChat: true,
    bubbleAlign: 'left',
    bubbleText: '#ffffff',
    label: 'Discord',
  },
  'com.google.android.apps.messaging': {
    accent: '#007AFF',
    accentSoft: '#cce4ff',
    isChat: true,
    bubbleAlign: 'left',
    bubbleText: '#000000',
    label: 'Messages',
  },
  'com.android.mms': {
    accent: '#007AFF',
    accentSoft: '#cce4ff',
    isChat: true,
    bubbleAlign: 'left',
    bubbleText: '#000000',
    label: 'Messages',
  },
  'com.samsung.android.messaging': {
    accent: '#007AFF',
    accentSoft: '#cce4ff',
    isChat: true,
    bubbleAlign: 'left',
    bubbleText: '#000000',
    label: 'Messages',
  },
  'com.facebook.katana': {
    accent: '#1877F2',
    accentSoft: '#d4e3fb',
    isChat: true,
    bubbleText: '#050505',
    label: 'Facebook',
  },
  'com.instagram.android': {
    accent: '#E1306C',
    accentSoft: '#fad9e6',
    isChat: false,
    bubbleText: '#ffffff',
    label: 'Instagram',
  },
  'com.twitter.android': {
    accent: '#1D9BF0',
    accentSoft: '#1a3a52',
    isChat: true,
    bubbleText: '#ffffff',
    label: 'X',
  },
  'com.x.android': {
    accent: '#1D9BF0',
    accentSoft: '#1a3a52',
    isChat: true,
    bubbleText: '#ffffff',
    label: 'X',
  },
  'com.snapchat.android': {
    accent: '#FFFC00',
    accentSoft: '#fffac2',
    isChat: false,
    bubbleText: '#1a1a1a',
    label: 'Snapchat',
  },
  'com.google.android.youtube': {
    accent: '#FF0000',
    accentSoft: '#ffd1d1',
    isChat: false,
    bubbleText: '#ffffff',
    label: 'YouTube',
  },
  'com.linkedin.android': {
    accent: '#0A66C2',
    accentSoft: '#cee0f3',
    isChat: true,
    bubbleText: '#ffffff',
    label: 'LinkedIn',
  },
  'com.reddit.frontpage': {
    accent: '#FF4500',
    accentSoft: '#3a1a0f',
    isChat: true,
    bubbleText: '#ffffff',
    label: 'Reddit',
  },
  'com.microsoft.teams': {
    accent: '#6264A7',
    accentSoft: '#dadce6',
    isChat: true,
    bubbleAlign: 'left',
    bubbleText: '#ffffff',
    label: 'Teams',
  },
  'com.google.android.gm': {
    accent: '#EA4335',
    accentSoft: '#fad9d6',
    isChat: false,
    bubbleText: '#ffffff',
    label: 'Gmail',
  },
};

export const FALLBACK_THEME: SourceAppTheme = {
  accent: '#44674d',
  accentSoft: '#c5eccc',
  isChat: false,
  bubbleText: '#ffffff',
  label: 'Notification',
};

export function getSourceTheme(packageName: string | null): SourceAppTheme {
  if (!packageName) return FALLBACK_THEME;
  return SOURCE_APP_THEMES[packageName] ?? FALLBACK_THEME;
}
