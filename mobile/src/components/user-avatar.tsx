import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';

const C = {
  primary: '#2f4a37',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLowest: '#ffffff',
} as const;

interface UserAvatarProps {
  size?: number;
  fallbackSource: ImageSourcePropType;
  role: 'parent' | 'child';
}

export function UserAvatar({ size = 40, fallbackSource, role }: UserAvatarProps) {
  const profileImage = useAuthStore((state) => state.profileImage);
  const [showRemote, setShowRemote] = useState(true);

  useEffect(() => {
    setShowRemote(true);
  }, [profileImage]);

  const handlePress = () => {
    if (role === 'parent') {
      router.push('/(tabs)/settings');
    } else {
      router.push('/(child)/settings');
    }
  };

  const source = profileImage && showRemote ? { uri: profileImage } : fallbackSource;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <View style={[s.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image
          source={source}
          style={[s.image, { width: size, height: size, borderRadius: size / 2 }]}
          contentFit="cover"
          onError={() => setShowRemote(false)}
          cachePolicy="memory-disk"
        />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderWidth: 2,
    borderColor: C.surfaceContainerLowest,
    backgroundColor: C.surfaceContainerHighest,
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
  image: {
    backgroundColor: C.surfaceContainerHighest,
  },
});
