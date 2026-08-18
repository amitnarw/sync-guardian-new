import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSourceTheme, type SourceAppTheme } from '@/constants/source-app-themes';

const C = {
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  primary: '#44674d',
  primaryContainer: '#c5eccc',
  secondaryContainer: '#ffdad3',
  tertiaryContainer: '#d3fbda',
} as const;

interface NotificationSourceCardProps {
  notification: {
    source_package: string | null;
    source_app_name: string | null;
    app_icon_base64: string | null;
    notification_title: string | null;
    notification_body: string | null;
    notification_posted_at?: string;
  };
}

export const NotificationSourceCard = React.memo(function NotificationSourceCard({
  notification,
}: NotificationSourceCardProps) {
  const theme = getSourceTheme(notification.source_package);
  const title = notification.notification_title || '(no title)';
  const body = notification.notification_body || '';
  const timeStr = notification.notification_posted_at
    ? new Date(notification.notification_posted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (theme.isChat) {
    return <ChatCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }

  return <MediaCard title={title} body={body} theme={theme} timeStr={timeStr} />;
});

/* ───────────────────────────────────────────────────────────────
   Chat-style card — WhatsApp, Telegram, Messages, Discord, etc.
   ─────────────────────────────────────────────────────────────── */
function ChatCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const isRight = theme.bubbleAlign === 'right';
  return (
    <View style={[chatStyles.card, { borderLeftColor: theme.accent }]}>
      {/* Header: app badge + time */}
      <View style={chatStyles.header}>
        <View style={[chatStyles.appBadge, { backgroundColor: theme.accent }]}>
          <Ionicons name="chatbubble" size={10} color={theme.bubbleText} />
        </View>
        <Text style={[chatStyles.appName, { color: theme.accent }]} numberOfLines={1}>
          {theme.label}
        </Text>
        {timeStr && <Text style={chatStyles.time}>{timeStr}</Text>}
      </View>

      {/* Sender name as title */}
      <Text style={chatStyles.senderName} numberOfLines={1}>{title}</Text>

      {/* Message bubble */}
      {body ? (
        <View
          style={[
            chatStyles.bubble,
            {
              backgroundColor: theme.accent,
              borderTopLeftRadius: isRight ? 16 : 4,
              borderTopRightRadius: isRight ? 4 : 16,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              alignSelf: isRight ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          <Text
            style={[chatStyles.bubbleText, { color: theme.bubbleText }]}
            numberOfLines={5}
          >
            {body}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   Media / social card — Instagram, X, YouTube, Facebook, etc.
   ─────────────────────────────────────────────────────────────── */
function MediaCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  return (
    <View style={[mediaStyles.card, { borderTopColor: theme.accent }]}>
      {/* Brand accent strip */}
      <View style={[mediaStyles.accentStrip, { backgroundColor: theme.accent }]} />

      <View style={mediaStyles.inner}>
        {/* Header */}
        <View style={mediaStyles.header}>
          <View style={[mediaStyles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="logo-apple" size={14} color={theme.accent} />
          </View>
          <View style={mediaStyles.headerText}>
            <Text style={[mediaStyles.appName, { color: theme.accent }]} numberOfLines={1}>
              {theme.label}
            </Text>
            {timeStr && <Text style={mediaStyles.time}>{timeStr}</Text>}
          </View>
        </View>

        {/* Title */}
        <Text style={mediaStyles.title} numberOfLines={2}>{title}</Text>

        {/* Body */}
        {body ? (
          <Text style={mediaStyles.body} numberOfLines={4}>{body}</Text>
        ) : null}
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   Styles
   ─────────────────────────────────────────────────────────────── */
const chatStyles = StyleSheet.create({
  card: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: C.surfaceContainerLowest,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 18,
    borderLeftWidth: 3,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  appBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: C.outline,
    marginLeft: 'auto',
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.onSurface,
    marginBottom: 8,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '92%',
  },
  bubbleText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});

const mediaStyles = StyleSheet.create({
  card: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: C.surfaceContainerLowest,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: 3,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  accentStrip: {
    height: 3,
    width: '100%',
  },
  inner: {
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  appName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: C.outline,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onSurface,
    marginBottom: 6,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
  },
});
