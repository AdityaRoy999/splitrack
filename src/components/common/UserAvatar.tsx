import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { CARTOON_AVATARS } from '../auth/CartoonAvatars';

interface UserAvatarProps {
  avatarUri?: string | null;
  size?: number;
  borderRadius?: number;
  isDark?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUri,
  size = 40,
  borderRadius = 14,
  isDark = true,
  style,
  imageStyle,
}) => {
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
      <Image
        source={
          avatarUri
            ? { uri: avatarUri }
            : isDark
            ? require('../../../assets/icon-dark.png')
            : require('../../../assets/icon-light.png')
        }
        style={[styles.img, imageStyle]}
        resizeMode="cover"
      />
    </View>
  );
};

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
