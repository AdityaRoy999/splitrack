import React, { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { CameraIcon } from '@solar-icons/react-native/bold/camera';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { AltArrowRightIcon } from '@solar-icons/react-native/bold/alt-arrow-right';
import { UserRoundedIcon } from '@solar-icons/react-native/bold/user-rounded';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassPill } from '../glass/GlassPill';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';

interface OnboardingUsernameScreenProps {
  initialDisplayName?: string;
  initialEmail?: string;
  onComplete: (data: { displayName: string; username: string; avatar?: string }) => void;
}

const RESERVED_HANDLES = new Set([
  'admin',
  'support',
  'official',
  'splittrack',
  'help',
  'api',
  'system',
]);

const cleanHandleText = (text: string): string => {
  return text.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
};

export const OnboardingUsernameScreen: React.FC<OnboardingUsernameScreenProps> = ({
  initialDisplayName = '',
  initialEmail = '',
  onComplete,
}) => {
  const insets = useSafeAreaInsets();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const defaultBaseName =
    initialDisplayName.trim() ||
    (initialEmail ? initialEmail.split('@')[0].replace(/[^a-zA-Z0-9 ]/g, ' ') : 'Aditya Roy');

  const [displayName, setDisplayName] = useState(defaultBaseName);
  const [handle, setHandle] = useState(() => {
    const slug = defaultBaseName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return slug || 'alex';
  });
  const [photoUri, setPhotoUri] = useState<string>('');
  const [picking, setPicking] = useState(false);

  const rootBg = isDark ? '#000000' : '#F8F9FD';
  const cardBg = isDark ? '#111114' : '#FFFFFF';
  const inputBg = isDark ? '#18181D' : '#F2F3F7';
  const chipBg = isDark ? '#1B1B22' : '#ECECF2';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

  const cleanHandle = cleanHandleText(handle);

  const isAvailable = useMemo(() => {
    if (cleanHandle.length < 3) return false;
    if (RESERVED_HANDLES.has(cleanHandle)) return false;
    return true;
  }, [cleanHandle]);

  const handlePickPhoto = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        triggerNotification(NotificationType.Error);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: Platform.OS === 'web',
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setPhotoUri(`data:${mime};base64,${asset.base64}`);
        } else if (asset.uri) {
          setPhotoUri(asset.uri);
        }
      }
    } catch (err) {
      console.warn('Photo pick failed', err);
    } finally {
      setPicking(false);
    }
  };

  const handleSuggestions = useMemo(() => {
    const base = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'user';
    const cleanBase = base.slice(0, 15);
    return [
      `@${cleanBase}`,
      `@${cleanBase}_split`,
      `@${cleanBase}99`,
      `@the_${cleanBase}`,
    ];
  }, [displayName]);

  const handleFinish = () => {
    const finalName = displayName.trim() || 'Alex';
    const finalHandle = cleanHandle.length >= 3 ? `@${cleanHandle}` : `@${cleanHandleText(finalName) || 'alex'}`;

    triggerNotification(NotificationType.Success);
    onComplete({
      displayName: finalName,
      username: finalHandle,
      avatar: photoUri || undefined,
    });
  };

  const webInputReset =
    Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
          outline: 'none',
          boxShadow: 'none',
        } as any)
      : undefined;

  return (
    <View style={[styles.root, { backgroundColor: rootBg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(32, insets.bottom + 20) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.stepPill, { backgroundColor: cardBg }]}>
              <Text style={[styles.stepPillText, { color: '#10B981' }]}>Step 2 of 2 • Profile Setup</Text>
            </View>

            <Text style={[styles.title, { color: textColor }]}>
              Claim your unique handle
            </Text>
            <Text style={[styles.subtitle, { color: mutedText }]}>
              Your friends will use your unique @username to find you, split shared tabs, and route instant UPI settlements.
            </Text>
          </View>

          {/* Profile Card */}
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {/* Avatar Picker */}
            <View style={styles.avatarSection}>
              <AnimatedPressable
                scaleTo={0.93}
                onPress={handlePickPhoto}
                contentStyle={[styles.avatarBox, { backgroundColor: inputBg }]}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <UserRoundedIcon size={38} color={mutedText} />
                  </View>
                )}
                <View style={[styles.camBadge, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}>
                  <CameraIcon size={13} color={isDark ? '#000000' : '#FFFFFF'} />
                </View>
              </AnimatedPressable>

              <TouchableOpacity onPress={handlePickPhoto} style={styles.uploadTextBtn}>
                <Text style={[styles.uploadText, { color: textColor }]}>
                  {photoUri ? 'Change Profile Photo' : 'Upload Profile Photo'}
                </Text>
                <Text style={[styles.uploadSubtext, { color: mutedText }]}>
                  Optional • Tap to pick from gallery
                </Text>
              </TouchableOpacity>
            </View>

            {/* Display Name */}
            <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 18 }]}>
              DISPLAY NAME
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: inputBg, color: textColor }, webInputReset]}
              placeholder="Your full name"
              placeholderTextColor={mutedText}
              value={displayName}
              onChangeText={setDisplayName}
              returnKeyType="next"
            />

            {/* Unique Username Input */}
            <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 16 }]}>
              UNIQUE USERNAME
            </Text>
            <View style={[styles.handleInputRow, { backgroundColor: inputBg }]}>
              <Text style={[styles.handlePrefix, { color: isAvailable ? '#10B981' : mutedText }]}>@</Text>
              <TextInput
                style={[
                  styles.handleTextInput,
                  { color: textColor },
                  webInputReset,
                ]}
                placeholder="username"
                placeholderTextColor={mutedText}
                autoCapitalize="none"
                autoCorrect={false}
                value={cleanHandle}
                onChangeText={(val) => setHandle(cleanHandleText(val))}
              />
              {cleanHandle.length >= 3 && (
                <View style={styles.availBadge}>
                  <CheckCircleIcon size={16} color={isAvailable ? '#10B981' : '#EF4444'} />
                  <Text
                    style={[
                      styles.availText,
                      { color: isAvailable ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {isAvailable ? 'Available' : 'Taken'}
                  </Text>
                </View>
              )}
            </View>

            {/* Suggestions */}
            <Text style={[styles.suggestionsLabel, { color: mutedText }]}>SUGGESTIONS</Text>
            <View style={styles.suggestionsRow}>
              {handleSuggestions.map((sug) => (
                <TouchableOpacity
                  key={sug}
                  onPress={() => {
                    triggerImpact(ImpactStyle.Light);
                    setHandle(sug.slice(1));
                  }}
                  style={[
                    styles.sugPill,
                    {
                      backgroundColor: `@${cleanHandle}` === sug ? textColor : chipBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sugPillText,
                      {
                        color: `@${cleanHandle}` === sug ? (isDark ? '#000000' : '#FFFFFF') : textColor,
                      },
                    ]}
                  >
                    {sug}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Continue Action */}
          <View style={styles.footer}>
            <GlassPill
              label="Complete Setup & Enter SplitTrack"
              variant="accent"
              size="lg"
              onPress={() => {
                if (displayName.trim() && cleanHandle.length >= 3) {
                  handleFinish();
                }
              }}
              icon={<AltArrowRightIcon size={18} color={isDark ? '#000000' : '#FFFFFF'} />}
              style={
                !displayName.trim() || cleanHandle.length < 3
                  ? { width: '100%', opacity: 0.45 }
                  : { width: '100%' }
              }
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  header: {
    gap: 6,
    paddingTop: 10,
  },
  stepPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 4,
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  card: {
    borderRadius: 24,
    padding: 18,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 10,
  },
  avatarBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  camBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTextBtn: {
    flex: 1,
    gap: 2,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadSubtext: {
    fontSize: 11,
    fontWeight: '400',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  },
  handleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  handlePrefix: {
    fontSize: 16,
    fontWeight: '700',
  },
  handleTextInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    fontWeight: '600',
  },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availText: {
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionsLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sugPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  sugPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    marginTop: 8,
  },
  submitBtn: {
    width: '100%',
  },
});
