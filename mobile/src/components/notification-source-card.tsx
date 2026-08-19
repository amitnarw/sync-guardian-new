import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSourceTheme, type SourceAppTheme } from '@/constants/source-app-themes';

const C = {
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  surfaceContainerLowest: '#ffffff',
} as const;

const CHAT = {
  bubbleBg: '#D9FDD3',
  textTitle: '#111B21',
  textBody: '#303030',
  textMeta: '#667781',
  checkMark: '#53BDEB',
} as const;

const MESSENGER = {
  bubbleBg: '#FFFFFF',
  textTitle: '#000000',
  textBody: '#000000',
  textMeta: '#65676B',
  shadow: '#000000',
} as const;

const DISCORD = {
  bg: '#2F3136',
  textUsername: '#FFFFFF',
  textBody: '#DCDDDE',
  textMeta: '#72767D',
} as const;

const LINKEDIN = {
  bg: '#FFFFFF',
  textName: '#000000E6',
  textBody: '#000000E6',
  textMeta: '#00000099',
  verifiedBg: '#0A66C2',
  border: '#E0DFDC',
} as const;

const MESSENGER_PACKAGES = new Set([
  'com.facebook.orca',
  'com.facebook.katana',
]);

const DISCORD_PACKAGES = new Set(['com.discord']);

const LINKEDIN_PACKAGES = new Set(['com.linkedin.android']);

const TELEGRAM = {
  bg: '#FFFFFF',
  senderName: '#A394E0',
  textBody: '#000000',
  textMeta: '#999999',
  mentionColor: '#1A73E8',
  shadow: '#000000',
} as const;

const TELEGRAM_PACKAGES = new Set(['org.telegram.messenger', 'org.telegram.plus', 'org.telegram.beta']);

const REDDIT = {
  bg: '#1A1A1B',
  textUsername: '#D7DADC',
  textBody: '#D7DADC',
  textMeta: '#818384',
  actionIcon: '#D7DADC',
  border: '#343536',
} as const;

const REDDIT_PACKAGES = new Set(['com.reddit.frontpage']);

const IMESSAGE = {
  bubbleBg: '#FFFFFF',
  textName: '#007AFF',
  textBody: '#000000',
  textMeta: '#8E8E93',
  shadow: '#000000',
} as const;

const IMESSAGE_PACKAGES = new Set([
  'com.google.android.apps.messaging',
  'com.android.mms',
  'com.samsung.android.messaging',
]);

const X_TWITTER = {
  bg: '#000000',
  textName: '#E7E9EA',
  textMeta: '#71767B',
  textBody: '#E7E9EA',
  verifiedBg: '#1D9BF0',
  actionIcon: '#71767B',
  border: '#2F3336',
} as const;

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
    if (DISCORD_PACKAGES.has(notification.source_package ?? '')) {
      return <DiscordCard title={title} body={body} theme={theme} timeStr={timeStr} />;
    }
    if (TELEGRAM_PACKAGES.has(notification.source_package ?? '')) {
      return <TelegramCard title={title} body={body} theme={theme} timeStr={timeStr} />;
    }
    if (X_TWITTER_PACKAGES.has(notification.source_package ?? '')) {
      return <XTwitterCard title={title} body={body} theme={theme} timeStr={timeStr} />;
    }
    if (REDDIT_PACKAGES.has(notification.source_package ?? '')) {
      return <RedditCard title={title} body={body} theme={theme} timeStr={timeStr} />;
    }
    if (LINKEDIN_PACKAGES.has(notification.source_package ?? '')) {
      return <LinkedInCard title={title} body={body} theme={theme} timeStr={timeStr} />;
    }
    if (MESSENGER_PACKAGES.has(notification.source_package ?? '')) {
      return <MessengerCard title={title} body={body} theme={theme} timeStr={timeStr} />;
    }
    if (IMESSAGE_PACKAGES.has(notification.source_package ?? '')) {
      return <IMessageCard title={title} body={body} theme={theme} timeStr={timeStr} />;
    }
    return <ChatCard title={title} body={body} theme={theme} timeStr={timeStr} />;
  }

  return <MediaCard title={title} body={body} theme={theme} timeStr={timeStr} />;
});

/* ───────────────────────────────────────────────────────────────
   Chat card — WhatsApp / iMessage / Telegram style
   Bubble IS the card. Pale green background. No wrapper.
   ─────────────────────────────────────────────────────────────── */
function ChatCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  return (
    <View style={chatStyles.bubble}>
      <View style={chatStyles.header}>
        <View style={[chatStyles.appDot, { backgroundColor: theme.accent }]} />
        <Text style={chatStyles.senderName} numberOfLines={1}>{title}</Text>
      </View>
      {body ? (
        <Text style={chatStyles.body} numberOfLines={6}>{body}</Text>
      ) : null}
      <View style={chatStyles.footer}>
        {timeStr && <Text style={chatStyles.time}>{timeStr}</Text>}
        <Ionicons name="checkmark-done" size={14} color={CHAT.checkMark} />
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   Messenger card — Facebook Messenger style
   White bubble, rounded corners, subtle shadow, sender name above.
   ─────────────────────────────────────────────────────────────── */
function MessengerCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  return (
    <View style={messengerStyles.container}>
      {/* Sender name above bubble */}
      <View style={messengerStyles.senderRow}>
        <View style={[messengerStyles.appDot, { backgroundColor: theme.accent }]} />
        <Text style={messengerStyles.senderName} numberOfLines={1}>{title}</Text>
      </View>

      {/* White bubble with message */}
      <View style={messengerStyles.bubble}>
        <Text style={messengerStyles.body} numberOfLines={6}>{body}</Text>
      </View>

      {/* Footer: time + delivery status */}
      <View style={messengerStyles.footer}>
        {timeStr && <Text style={messengerStyles.time}>{timeStr}</Text>}
        <Ionicons name="checkmark-done" size={13} color={theme.accent} />
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   iMessage card — white bubble, avatar, cyan sender name inside
   ─────────────────────────────────────────────────────────────── */
function IMessageCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const initial = (title?.[0] ?? '?').toUpperCase();
  return (
    <View style={imessageStyles.container}>
      <View style={[imessageStyles.avatar, { backgroundColor: theme.accent }]}>
        <Text style={imessageStyles.avatarText}>{initial}</Text>
      </View>

      <View style={imessageStyles.bubble}>
        <Text style={[imessageStyles.senderName, { color: theme.accent }]} numberOfLines={1}>
          {title}
        </Text>
        {body ? (
          <View style={imessageStyles.bodyRow}>
            <Text style={imessageStyles.body} numberOfLines={6}>{body}</Text>
            {timeStr && <Text style={imessageStyles.time}>{timeStr}</Text>}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   Discord card — dark background, circular avatar with initial
   ─────────────────────────────────────────────────────────────── */
function DiscordCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const initial = (title?.[0] ?? '?').toUpperCase();
  return (
    <View style={discordStyles.card}>
      <View style={discordStyles.row}>
        <View style={[discordStyles.avatar, { backgroundColor: theme.accent }]}>
          <Text style={discordStyles.avatarText}>{initial}</Text>
        </View>
        <View style={discordStyles.content}>
          <View style={discordStyles.header}>
            <Text style={discordStyles.senderName} numberOfLines={1}>{title}</Text>
            {timeStr && <Text style={discordStyles.time}>{timeStr}</Text>}
          </View>
          {body ? <Text style={discordStyles.body} numberOfLines={6}>{body}</Text> : null}
        </View>
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   Telegram card — white bubble, avatar, light purple sender name, @mentions in blue
   ─────────────────────────────────────────────────────────────── */
function TelegramCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const initial = (title?.[0] ?? '?').toUpperCase();
  const renderBody = () => {
    if (!body) return null;
    const parts = body.split(/(@\w+)/g);
    return (
      <Text style={telegramStyles.body} numberOfLines={6}>
        {parts.map((part, i) =>
          part.startsWith('@') ? (
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
      <View style={[telegramStyles.avatar, { backgroundColor: theme.accentSoft }]}>
        <Text style={[telegramStyles.avatarText, { color: theme.accent }]}>{initial}</Text>
      </View>

      <View style={telegramStyles.bubble}>
        <Text style={telegramStyles.senderName} numberOfLines={1}>{title}</Text>
        {renderBody()}
        {timeStr && (
          <Text style={telegramStyles.time}>{timeStr}</Text>
        )}
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   X / Twitter card — black bg, avatar, verified badge, action bar
   ─────────────────────────────────────────────────────────────── */
function XTwitterCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const initial = (title?.[0] ?? '?').toUpperCase();
  return (
    <View style={xTwitterStyles.card}>
      <View style={xTwitterStyles.header}>
        <View style={xTwitterStyles.headerLeft}>
          <View style={[xTwitterStyles.avatar, { backgroundColor: theme.accent }]}>
            <Text style={xTwitterStyles.avatarText}>{initial}</Text>
          </View>
          <View style={xTwitterStyles.headerText}>
            <View style={xTwitterStyles.nameRow}>
              <Text style={xTwitterStyles.senderName} numberOfLines={1}>{title}</Text>
              <View style={[xTwitterStyles.verifiedBadge, { backgroundColor: theme.accent }]}>
                <Ionicons name="checkmark" size={9} color="#FFFFFF" />
              </View>
            </View>
            {timeStr && <Text style={xTwitterStyles.time}>{timeStr}</Text>}
          </View>
        </View>
        <Pressable hitSlop={8} onPress={() => {}}>
          <Ionicons name="ellipsis-horizontal" size={16} color={X_TWITTER.actionIcon} />
        </Pressable>
      </View>

      {body ? <Text style={xTwitterStyles.body} numberOfLines={6}>{body}</Text> : null}

      <View style={xTwitterStyles.actionBar}>
        <View style={xTwitterStyles.actionItem}>
          <Ionicons name="chatbubble-outline" size={14} color={X_TWITTER.actionIcon} />
          <Text style={xTwitterStyles.actionCount}>2</Text>
        </View>
        <View style={xTwitterStyles.actionItem}>
          <Ionicons name="repeat-outline" size={14} color={X_TWITTER.actionIcon} />
          <Text style={xTwitterStyles.actionCount}>1</Text>
        </View>
        <View style={xTwitterStyles.actionItem}>
          <Ionicons name="heart-outline" size={14} color={X_TWITTER.actionIcon} />
          <Text style={xTwitterStyles.actionCount}>224</Text>
        </View>
        <View style={xTwitterStyles.actionItem}>
          <Ionicons name="stats-chart-outline" size={14} color={X_TWITTER.actionIcon} />
          <Text style={xTwitterStyles.actionCount}>20k</Text>
        </View>
        <View style={xTwitterStyles.rightActions}>
          <Pressable hitSlop={8} onPress={() => {}}>
            <Ionicons name="bookmark-outline" size={14} color={X_TWITTER.actionIcon} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => {}}>
            <Ionicons name="share-outline" size={14} color={X_TWITTER.actionIcon} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   Reddit card — dark background, avatar, action bar
   ─────────────────────────────────────────────────────────────── */
function RedditCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const initial = (title?.[0] ?? '?').toUpperCase();
  return (
    <View style={redditStyles.card}>
      <View style={redditStyles.header}>
        <View style={[redditStyles.avatar, { backgroundColor: theme.accent }]}>
          <Text style={redditStyles.avatarText}>{initial}</Text>
        </View>
        <View style={redditStyles.headerText}>
          <Text style={redditStyles.senderName} numberOfLines={1}>{title}</Text>
          {timeStr && <Text style={redditStyles.time}>{timeStr}</Text>}
        </View>
      </View>

      {body ? <Text style={redditStyles.body} numberOfLines={6}>{body}</Text> : null}

      <View style={redditStyles.actionBar}>
        <View style={redditStyles.actionGroup}>
          <Pressable style={redditStyles.iconBtn} hitSlop={6} onPress={() => {}}>
            <Ionicons name="arrow-up-outline" size={16} color={REDDIT.actionIcon} />
          </Pressable>
          <Text style={redditStyles.voteCount}>24</Text>
          <Pressable style={redditStyles.iconBtn} hitSlop={6} onPress={() => {}}>
            <Ionicons name="arrow-down-outline" size={16} color={REDDIT.actionIcon} />
          </Pressable>
        </View>
        <Pressable style={redditStyles.actionItem} hitSlop={6} onPress={() => {}}>
          <Ionicons name="chatbubble-outline" size={14} color={REDDIT.actionIcon} />
          <Text style={redditStyles.actionLabel}>Reply</Text>
        </Pressable>
        <Pressable style={redditStyles.actionItem} hitSlop={6} onPress={() => {}}>
          <Ionicons name="trophy-outline" size={14} color={REDDIT.actionIcon} />
          <Text style={redditStyles.actionLabel}>Award</Text>
        </Pressable>
        <Pressable style={redditStyles.actionItem} hitSlop={6} onPress={() => {}}>
          <Ionicons name="share-outline" size={14} color={REDDIT.actionIcon} />
          <Text style={redditStyles.actionLabel}>Share</Text>
        </Pressable>
        <Pressable style={redditStyles.iconBtn} hitSlop={6} onPress={() => {}}>
          <Ionicons name="ellipsis-horizontal" size={14} color={REDDIT.actionIcon} />
        </Pressable>
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   LinkedIn card — white card, avatar, verified badge, no bubble
   ─────────────────────────────────────────────────────────────── */
function LinkedInCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  const initial = (title?.[0] ?? '?').toUpperCase();
  return (
    <View style={linkedInStyles.card}>
      <View style={linkedInStyles.row}>
        <View style={[linkedInStyles.avatar, { backgroundColor: theme.accentSoft }]}>
          <Text style={[linkedInStyles.avatarText, { color: theme.accent }]}>{initial}</Text>
        </View>
        <View style={linkedInStyles.content}>
          <View style={linkedInStyles.header}>
            <Text style={linkedInStyles.senderName} numberOfLines={1}>{title}</Text>
            <View style={linkedInStyles.verifiedBadge}>
              <Ionicons name="checkmark" size={9} color="#FFFFFF" />
            </View>
            {timeStr && <Text style={linkedInStyles.time}>{timeStr}</Text>}
          </View>
          {body ? <Text style={linkedInStyles.body} numberOfLines={6}>{body}</Text> : null}
        </View>
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
   Media / social card — Instagram, X, YouTube, etc.
   ─────────────────────────────────────────────────────────────── */
function MediaCard({ title, body, theme, timeStr }: { title: string; body: string; theme: SourceAppTheme; timeStr: string | null }) {
  return (
    <View style={[mediaStyles.card, { borderTopColor: theme.accent }]}>
      <View style={[mediaStyles.accentStrip, { backgroundColor: theme.accent }]} />
      <View style={mediaStyles.inner}>
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
        <Text style={mediaStyles.title} numberOfLines={2}>{title}</Text>
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

/* WhatsApp / Telegram / Messages */
const chatStyles = StyleSheet.create({
  bubble: {
    marginLeft: 10,
    backgroundColor: CHAT.bubbleBg,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  appDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: CHAT.textTitle,
    flexShrink: 1,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    lineHeight: 20,
    color: CHAT.textBody,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: CHAT.textMeta,
  },
});

/* Facebook Messenger */
const messengerStyles = StyleSheet.create({
  container: {
    marginLeft: 10,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    paddingLeft: 4,
  },
  appDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: MESSENGER.textTitle,
    flexShrink: 1,
  },
  bubble: {
    backgroundColor: MESSENGER.bubbleBg,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: MESSENGER.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    lineHeight: 20,
    color: MESSENGER.textBody,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
    paddingRight: 4,
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: MESSENGER.textMeta,
  },
});

/* Instagram / X / YouTube / LinkedIn / Snapchat */
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

/* Discord */
const discordStyles = StyleSheet.create({
  card: {
    marginLeft: 10,
    backgroundColor: DISCORD.bg,
    borderRadius: 12,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: DISCORD.textUsername,
    flexShrink: 1,
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: DISCORD.textMeta,
    flexShrink: 0,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: DISCORD.textBody,
  },
});

/* Telegram */
const telegramStyles = StyleSheet.create({
  container: {
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
  },
  bubble: {
    backgroundColor: TELEGRAM.bg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: TELEGRAM.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
    maxWidth: '85%',
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: TELEGRAM.senderName,
    marginBottom: 2,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: TELEGRAM.textBody,
  },
  mention: {
    color: TELEGRAM.mentionColor,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: TELEGRAM.textMeta,
    textAlign: 'right',
    marginTop: 2,
  },
});

/* iMessage */
const imessageStyles = StyleSheet.create({
  container: {
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  bubble: {
    backgroundColor: IMESSAGE.bubbleBg,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: IMESSAGE.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
    maxWidth: '85%',
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    marginBottom: 2,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    lineHeight: 20,
    color: IMESSAGE.textBody,
    flexShrink: 1,
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: IMESSAGE.textMeta,
    flexShrink: 0,
    marginBottom: 1,
  },
});

/* LinkedIn */
const linkedInStyles = StyleSheet.create({
  card: {
    marginLeft: 10,
    backgroundColor: LINKEDIN.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINKEDIN.border,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 17,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: LINKEDIN.textName,
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: LINKEDIN.verifiedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: LINKEDIN.textMeta,
    marginLeft: 'auto',
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: LINKEDIN.textBody,
  },
});

/* Reddit */
const redditStyles = StyleSheet.create({
  card: {
    marginLeft: 10,
    backgroundColor: REDDIT.bg,
    borderRadius: 12,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  headerText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flex: 1,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: REDDIT.textUsername,
  },
  time: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: REDDIT.textMeta,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: REDDIT.textBody,
    marginLeft: 42,
    marginBottom: 12,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginLeft: 42,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: REDDIT.border,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    padding: 4,
    borderRadius: 6,
  },
  voteCount: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: REDDIT.textUsername,
    marginHorizontal: 2,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: REDDIT.actionIcon,
  },
});

/* X / Twitter */
const xTwitterStyles = StyleSheet.create({
  card: {
    marginLeft: 10,
    backgroundColor: X_TWITTER.bg,
    borderRadius: 12,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  senderName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: X_TWITTER.textName,
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
    fontSize: 12,
    color: X_TWITTER.textMeta,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: X_TWITTER.textBody,
    marginLeft: 46,
    marginBottom: 12,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 46,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: X_TWITTER.border,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: X_TWITTER.actionIcon,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});
