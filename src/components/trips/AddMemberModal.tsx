import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraIcon } from '@solar-icons/react-native/bold/camera';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { UserRoundedIcon } from '@solar-icons/react-native/bold/user-rounded';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { Friend } from '../../types';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassPill } from '../glass/GlassPill';
import { GlassModalSheet } from '../common/GlassModalSheet';

interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
  tripId?: string;
  editingFriend?: Friend | null;
}

const WEB_INPUT_RESET =
  Platform.OS === 'web'
    ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
        outline: 'none',
        boxShadow: 'none',
      } as any)
    : undefined;

// Directory of network members to allow searching by name or unique @username
const DIRECTORY_PROFILES: Omit<Friend, 'id' | 'netBalance'>[] = [
  {
    name: 'Aditya Roy',
    handle: '@aditya',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    upiId: 'aditya@okaxis',
    phone: '+91 91376 57510',
  },
  {
    name: 'Aditya Sharma',
    handle: '@aditya_sharma',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    upiId: 'adityasharma@paytm',
    phone: '+91 98201 44321',
  },
  {
    name: 'Aditya Verma',
    handle: '@adityav',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    upiId: 'adi@slice',
    phone: '+91 97112 88490',
  },
  {
    name: 'Alex Chen',
    handle: '@alex',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    upiId: 'alex@slice',
    phone: '+91 98765 43210',
  },
  {
    name: 'Emily Smith',
    handle: '@emily_s',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    upiId: 'emily@okhdfcbank',
    phone: '+91 98112 33445',
  },
  {
    name: 'Olivia Wilson',
    handle: '@olivia_w',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    upiId: 'olivia@okaxis',
    phone: '+91 99203 11892',
  },
  {
    name: 'James Davis',
    handle: '@james_d',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
    upiId: 'james@ybl',
    phone: '+91 98701 55678',
  },
  {
    name: 'Robert Smith',
    handle: '@robert_s',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    upiId: 'robert@paytm',
    phone: '+91 98334 22110',
  },
  {
    name: 'William Smith',
    handle: '@william_s',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80',
    upiId: 'william@upi',
    phone: '+91 98450 99887',
  },
  {
    name: 'Priya Kapoor',
    handle: '@priya_k',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    upiId: 'priya@okicici',
    phone: '+91 98200 77123',
  },
  {
    name: 'Rahul Mehta',
    handle: '@rahul_m',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    upiId: 'rahul@slice',
    phone: '+91 98711 00223',
  },
  {
    name: 'Ananya Rao',
    handle: '@ananya_r',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
    upiId: 'ananya@jupiteraxis',
    phone: '+91 99100 44556',
  },
];

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  visible,
  onClose,
  tripId,
  editingFriend,
}) => {
  const { friends, addFriend, updateFriend, addMemberToTrip } = useSplitTrack();
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const isEditing = Boolean(editingFriend);

  const [name, setName] = useState(editingFriend?.name ?? '');
  const [handle, setHandle] = useState(editingFriend?.handle ?? '');
  const [upiId, setUpiId] = useState(editingFriend?.upiId ?? '');
  const [phone, setPhone] = useState(editingFriend?.phone ?? '');
  const [photoUri, setPhotoUri] = useState<string>(editingFriend?.avatar ?? '');
  const [picking, setPicking] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const cardBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')
    : (isDark ? '#121216' : '#FFFFFF');
  const inputBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
    : (isDark ? '#1B1B20' : '#F2F3F7');
  const chipBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.04)')
    : (isDark ? '#23232C' : '#E5E7EB');
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

  // Search through all known friends & directory users by name OR username
  const searchMatches = useMemo(() => {
    if (isEditing) return [];
    const q = (name || handle).trim().toLowerCase().replace(/^@/, '');
    if (!q || q.length < 1) return [];

    const pool = [
      ...friends.map((f) => ({
        name: f.name,
        handle: f.handle,
        avatar: f.avatar,
        upiId: f.upiId || '',
        phone: f.phone || '',
        isKnownFriend: true,
      })),
      ...DIRECTORY_PROFILES.map((p) => ({
        ...p,
        isKnownFriend: false,
      })),
    ];

    const seenHandles = new Set<string>();
    const results: typeof pool = [];

    for (const person of pool) {
      const hKey = person.handle.toLowerCase();
      if (seenHandles.has(hKey)) continue;

      const matchName = person.name.toLowerCase().includes(q);
      const matchHandle = person.handle.toLowerCase().includes(q);

      if (matchName || matchHandle) {
        seenHandles.add(hKey);
        results.push(person);
        if (results.length >= 5) break;
      }
    }

    return results;
  }, [name, handle, friends, isEditing]);

  const handleSelectSuggested = (person: (typeof searchMatches)[0]) => {
    triggerImpact(ImpactStyle.Light);
    setName(person.name);
    setHandle(person.handle);
    if (person.avatar) setPhotoUri(person.avatar);
    if (person.upiId) setUpiId(person.upiId);
    if (person.phone) setPhone(person.phone);
    setShowSuggestions(false);
  };

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

  const handleSave = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      triggerNotification(NotificationType.Error);
      return;
    }

    const fallbackSlug =
      cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ||
      'member';
    const rawHandle = handle.trim();
    const formattedHandle = rawHandle
      ? rawHandle.startsWith('@')
        ? rawHandle
        : `@${rawHandle}`
      : `@${fallbackSlug}`;
    const cleanUpi = upiId.trim();
    const cleanPhone = phone.trim();

    if (editingFriend) {
      updateFriend(editingFriend.id, {
        name: cleanName,
        handle: formattedHandle,
        avatar: photoUri,
        upiId: cleanUpi || undefined,
        phone: cleanPhone || undefined,
      });
      onClose();
      return;
    }

    if (tripId) {
      addMemberToTrip(tripId, { name: cleanName, avatar: photoUri });
    } else {
      addFriend({
        name: cleanName,
        handle: formattedHandle,
        avatar: photoUri,
        upiId: cleanUpi || undefined,
        phone: cleanPhone || undefined,
      });
      triggerNotification(NotificationType.Success);
    }

    setName('');
    setHandle('');
    setUpiId('');
    setPhone('');
    setPhotoUri('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss modal backdrop"
        />
        <GlassModalSheet style={styles.sheetContainer}>
          <View style={styles.dragHandleWrap}>
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: isDark ? '#27272A' : '#D4D4D8' },
              ]}
            />
          </View>

          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: textColor }]}>
                {isEditing ? 'Edit Member' : 'Add Member'}
              </Text>
              <Text style={[styles.subtitleText, { color: mutedText }]}>
                {isEditing
                  ? 'Update photo, name, and payment details'
                  : 'Search by name or unique @username to add'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close member modal"
              style={[styles.closeBtn, { backgroundColor: cardBg }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.scrollWrap}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.card, { backgroundColor: cardBg }]}>
                <AnimatedPressable
                  scaleTo={0.94}
                  onPress={handlePickPhoto}
                  accessibilityLabel="Upload member photo"
                  contentStyle={[styles.avatarPickerBox, { backgroundColor: inputBg }]}
                >
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.avatarPreview} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <UserRoundedIcon size={34} color={mutedText} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.cameraBadge,
                      { backgroundColor: isDark ? '#F4F4F5' : '#18181B' },
                    ]}
                  >
                    <CameraIcon size={13} color={isDark ? '#18181B' : '#FFFFFF'} />
                  </View>
                </AnimatedPressable>

                <View style={styles.photoActionRow}>
                  <AnimatedPressable scaleTo={0.95} onPress={handlePickPhoto}>
                    <Text style={[styles.photoHint, { color: mutedText }]}>
                      {photoUri ? 'Tap photo to change' : 'Upload Photo'}
                    </Text>
                  </AnimatedPressable>
                  {photoUri ? (
                    <AnimatedPressable
                      scaleTo={0.94}
                      onPress={() => setPhotoUri('')}
                      contentStyle={[styles.removePhotoPill, { backgroundColor: inputBg }]}
                    >
                      <Text style={[styles.removePhotoText, { color: mutedText }]}>
                        Remove
                      </Text>
                    </AnimatedPressable>
                  ) : null}
                </View>

                {/* Name Input with Auto-search */}
                <Text style={[styles.fieldLabel, { color: mutedText }]}>FULL NAME</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, color: textColor }, WEB_INPUT_RESET]}
                  placeholder="e.g. Aditya Roy"
                  placeholderTextColor={mutedText}
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  returnKeyType="next"
                />

                {/* Dropdown Suggestions when searching by Name or Username */}
                {showSuggestions && searchMatches.length > 0 && (
                  <View style={[styles.dropdownContainer, { backgroundColor: inputBg, borderColor: chipBg }]}>
                    <View style={styles.dropdownHeader}>
                      <Text style={[styles.dropdownHeaderText, { color: mutedText }]}>
                        SELECT UNIQUE USERNAME ({searchMatches.length})
                      </Text>
                      <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                        <CloseCircleIcon size={13} color={mutedText} />
                      </TouchableOpacity>
                    </View>

                    {searchMatches.map((person) => (
                      <TouchableOpacity
                        key={person.handle}
                        onPress={() => handleSelectSuggested(person)}
                        activeOpacity={0.75}
                        style={[styles.dropdownItem, { borderBottomColor: chipBg }]}
                      >
                        {person.avatar ? (
                          <Image source={{ uri: person.avatar }} style={styles.dropdownAvatar} />
                        ) : (
                          <View style={[styles.dropdownAvatarFallback, { backgroundColor: chipBg }]}>
                            <Text style={[styles.dropdownAvatarText, { color: textColor }]}>
                              {person.name.slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={styles.dropdownItemInfo}>
                          <Text style={[styles.dropdownItemName, { color: textColor }]} numberOfLines={1}>
                            {person.name}
                          </Text>
                          <Text style={[styles.dropdownItemHandle, { color: '#10B981' }]} numberOfLines={1}>
                            {person.handle}
                          </Text>
                        </View>

                        {person.upiId ? (
                          <View style={[styles.dropdownUpiBadge, { backgroundColor: chipBg }]}>
                            <Text style={[styles.dropdownUpiText, { color: mutedText }]} numberOfLines={1}>
                              {person.upiId}
                            </Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Username / Handle Input */}
                <Text style={[styles.fieldLabel, styles.fieldSpacing, { color: mutedText }]}>
                  UNIQUE USERNAME
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, color: textColor }, WEB_INPUT_RESET]}
                  placeholder="@username (e.g. @aditya)"
                  placeholderTextColor={mutedText}
                  value={handle}
                  onChangeText={(val) => {
                    setHandle(val);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  autoCapitalize="none"
                  returnKeyType="next"
                />

                <Text style={[styles.fieldLabel, styles.fieldSpacing, { color: mutedText }]}>
                  UPI ID (OPTIONAL)
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, color: textColor }, WEB_INPUT_RESET]}
                  placeholder="name@okaxis"
                  placeholderTextColor={mutedText}
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  returnKeyType="next"
                />

                <Text style={[styles.fieldLabel, styles.fieldSpacing, { color: mutedText }]}>
                  PHONE (OPTIONAL)
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, color: textColor }, WEB_INPUT_RESET]}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={mutedText}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
            </ScrollView>
          </View>

          <GlassPill
            label={isEditing ? 'Save Changes' : 'Add Member'}
            variant="accent"
            size="lg"
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </GlassModalSheet>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 28,
    maxHeight: '90%',
    borderWidth: 0,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollWrap: {
    position: 'relative',
    flexShrink: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: 18,
    gap: 12,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 0,
  },
  avatarPickerBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    marginBottom: 6,
  },
  avatarPreview: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  photoHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  removePhotoPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  removePhotoText: {
    fontSize: 11,
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  fieldSpacing: {
    marginTop: 12,
  },
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '400',
    borderWidth: 0,
  },
  dropdownContainer: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dropdownHeaderText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
  },
  dropdownAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dropdownAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dropdownItemInfo: {
    flex: 1,
    gap: 1,
  },
  dropdownItemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownItemHandle: {
    fontSize: 11,
    fontWeight: '600',
  },
  dropdownUpiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 120,
  },
  dropdownUpiText: {
    fontSize: 10,
    fontWeight: '500',
  },
  saveBtn: {
    marginTop: 8,
  },
});
