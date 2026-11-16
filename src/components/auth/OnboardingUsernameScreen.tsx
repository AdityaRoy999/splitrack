import React, { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { AltArrowLeftIcon } from '@solar-icons/react-native/bold/alt-arrow-left';
import { UserRoundedIcon } from '@solar-icons/react-native/bold/user-rounded';
import { ChartSquareIcon } from '@solar-icons/react-native/bold/chart-square';
import { CardSendIcon } from '@solar-icons/react-native/bold/card-send';
import { HistoryIcon } from '@solar-icons/react-native/bold/history';
import { SparklesIcon } from '@solar-icons/react-native/bold/sparkles';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { CARTOON_AVATARS } from './CartoonAvatars';
import { GlassSurface } from '../glass/GlassSurface';

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

  const defaultBaseName =
    initialDisplayName.trim() ||
    (initialEmail ? initialEmail.split('@')[0].replace(/[^a-zA-Z0-9 ]/g, ' ') : 'Aditya Roy');

  const [activeStep, setActiveStep] = useState<0 | 1 | 2>(0);
  const [displayName, setDisplayName] = useState(defaultBaseName);
  const [handle, setHandle] = useState(() => {
    const slug = defaultBaseName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return slug || 'aditya_roy';
  });

  const [selectedAvatarType, setSelectedAvatarType] = useState<'custom' | 'cartoon' | 'default'>('cartoon');
  const [selectedCartoonId, setSelectedCartoonId] = useState<string>('cyber_boy');
  const [customPhotoUri, setCustomPhotoUri] = useState<string>('');
  const [showAvatarPickerModal, setShowAvatarPickerModal] = useState(false);

  const cleanHandle = cleanHandleText(handle);

  const isAvailable = useMemo(() => {
    if (cleanHandle.length < 3) return false;
    if (RESERVED_HANDLES.has(cleanHandle)) return false;
    return true;
  }, [cleanHandle]);

  const handlePickPhoto = async () => {
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
          setCustomPhotoUri(`data:${mime};base64,${asset.base64}`);
        } else if (asset.uri) {
          setCustomPhotoUri(asset.uri);
        }
        setSelectedAvatarType('custom');
        setShowAvatarPickerModal(false);
        triggerNotification(NotificationType.Success);
      }
    } catch (err) {
      console.warn('Photo pick failed', err);
    }
  };

  const handleSelectCartoon = (id: string) => {
    setSelectedCartoonId(id);
    setSelectedAvatarType('cartoon');
    setShowAvatarPickerModal(false);
    triggerImpact(ImpactStyle.Light);
  };

  const handleSuggestions = useMemo(() => {
    const base = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'aditya';
    const cleanBase = base.slice(0, 14);
    return [
      `@${cleanBase}`,
      `@${cleanBase}_splits`,
      `@${cleanBase}_in`,
      `@the_${cleanBase}`,
    ];
  }, [displayName]);

  const handleNextStep = () => {
    triggerImpact(ImpactStyle.Light);
    if (activeStep === 0) {
      setActiveStep(1);
    } else if (activeStep === 1) {
      setActiveStep(2);
    } else {
      handleFinalFinish();
    }
  };

  const handlePrevStep = () => {
    triggerImpact(ImpactStyle.Light);
    if (activeStep > 0) {
      setActiveStep((prev) => (prev - 1) as any);
    }
  };

  const handleFinalFinish = () => {
    const finalName = displayName.trim() || 'Aditya Roy';
    const finalHandle = cleanHandle.length >= 3 ? `@${cleanHandle}` : `@${cleanHandleText(finalName) || 'aditya'}`;
    const avatarPayload =
      selectedAvatarType === 'custom' && customPhotoUri
        ? customPhotoUri
        : selectedAvatarType === 'cartoon'
        ? `cartoon:${selectedCartoonId}`
        : undefined;

    triggerNotification(NotificationType.Success);
    onComplete({
      displayName: finalName,
      username: finalHandle,
      avatar: avatarPayload,
    });
  };

  const currentCartoon = CARTOON_AVATARS.find((a) => a.id === selectedCartoonId) || CARTOON_AVATARS[0];

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
    <View style={[styles.root, { backgroundColor: '#000000', paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Navigation Row: Back button (if step > 0) */}
        <View style={styles.topNavRow}>
          {activeStep > 0 ? (
            <AnimatedPressable
              scaleTo={0.92}
              onPress={handlePrevStep}
              style={styles.topBackBtn}
              accessibilityLabel="Back to previous onboarding step"
            >
              <AltArrowLeftIcon size={20} color="#FFFFFF" />
            </AnimatedPressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <View style={{ flex: 1 }} />
        </View>

        {/* Content Area */}
        <View style={styles.contentFlex}>
          {/* ===================== SCREEN 1: Claim Your Unique Handle ===================== */}
          {activeStep === 0 && (
            <View style={styles.screenContainer}>
              <View style={styles.visualSlot}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => setShowAvatarPickerModal(true)}
                  style={styles.squircleAvatarWrap}
                  accessibilityLabel="Tap to choose avatar or upload photo"
                >
                  <View style={styles.squircleAvatarInner}>
                    {selectedAvatarType === 'custom' && customPhotoUri ? (
                      <Image source={{ uri: customPhotoUri }} style={styles.fullAvatarImg} />
                    ) : selectedAvatarType === 'cartoon' ? (
                      currentCartoon.render(124)
                    ) : (
                      <View style={styles.avatarSilhouetteWrap}>
                        <UserRoundedIcon size={52} color="#8E8E93" />
                      </View>
                    )}
                  </View>

                  {/* Camera Badge in bottom right */}
                  <View style={styles.cameraBadge}>
                    <CameraIcon size={14} color="#000000" />
                  </View>
                </TouchableOpacity>

                {/* Choose Avatar or Upload quick trigger */}
                <TouchableOpacity
                  onPress={() => setShowAvatarPickerModal(true)}
                  style={styles.avatarTriggerPill}
                  activeOpacity={0.8}
                >
                  <SparklesIcon size={14} color="#10B981" />
                  <Text style={styles.avatarTriggerText}>
                    {selectedAvatarType === 'cartoon' ? `${currentCartoon.name} • Change Avatar` : 'Choose 3D Cartoon / Photo'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Title & Subtitle */}
              <View style={styles.textCenterBlock}>
                <Text style={styles.mainTitle}>Claim Your</Text>
                <Text style={styles.mainTitle}>Unique Handle</Text>
                <Text style={styles.mainSubtitle}>
                  Find and secure your unique handle to make it yours.
                </Text>
              </View>

              {/* Display Name Input */}
              <View style={styles.nameInputContainer}>
                <TextInput
                  style={[styles.nameInput, webInputReset]}
                  placeholder="Your Full Name"
                  placeholderTextColor="#64748B"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              </View>

              {/* Recommendations Chips */}
              <View style={styles.sugPillRow}>
                {handleSuggestions.slice(0, 3).map((sug) => (
                  <TouchableOpacity
                    key={sug}
                    onPress={() => {
                      triggerImpact(ImpactStyle.Light);
                      setHandle(sug.slice(1));
                    }}
                    style={[
                      styles.sugChip,
                      `@${cleanHandle}` === sug && styles.sugChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sugChipText,
                        `@${cleanHandle}` === sug && styles.sugChipTextActive,
                      ]}
                    >
                      {sug}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ===================== SCREEN 2: Your Unique Username ===================== */}
          {activeStep === 1 && (
            <View style={styles.screenContainer}>
              <View style={styles.radarVisualSlot}>
                {/* Concentric Radar Ripple Rings */}
                <View style={styles.radarRingsWrap} pointerEvents="none">
                  <View style={[styles.radarRing, { width: 130, height: 130, opacity: 0.18 }]} />
                  <View style={[styles.radarRing, { width: 200, height: 200, opacity: 0.12 }]} />
                  <View style={[styles.radarRing, { width: 280, height: 280, opacity: 0.08 }]} />
                  <View style={[styles.radarRing, { width: 350, height: 350, opacity: 0.05 }]} />
                </View>

                {/* Floating Interactive Pill: @ [ username ] [✓] */}
                <View style={styles.handleRadarPill}>
                  <Text style={styles.handleAtPrefix}>@</Text>
                  <TextInput
                    style={[styles.handleRadarInput, webInputReset]}
                    placeholder="username"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={cleanHandle}
                    onChangeText={(val) => setHandle(cleanHandleText(val))}
                  />
                  {/* Clean Green Checkmark Badge */}
                  <View
                    style={[
                      styles.handleCheckBadge,
                      { backgroundColor: isAvailable ? '#10B981' : '#334155' },
                    ]}
                  >
                    <CheckCircleIcon size={18} color="#FFFFFF" />
                  </View>
                </View>
              </View>

              {/* Title & Subtitle */}
              <View style={styles.textCenterBlock}>
                <Text style={styles.mainTitle}>Your Unique</Text>
                <Text style={styles.mainTitle}>Username</Text>
                <Text style={styles.mainSubtitle}>
                  A one-of-a-kind username for your profile.
                </Text>
              </View>

              {/* Recommendations Chips */}
              <View style={styles.sugPillRow}>
                {handleSuggestions.map((sug) => (
                  <TouchableOpacity
                    key={sug}
                    onPress={() => {
                      triggerImpact(ImpactStyle.Light);
                      setHandle(sug.slice(1));
                    }}
                    style={[
                      styles.sugChip,
                      `@${cleanHandle}` === sug && styles.sugChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sugChipText,
                        `@${cleanHandle}` === sug && styles.sugChipTextActive,
                      ]}
                    >
                      {sug}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ===================== SCREEN 3: Track Everything ===================== */}
          {activeStep === 2 && (
            <View style={styles.screenContainer}>
              <View style={styles.trackCardVisualSlot}>
                {/* 3D Angled Glass Ledger Card */}
                <View style={styles.angledCardWrapper}>
                  <View style={styles.trackGlassCard}>
                    {/* Row 1: Bar Chart */}
                    <View style={styles.ledgerRow}>
                      <View style={styles.ledgerIconSquare}>
                        <ChartSquareIcon size={18} color="#A1A1AA" />
                      </View>
                      <View style={styles.ledgerLinesCol}>
                        <View style={[styles.ledgerBarTop, { width: 72 }]} />
                        <View style={[styles.ledgerBarSub, { width: 44 }]} />
                      </View>
                    </View>

                    {/* Row 2: Card */}
                    <View style={styles.ledgerRow}>
                      <View style={styles.ledgerIconSquare}>
                        <CardSendIcon size={18} color="#A1A1AA" />
                      </View>
                      <View style={styles.ledgerLinesCol}>
                        <View style={[styles.ledgerBarTop, { width: 60 }]} />
                        <View style={[styles.ledgerBarSub, { width: 40 }]} />
                      </View>
                    </View>

                    {/* Row 3: Clock */}
                    <View style={styles.ledgerRow}>
                      <View style={styles.ledgerIconSquare}>
                        <HistoryIcon size={18} color="#A1A1AA" />
                      </View>
                      <View style={styles.ledgerLinesCol}>
                        <View style={[styles.ledgerBarTop, { width: 50 }]} />
                        <View style={[styles.ledgerBarSub, { width: 32 }]} />
                      </View>
                    </View>
                  </View>

                  {/* Floating Glowing Green Checkmark Circle overlapping bottom-right */}
                  <View style={styles.floatingCheckOrb}>
                    <CheckCircleIcon size={34} color="#10B981" />
                  </View>
                </View>
              </View>

              {/* Title & Subtitle */}
              <View style={styles.textCenterBlock}>
                <Text style={styles.mainTitle}>Track Everything</Text>
                <Text style={styles.mainSubtitle}>
                  View all your UPI transactions in one place.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Bar: 3-Dot Pagination Indicator + Continue Button */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(28, insets.bottom + 12) }]}>
          {/* 3-Dot Pagination */}
          <View style={styles.paginationDotsRow}>
            {[0, 1, 2].map((stepIdx) => (
              <TouchableOpacity
                key={stepIdx}
                onPress={() => {
                  triggerImpact(ImpactStyle.Light);
                  setActiveStep(stepIdx as any);
                }}
                style={[
                  styles.dot,
                  activeStep === stepIdx ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Continue Pill Button */}
          <AnimatedPressable
            scaleTo={0.96}
            onPress={handleNextStep}
            style={styles.continueButton}
            accessibilityLabel="Continue to next step"
          >
            <Text style={styles.continueButtonText}>
              {activeStep === 2 ? 'Get Started' : 'Continue'}
            </Text>
            <AltArrowRightIcon size={18} color="#000000" />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>

      {/* ===================== 3D Cartoon Avatar & Photo Picker Modal ===================== */}
      <Modal
        visible={showAvatarPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarPickerModal(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowAvatarPickerModal(false)}
            activeOpacity={1}
          />
          <GlassSurface
            borderRadius={32}
            glassStyle="regular"
            intensity={85}
            tintColor="rgba(20, 20, 26, 0.88)"
            matteColor="#141418"
            style={styles.avatarPickerSheet}
          >
            <View style={styles.pickerHeaderRow}>
              <View>
                <Text style={styles.pickerTitle}>Choose Your Avatar</Text>
                <Text style={styles.pickerSubtitle}>Pick a 3D cartoon persona or upload your own</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAvatarPickerModal(false)}
                style={styles.pickerCloseBtn}
              >
                <CloseCircleIcon size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {/* Upload Custom Photo Option */}
            <TouchableOpacity
              onPress={handlePickPhoto}
              style={styles.uploadOptionRow}
              activeOpacity={0.8}
            >
              <View style={styles.uploadIconWrap}>
                <CameraIcon size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadOptionTitle}>Upload from Photo Library</Text>
                <Text style={styles.uploadOptionSub}>Use your own custom picture</Text>
              </View>
              <AltArrowRightIcon size={18} color="#8E8E93" />
            </TouchableOpacity>

            <Text style={styles.cartoonGridHeader}>3D CARTOON PERSONAS</Text>

            {/* Grid of 3D Cartoon Avatars */}
            <ScrollView
              contentContainerStyle={styles.cartoonGrid}
              showsVerticalScrollIndicator={false}
            >
              {CARTOON_AVATARS.map((avatar) => {
                const isSelected = selectedAvatarType === 'cartoon' && selectedCartoonId === avatar.id;
                return (
                  <TouchableOpacity
                    key={avatar.id}
                    onPress={() => handleSelectCartoon(avatar.id)}
                    style={[
                      styles.cartoonGridItem,
                      isSelected && styles.cartoonGridItemActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cartoonThumbWrap}>
                      {avatar.render(58)}
                    </View>
                    <Text style={[styles.cartoonItemName, isSelected && styles.cartoonItemNameActive]}>
                      {avatar.name}
                    </Text>
                    {isSelected && (
                      <View style={styles.cartoonSelectedCheck}>
                        <CheckCircleIcon size={14} color="#10B981" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </GlassSurface>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  keyboardWrap: {
    flex: 1,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 44,
  },
  topBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  contentFlex: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  screenContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  squircleAvatarWrap: {
    width: 128,
    height: 128,
    borderRadius: 36,
    backgroundColor: '#18181D',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  squircleAvatarInner: {
    width: 128,
    height: 128,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullAvatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarSilhouetteWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTriggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: 16,
  },
  avatarTriggerText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '500',
  },
  textCenterBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  mainSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 290,
    lineHeight: 20,
  },
  nameInputContainer: {
    width: '100%',
    maxWidth: 320,
    marginTop: 8,
    marginBottom: 12,
  },
  nameInput: {
    width: '100%',
    backgroundColor: '#18181D',
    color: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  sugPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 6,
  },
  sugChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sugChipActive: {
    backgroundColor: '#FFFFFF',
  },
  sugChipText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  sugChipTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
  radarVisualSlot: {
    width: 320,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 24,
  },
  radarRingsWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 999,
    borderColor: '#FFFFFF',
    borderWidth: 1,
  },
  handleRadarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 29, 0.94)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
    zIndex: 10,
    maxWidth: 260,
  },
  handleAtPrefix: {
    color: '#10B981',
    fontSize: 17,
    fontWeight: '700',
  },
  handleRadarInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 120,
    paddingVertical: 0,
  },
  handleCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackCardVisualSlot: {
    width: 320,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  angledCardWrapper: {
    position: 'relative',
    width: 210,
    height: 160,
  },
  trackGlassCard: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(24, 24, 30, 0.88)',
    padding: 16,
    justifyContent: 'space-between',
    transform: [{ rotate: '-4deg' }],
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ledgerIconSquare: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerLinesCol: {
    gap: 5,
  },
  ledgerBarTop: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  ledgerBarSub: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  floatingCheckOrb: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(6, 78, 59, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 20,
  },
  paginationDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
  },
  dotInactive: {
    backgroundColor: '#3F3F46',
  },
  continueButton: {
    width: '100%',
    maxWidth: 390,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  avatarPickerSheet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 18,
  },
  uploadIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOptionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadOptionSub: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 1,
  },
  cartoonGridHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
    marginBottom: 12,
  },
  cartoonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 20,
  },
  cartoonGridItem: {
    width: '22%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    position: 'relative',
  },
  cartoonGridItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  cartoonThumbWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartoonItemName: {
    color: '#D4D4D8',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  cartoonItemNameActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  cartoonSelectedCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
