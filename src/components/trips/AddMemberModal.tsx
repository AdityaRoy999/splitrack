import React, { useState } from 'react';
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
import { NotificationType, triggerNotification } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { Friend } from '../../types';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassPill } from '../glass/GlassPill';
import { GradualBlur } from '../effects/GradualBlur';

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

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  visible,
  onClose,
  tripId,
  editingFriend,
}) => {
  const { addFriend, updateFriend, addMemberToTrip } = useSplitTrack();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const isEditing = Boolean(editingFriend);

  const [name, setName] = useState(editingFriend?.name ?? '');
  const [handle, setHandle] = useState(editingFriend?.handle ?? '');
  const [upiId, setUpiId] = useState(editingFriend?.upiId ?? '');
  const [phone, setPhone] = useState(editingFriend?.phone ?? '');
  const [photoUri, setPhotoUri] = useState<string>(editingFriend?.avatar ?? '');
  const [picking, setPicking] = useState(false);

  const bgSheet = isDark ? '#09090B' : '#F4F4F8';
  const cardBg = isDark ? '#121216' : '#FFFFFF';
  const inputBg = isDark ? '#1B1B20' : '#F2F3F7';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

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
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss modal backdrop"
        />
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: bgSheet },
          ]}
        >
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
                  : 'Upload a photo and enter member details'}
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

                <Text style={[styles.fieldLabel, { color: mutedText }]}>NAME</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, color: textColor }, WEB_INPUT_RESET]}
                  placeholder="Member name"
                  placeholderTextColor={mutedText}
                  value={name}
                  onChangeText={setName}
                  returnKeyType="next"
                />

                <Text style={[styles.fieldLabel, styles.fieldSpacing, { color: mutedText }]}>
                  HANDLE
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, color: textColor }, WEB_INPUT_RESET]}
                  placeholder="@username"
                  placeholderTextColor={mutedText}
                  value={handle}
                  onChangeText={setHandle}
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

            <GradualBlur position="top" height={18} strength={1.1} layers={5} tint={bgSheet} />
            <GradualBlur position="bottom" height={22} strength={1.2} layers={6} tint={bgSheet} />
          </View>

          <GlassPill
            label={isEditing ? 'Save Changes' : 'Add Member'}
            variant="accent"
            size="lg"
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </View>
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
    maxHeight: '88%',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  scrollWrap: {
    position: 'relative',
    flexShrink: 1,
  },
  scrollContent: {
    gap: 12,
    paddingTop: 4,
    paddingBottom: 16,
  },
  card: {
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    borderWidth: 0,
  },
  avatarPickerBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 0,
  },
  avatarPreview: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 16,
  },
  photoHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  removePhotoPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  removePhotoText: {
    fontSize: 11,
    fontWeight: '500',
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  fieldSpacing: {
    marginTop: 12,
  },
  textInput: {
    width: '100%',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '400',
    borderWidth: 0,
  },
  saveBtn: {
    marginTop: 8,
    borderWidth: 0,
  },
});

export default AddMemberModal;
