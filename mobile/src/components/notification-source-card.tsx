import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { getSourceTheme, type SourceAppTheme } from '@/constants/source-app-themes';

const C = {
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  surfaceContainerLowest: '#ffffff',
} as const;

const WHATSAPP_PACKAGES = new Set([
  'com.whatsapp',
  'com.whatsapp.w4b',
]);

const MESSENGER_PACKAGES = new Set([
  'com.facebook.orca',
  'com.facebook.katana',
  'com.facebook.lite',
]);

const DISCORD_PACKAGES = new Set(['com.discord']);

const LINKEDIN_PACKAGES = new Set(['com.linkedin.android']);

const TELEGRAM_PACKAGES = new Set(['org.telegram.messenger', 'org.telegram.plus', 'org.telegram.beta']);

const REDDIT_PACKAGES = new Set(['com.reddit.frontpage']);

const IMESSAGE_PACKAGES = new Set([
  'com.google.android.apps.messaging',
  'com.android.mms',
  'com.samsung.android.messaging',
]);

const X_TWITTER_PACKAGES = new Set([
  'com.twitter.android',
  'com.x.android',
]);

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

// WhatsApp Tail (Standard size)
function BubbleTailWhatsApp({ color = '#D9FDD3' }: { color?: string }) {
  return (
    <View style={tailStyles.tailWhatsApp} pointerEvents="none">
      <Svg width={9} height={13} viewBox="0 0 9 13">
        <Path
          d="M9 0 H0 C3 2, 6 6, 9 13 Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

// Telegram Tail (Smaller size, same shape as WhatsApp)
function BubbleTailTelegram({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={tailStyles.tailTelegram} pointerEvents="none">
      <Svg width={6} height={9} viewBox="0 0 6 9">
        <Path
          d="M6 0 H0 C2 1.5, 4 4.5, 6 9 Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

const tailStyles = StyleSheet.create({
  tailWhatsApp: {
    position: 'absolute',
    top: 0,
    left: -8,
    width: 9,
    height: 13,
    zIndex: 2,
  },
  tailTelegram: {
    position: 'absolute',
    top: 0,
    left: -5.5,
    width: 6,
    height: 9,
    zIndex: 2,
  },
});

export const NotificationSourceCard = React.memo(function NotificationSourceCard({
  notification,
}: NotificationSourceCardProps) {
  const pkg = notification.source_package ?? '';
  const theme = getSourceTheme(notification.source_package);
  const title = notification.notification_title || '(no title)';
  const body = notification.notification_body || '';
  const timeStr = notification.notification_posted_at
    ? new Date(notification.notification_posted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (WHATSAPP_PACKAGES.has(pkg)) {
    return <WhatsAppCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }
  if (MESSENGER_PACKAGES.has(pkg)) {
    return <FacebookMessengerCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }
  if (TELEGRAM_PACKAGES.has(pkg)) {
    return <TelegramCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }
  if (DISCORD_PACKAGES.has(pkg)) {
    return <DiscordCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }
  if (X_TWITTER_PACKAGES.has(pkg)) {
    return <XTwitterCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }
  if (REDDIT_PACKAGES.has(pkg)) {
    return <RedditCard title={title} body={body} theme={theme} timeStr={timeStr} postedAt={notification.notification_posted_at} />;
  }
  if (LINKEDIN_PACKAGES.has(pkg)) {
    return <LinkedInCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }
  if (IMESSAGE_PACKAGES.has(pkg)) {
    return <IMessageCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }
  if (theme.isChat) {
    return <WhatsAppCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }

  return <MediaCard title={title} body={body} theme={theme} timeStr={timeStr} />;
});

// WhatsApp Card - Standard WhatsApp tail on left, pale green bubble, time + blue checks
function WhatsAppCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const displayText = body || title;
  const showSender = body && title && title !== 'WhatsApp' && title !== 'WhatsApp Business';

  return (
    <View style={whatsappStyles.container}>
      <BubbleTailWhatsApp color="#D9FDD3" />
      <View style={whatsappStyles.bubble}>
        {showSender ? (
          <Text style={whatsappStyles.senderName}>{title}</Text>
        ) : null}
        <Text style={whatsappStyles.body} numberOfLines={12}>{displayText}</Text>
        <View style={whatsappStyles.footer}>
          {timeStr && <Text style={whatsappStyles.time}>{timeStr}</Text>}
          <Ionicons name="checkmark-done" size={15} color="#53BDEB" style={whatsappStyles.checkMark} />
        </View>
      </View>
    </View>
  );
}

// Facebook Messenger Card - Image 1 style (Vibrant blue pill bubble with 4px top-left corner, no SVG tail, white text, meta below)
function FacebookMessengerCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const displayText = body || title;
  const showSender = body && title && title !== 'Facebook' && title !== 'Messenger';

  return (
    <View style={fbMessengerStyles.container}>
      <View style={fbMessengerStyles.bubble}>
        {showSender ? (
          <Text style={fbMessengerStyles.senderName}>{title}</Text>
        ) : null}
        <Text style={fbMessengerStyles.body} numberOfLines={12}>{displayText}</Text>
      </View>
      {timeStr ? (
        <Text style={fbMessengerStyles.metaText}>
          {`Message sent ${timeStr}`}
        </Text>
      ) : null}
    </View>
  );
}

// Telegram Card - Smaller WhatsApp-style tail, white bubble, violet sender, cyan mentions
function TelegramCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const renderBody = () => {
    if (!body) return null;
    const parts = body.split(/(@\w+|#\w+|https?:\/\/[^\s]+)/g);
    return (
      <Text style={telegramStyles.body} numberOfLines={12}>
        {parts.map((part, i) =>
          part.startsWith('@') || part.startsWith('#') || part.startsWith('http') ? (
            <Text key={i} style={telegramStyles.mention}>{part}</Text>
          ) : (
            <Text key={i}>{part}</Text>
          ),
        )}
      </Text>
    );
  };
  return (
    <View style={telegramStyles.container}>
      <BubbleTailTelegram color="#FFFFFF" />
      <View style={telegramStyles.bubble}>
        <Text style={telegramStyles.senderName}>{title}</Text>
        {renderBody()}
        {timeStr && (
          <Text style={telegramStyles.time}>{timeStr}</Text>
        )}
      </View>
    </View>
  );
}

// iMessage Card
function IMessageCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  return (
    <View style={imessageStyles.container}>
      <View style={imessageStyles.bubble}>
        <Text style={[imessageStyles.senderName, { color: theme.accent }]}>
          {title}
        </Text>
        {body ? (
          <Text style={imessageStyles.body} numberOfLines={12}>{body}</Text>
        ) : null}
        {timeStr && <Text style={imessageStyles.time}>{timeStr}</Text>}
      </View>
    </View>
  );
}

// Discord Card
function DiscordCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  return (
    <View style={discordStyles.card}>
      <View style={discordStyles.header}>
        <Text style={discordStyles.senderName}>{title}</Text>
        {timeStr && <Text style={discordStyles.time}>{timeStr}</Text>}
      </View>
      {body ? <Text style={discordStyles.body} numberOfLines={12}>{body}</Text> : null}
    </View>
  );
}

// X / Twitter Card - Clean layout without triple-dot icon, multi-line sender wrap
function XTwitterCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  return (
    <View style={xTwitterStyles.card}>
      <View style={xTwitterStyles.header}>
        <View style={xTwitterStyles.headerLeft}>
          <View style={xTwitterStyles.nameRow}>
            <Text style={xTwitterStyles.senderName}>{title}</Text>
            <View style={[xTwitterStyles.verifiedBadge, { backgroundColor: theme.accent }]}>
              <Ionicons name="checkmark" size={9} color="#FFFFFF" />
            </View>
          </View>
        </View>
        {timeStr && <Text style={xTwitterStyles.time}>{timeStr}</Text>}
      </View>

      {body ? <Text style={xTwitterStyles.body} numberOfLines={12}>{body}</Text> : null}

      <View style={xTwitterStyles.actionBar}>
        <View style={xTwitterStyles.actionItem}>
          <Ionicons name="chatbubble-outline" size={14} color="#71767B" />
          <Text style={xTwitterStyles.actionCount}>2</Text>
        </View>
        <View style={xTwitterStyles.actionItem}>
          <Ionicons name="repeat-outline" size={14} color="#71767B" />
          <Text style={xTwitterStyles.actionCount}>1</Text>
        </View>
        <View style={xTwitterStyles.actionItem}>
          <Ionicons name="heart-outline" size={14} color="#71767B" />
          <Text style={xTwitterStyles.actionCount}>224</Text>
        </View>
        <View style={xTwitterStyles.actionItem}>
          <Ionicons name="stats-chart-outline" size={14} color="#71767B" />
          <Text style={xTwitterStyles.actionCount}>20k</Text>
        </View>
      </View>
    </View>
  );
}

function formatRedditTime(postedAt?: string, timeStr?: string | null) {
  if (postedAt) {
    const diffMs = Date.now() - new Date(postedAt).getTime();
    if (!isNaN(diffMs) && diffMs >= 0) {
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'now';
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h`;
      const days = Math.floor(hrs / 24);
      if (days < 30) return `${days}d`;
      const months = Math.floor(days / 30);
      if (months < 12) return `${months}mo`;
      return `${Math.floor(months / 12)}y`;
    }
  }
  return timeStr || '1h';
}

// Reddit Card - Exactly matching Reddit comment UI from screenshot
function RedditCard({
  title,
  body,
  theme,
  timeStr,
  postedAt,
}: {
  title: string;
  body: string;
  theme: SourceAppTheme;
  timeStr: string | null;
  postedAt?: string;
}) {
  const redditTime = formatRedditTime(postedAt, timeStr);
  const displayText = body || title;

  return (
    <View style={redditStyles.card}>
      {/* Top Header: Username + Time */}
      <View style={redditStyles.header}>
        <View style={redditStyles.metaWrap}>
          <Text style={redditStyles.senderName} numberOfLines={1}>
            {title}
          </Text>
          <Text style={redditStyles.timeText}>{redditTime}</Text>
        </View>
      </View>

      {/* Comment Body */}
      {displayText ? (
        <Text style={redditStyles.body} numberOfLines={12}>
          {displayText}
        </Text>
      ) : null}

      {/* Bottom Actions: Upvote / Count / Downvote on the right */}
      <View style={redditStyles.footerRow}>
        <View style={redditStyles.voteGroup}>
          <Pressable style={redditStyles.voteBtn} hitSlop={6} onPress={() => {}}>
            <Ionicons name="arrow-up-outline" size={16} color="#D7DADC" />
          </Pressable>
          <Text style={redditStyles.voteScore}>50</Text>
          <Pressable style={redditStyles.voteBtn} hitSlop={6} onPress={() => {}}>
            <Ionicons name="arrow-down-outline" size={16} color="#D7DADC" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// LinkedIn Card - Clean multi-line header wrap to prevent timestamp overflow
function LinkedInCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  return (
    <View style={linkedInStyles.card}>
      <View style={linkedInStyles.header}>
        <View style={linkedInStyles.headerLeft}>
          <Text style={linkedInStyles.senderName}>{title}</Text>
          <View style={linkedInStyles.verifiedBadge}>
            <Ionicons name="checkmark" size={9} color="#FFFFFF" />
          </View>
        </View>
        {timeStr && <Text style={linkedInStyles.time}>{timeStr}</Text>}
      </View>
      {body ? <Text style={linkedInStyles.body} numberOfLines={12}>{body}</Text> : null}
    </View>
  );
}

// Media / Generic Card
function MediaCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  return (
    <View style={[mediaStyles.card, { borderTopColor: theme.accent }]}>
      <View style={[mediaStyles.accentStrip, { backgroundColor: theme.accent }]} />
      <View style={mediaStyles.inner}>
        <View style={mediaStyles.header}>
          <Text style={[mediaStyles.appName, { color: theme.accent }]} numberOfLines={1}>
            {theme.label}
          </Text>
          {timeStr && <Text style={mediaStyles.time}>{timeStr}</Text>}
        </View>
        <Text style={mediaStyles.title}>{title}</Text>
        {body ? (
          <Text style={mediaStyles.body} numberOfLines={6}>{body}</Text>
        ) : null}
      </View>
    </View>
  );
}

/* Styles */

// WhatsApp Styles
const whatsappStyles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    position: 'relative',
    maxWidth: '94%',
    marginLeft: 6,
  },
  bubble: {
    backgroundColor: '#D9FDD3',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1.5,
    minWidth: 120,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    lineHeight: 17,
    color: '#075E54',
    marginBottom: 2,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14.5,
    lineHeight: 20,
    color: '#111B21',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 3,
    marginTop: 2,
    marginLeft: 12,
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: '#667781',
  },
  checkMark: {
    marginLeft: 1,
  },
});

// Facebook / Messenger Styles - Pill shape with 4px top-left, vibrant blue, white text
const fbMessengerStyles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    maxWidth: '94%',
    marginLeft: 6,
  },
  bubble: {
    backgroundColor: '#0084FF',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 11,
    shadowColor: '#0084FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 100,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: '#E0F2FE',
    marginBottom: 2,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14.5,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  metaText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: '#8A8D91',
    marginTop: 4,
    alignSelf: 'flex-start',
    marginLeft: 2,
  },
});

// Telegram Styles - Smaller tail
const telegramStyles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    position: 'relative',
    maxWidth: '94%',
    marginLeft: 4,
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    minWidth: 120,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13.5,
    lineHeight: 18,
    color: '#7064B8',
    marginBottom: 2,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14.5,
    lineHeight: 20,
    color: '#1E1E1E',
  },
  mention: {
    color: '#2A92D0',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: '#8E8E93',
    alignSelf: 'flex-end',
    marginTop: 2,
    marginLeft: 12,
  },
});

// iMessage Styles
const imessageStyles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    maxWidth: '94%',
    marginLeft: 6,
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    minWidth: 120,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13.5,
    lineHeight: 18,
    marginBottom: 2,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14.5,
    lineHeight: 20,
    color: '#000000',
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: '#8E8E93',
    alignSelf: 'flex-end',
    marginTop: 2,
    marginLeft: 12,
  },
});

// Discord Styles
const discordStyles = StyleSheet.create({
  card: {
    marginLeft: 6,
    backgroundColor: '#2F3136',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '94%',
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  senderName: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: '#72767D',
    flexShrink: 0,
    marginTop: 2,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#DCDDDE',
  },
});

// LinkedIn Styles - With flexWrap and proper header boundaries
const linkedInStyles = StyleSheet.create({
  card: {
    marginLeft: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0DFDC',
    padding: 12,
    maxWidth: '94%',
    alignSelf: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13.5,
    color: '#000000E6',
    lineHeight: 18,
    flexShrink: 1,
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0A66C2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: '#00000099',
    flexShrink: 0,
    marginTop: 2,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#000000E6',
  },
});

// Reddit Styles - Authentic Reddit comment card with cyan Snoo avatar, white text, upvote counter
const redditStyles = StyleSheet.create({
  card: {
    marginLeft: 6,
    backgroundColor: '#0E1113',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    maxWidth: '96%',
    alignSelf: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13.5,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  timeText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: '#818384',
    flexShrink: 0,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14.5,
    lineHeight: 21,
    color: '#D7DADC',
    marginTop: 2,
    marginBottom: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  voteGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteBtn: {
    padding: 3,
    borderRadius: 4,
  },
  voteScore: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12.5,
    color: '#D7DADC',
    marginHorizontal: 3,
  },
});

// X / Twitter Styles - Clean header with flexWrap, no triple-dot icon
const xTwitterStyles = StyleSheet.create({
  card: {
    marginLeft: 6,
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 12,
    maxWidth: '94%',
    alignSelf: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13.5,
    color: '#E7E9EA',
    lineHeight: 18,
    flexShrink: 1,
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: '#71767B',
    flexShrink: 0,
    marginTop: 2,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#E7E9EA',
    marginBottom: 8,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: '#71767B',
  },
});

// Media Card Styles
const mediaStyles = StyleSheet.create({
  card: {
    flex: 1,
    marginLeft: 6,
    backgroundColor: C.surfaceContainerLowest,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    borderTopWidth: 3,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  accentStrip: {
    height: 3,
    width: '100%',
  },
  inner: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
    flexShrink: 0,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    lineHeight: 20,
    color: C.onSurface,
    marginBottom: 4,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
  },
});
