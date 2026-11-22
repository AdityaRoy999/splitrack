import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CARTOON_AVATARS } from '../auth/CartoonAvatars';

interface UserAvatarProps {
  avatarUri?: string | null;
  size?: number;
  borderRadius?: number;
  isDark?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  name?: string;
}

// Only resolved photos can be used as image sources. Canonical media references
// and cartoon selections are rendered separately from the Image component.
export const isPhotoUri = (uri?: string | null) => Boolean(uri && /^(https?:\/\/|file:\/\/|content:\/\/|blob:|data:image\/)/i.test(uri));

export const UserAvatar = React.memo(function UserAvatar({
  avatarUri,
  size = 40,
  borderRadius = 14,
  isDark = true,
  style,
  imageStyle,
  name,
}: UserAvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (avatarUri && avatarUri.startsWith('cartoon:')) {
    const cartoonId = avatarUri.replace('cartoon:', '');
    const found = CARTOON_AVATARS.find((a) => a.id === cartoonId) || CARTOON_AVATARS[0];
    return (
      <View
        style={[
          styles.container,
          { width: size, height: size, borderRadius, overflow: 'hidden' },
          style,
        ]}
      >
        {found.render(size)}
      </View>
    );
  }

  const hasPhoto = isPhotoUri(avatarUri) && failedUri !== avatarUri;
  const initials = name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: isDark ? '#000000' : '#FFFFFF',
        },
        style,
      ]}
    >
      {!hasPhoto && initials ? (
        <Text style={{ color: isDark ? '#F4F4F5' : '#18181B', fontSize: size * 0.36, fontWeight: '600' }}>{initials}</Text>
      ) : <Image
        source={
          hasPhoto
            ? { uri: avatarUri! }
            : isDark
            ? require('../../../assets/icon-dark.png')
            : require('../../../assets/icon-light.png')
        }
        style={[styles.img, imageStyle]}
        resizeMode="cover"
        fadeDuration={0}
        onError={hasPhoto ? () => setFailedUri(avatarUri!) : undefined}
      />}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: '100%',
    height: '100%',
  },
});
