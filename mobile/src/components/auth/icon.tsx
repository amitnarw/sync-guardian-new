import { Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type IconName =
  | 'eco'
  | 'family-restroom'
  | 'child-care'
  | 'spa'
  | 'mail'
  | 'lock'
  | 'shield'
  | 'apple'
  | 'favorite'
  | 'arrow-forward'
  | 'image'
  | 'person';

// Emoji/Unicode mapping for icons
const iconMap: Record<IconName, string> = {
  eco: '🌿',
  'family-restroom': '👨‍👩‍👧',
  'child-care': '👶',
  spa: '✨',
  mail: '✉️',
  lock: '🔒',
  shield: '🛡️',
  apple: '🍎',
  favorite: '❤️',
  'arrow-forward': '→',
  image: '🖼️',
  person: '👤',
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: TextStyle;
}

export function Icon({ name, size = 24, color = '#000', style }: IconProps) {
  return (
    <Text style={[{ fontSize: size, color }, style]}>
      {iconMap[name]}
    </Text>
  );
}

// SVG leaf icon matching Stitch "nest_eco_leaf" design
interface NestEcoLeafIconProps {
  size?: number;
  style?: ViewStyle;
}

export function NestEcoLeafIcon({ size = 120, style }: NestEcoLeafIconProps) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg viewBox="0 0 100 100" width={size} height={size}>
        <Path fill="#6b8e5a" d="M50 15c-5 20-20 35-40 40 5 25 20 40 45 45 15-20 25-35 25-60 0-15-15-25-30-25z"/>
        <Path fill="#8fbc6a" d="M50 15c5 20 20 35 40 40-5 25-20 40-45 45-15-20-25-35-25-60 0-15 15-25 30-25z"/>
        <Path fill="none" stroke="#4a6741" strokeWidth="2" d="M50 30v45M38 48c8 0 16-5 24 0M38 62c8 0 16 5 24 0"/>
      </Svg>
    </View>
  );
}

// Export MaterialIcons-like component for compatibility
export function MaterialIcons({ name, size, color, style }: IconProps) {
  return <Icon name={name} size={size} color={color} style={style} />;
}

// For glyphMap access (for typing compatibility)
export const MaterialIconsGlyphMap = iconMap;