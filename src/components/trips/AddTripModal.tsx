import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { CameraIcon } from '@solar-icons/react-native/bold/camera';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { NotificationType, triggerNotification } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassPill } from '../glass/GlassPill';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';
import { AddCategoryModal } from '../categories/AddCategoryModal';

interface AddTripModalProps {
  visible: boolean;
  onClose: () => void;
}

const GRADIENT_OPTIONS: [string, string][] = [
  ['#222226', '#141416'],
  ['#2A2A30', '#18181C'],
  ['#33333A', '#1C1C20'],
  ['#1E2024', '#0E0E10'],
];

const COVER_PHOTO_PRESETS = [
  {
    id: 'beach',
    label: 'Beach',
    uri: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'mountains',
    label: 'Mountains',
    uri: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'apartment',
    label: 'Loft',
    uri: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'night',
    label: 'City',
    uri: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=600&q=80',
  },
];

const TRIP_CATEGORIES = [
  { value: 'trip', label: 'Trip' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'party', label: 'Party' },
  { value: 'weekend', label: 'Weekend' },
];

export const AddTripModal: React.FC<AddTripModalProps> = ({ visible, onClose }) => {
  const { friends, categories, addTrip } = useSplitTrack();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [tripName, setTripName] = useState('');
  const [category, setCategory] = useState<string>('trip');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [selectedGradient] = useState<[string, string]>(GRADIENT_OPTIONS[0]);
  const [selectedCover, setSelectedCover] = useState<string>(COVER_PHOTO_PRESETS[0].uri);
  const [customCoverUri, setCustomCoverUri] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['user']);

  const categoryItems = useMemo(() => {
    const baseValues = new Set(TRIP_CATEGORIES.map((c) => c.value.toLowerCase()));
    const extra = categories
      .filter((c) => !baseValues.has(c.name.toLowerCase()))
      .map((c) => ({ value: c.name, label: c.name }));
    return [...TRIP_CATEGORIES, ...extra];
  }, [categories]);

  const handlePickCoverPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Please allow photo library access to upload a trip album cover.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.78,
        base64: Platform.OS === 'web',
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const nextUri =
          Platform.OS === 'web' && asset.base64
            ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
            : asset.uri;
        setCustomCoverUri(nextUri);
        setSelectedCover(nextUri);
      }
    } catch {
      Alert.alert('Upload failed', 'Could not load the selected cover photo.');
    }
  };

  const handleMemberChange = (id: string, checked: boolean) => {
    if (id === 'user') return;
    if (checked) {
      if (!selectedMembers.includes(id)) {
        setSelectedMembers([...selectedMembers, id]);
      }
    } else {
      setSelectedMembers(selectedMembers.filter((m) => m !== id));
    }
  };

  const handleCreate = () => {
    if (!tripName.trim()) return;

    triggerNotification(NotificationType.Success);

    const catMeta = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
    addTrip({
      name: tripName.trim(),
      category,
      icon:
        category === 'trip'
          ? 'Palmtree'
          : category === 'apartment'
            ? 'Home'
            : catMeta?.iconKey || 'Users',
      coverGradient: selectedGradient,
      coverImage: selectedCover,
      startDate: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      members: selectedMembers,
      currency: 'INR',
    });

    setTripName('');
    setCustomCoverUri(null);
    setSelectedCover(COVER_PHOTO_PRESETS[0].uri);
    setSelectedMembers(['user']);
    onClose();
  };

  const bgSheet = isDark ? '#09090B' : '#FFFFFF';
  const inputBg = isDark ? '#18181D' : '#F3F4F6';
  const chipBg = isDark ? '#1C1C22' : '#EFEFF4';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

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
            <View style={[styles.dragHandle, { backgroundColor: isDark ? '#27272A' : '#D4D4D8' }]} />
          </View>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: textColor }]}>Create New Trip or Group</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1C20' : '#F3F4F6' }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.scrollAreaWrap}>
            <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
              {/* Name Input */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: mutedText }]}>TRIP OR GROUP NAME</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: inputBg, color: textColor },
                    Platform.OS === 'web' &&
                      ({
                        outlineStyle: 'none',
                        outlineWidth: 0,
                        outline: 'none',
                        boxShadow: 'none',
                      } as any),
                  ]}
                  placeholder="e.g. Kasol Vacation 🌲"
                  placeholderTextColor={mutedText}
                  value={tripName}
                  onChangeText={setTripName}
                />
              </View>

              {/* Category Selector with + button & rounded JellyRadio */}
              <View style={styles.fieldGroup}>
                <View style={styles.catHeaderRow}>
                  <Text style={[styles.fieldLabel, { color: mutedText }]}>CATEGORY</Text>
                  <AnimatedPressable
                    scaleTo={0.92}
                    onPress={() => setShowAddCategory(true)}
                    accessibilityLabel="Add new trip category"
                    contentStyle={[styles.addCategoryPlusBtn, { backgroundColor: chipBg }]}
                  >
                    <AddCircleIcon size={15} color={textColor} />
                  </AnimatedPressable>
                </View>
                <JellyRadio
                  scrollable
                  fadeColor={bgSheet}
                  items={categoryItems}
                  value={category}
                  onChange={(val) => setCategory(val)}
                  chipColor={chipBg}
                  activeColor={activeBg}
                  textColor={textColor}
                  activeTextColor={activeText}
                  size="sm"
                  gap={8}
                  radius={999}
                />
              </View>

              {/* Album Cover Photo Selector */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: mutedText }]}>ALBUM COVER PHOTO</Text>
                <View style={styles.horizontalBlurWrap}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.coverRow}
                  >
                <AnimatedPressable
                  scaleTo={0.94}
                  onPress={handlePickCoverPhoto}
                  accessibilityLabel="Upload custom album cover photo"
                  contentStyle={[
                    styles.coverTile,
                    {
                      backgroundColor:
                        customCoverUri && selectedCover === customCoverUri
                          ? activeBg
                          : inputBg,
                      opacity: 1,
                    },
                  ]}
                >
                  {customCoverUri ? (
                    <Image
                      source={{ uri: customCoverUri }}
                      style={styles.coverThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.uploadCoverBox,
                        { backgroundColor: isDark ? '#27272E' : '#E5E7EB' },
                      ]}
                    >
                      <CameraIcon size={20} color={textColor} />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.coverLabel,
                      {
                        color:
                          customCoverUri && selectedCover === customCoverUri
                            ? activeText
                            : textColor,
                      },
                    ]}
                  >
                    {customCoverUri ? 'Change' : 'Upload'}
                  </Text>
                </AnimatedPressable>

                {COVER_PHOTO_PRESETS.map((preset) => {
                  const active = selectedCover === preset.uri;
                  return (
                    <AnimatedPressable
                      key={preset.id}
                      scaleTo={0.94}
                      onPress={() => setSelectedCover(preset.uri)}
                      contentStyle={[
                        styles.coverTile,
                        {
                          backgroundColor: active ? activeBg : inputBg,
                          opacity: active ? 1 : 0.72,
                        },
                      ]}
                    >
                      <Image source={{ uri: preset.uri }} style={styles.coverThumb} resizeMode="cover" />
                      <Text
                        style={[
                          styles.coverLabel,
                          { color: active ? activeText : textColor },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
                  </ScrollView>
                </View>
              </View>

              {/* Members Selection using React Bits SpringCheck */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: mutedText }]}>ADD MEMBERS</Text>
                <View style={styles.membersList}>
                  <View style={[styles.memberRow, { backgroundColor: inputBg }]}>
                    <SpringCheck
                      label="You (Organizer)"
                      checked={true}
                      disabled
                      color={textColor}
                      fillColor={activeBg}
                      checkColor={activeText}
                      boxSize={22}
                      boxRadius={999}
                      fontSize={14}
                      strike="none"
                      doneOpacity={1}
                    />
                  </View>

                  {friends.map((friend) => {
                    const isChecked = selectedMembers.includes(friend.id);
                    return (
                      <View key={friend.id} style={[styles.memberRow, { backgroundColor: inputBg }]}>
                        <SpringCheck
                          label={friend.name}
                          checked={isChecked}
                          onChange={(checked) => handleMemberChange(friend.id, checked)}
                          color={textColor}
                          fillColor={activeBg}
                          checkColor={activeText}
                          boxSize={22}
                          boxRadius={999}
                          fontSize={14}
                          strike="none"
                          doneOpacity={1}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>

          <GlassPill
            label="Create Trip"
            variant="accent"
            size="lg"
            onPress={handleCreate}
            style={styles.createBtn}
          />
        </View>
      </View>

      <AddCategoryModal
        visible={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onCreated={(created) => setCategory(created.name)}
      />
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
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '85%',
    borderWidth: 0,
  },
  dragHandleWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  formContent: {
    gap: 18,
    paddingTop: 10,
    paddingBottom: 22,
  },
  scrollAreaWrap: {
    position: 'relative',
    flexShrink: 1,
    overflow: 'hidden',
  },
  catHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addCategoryPlusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  horizontalBlurWrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.9,
  },
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '400',
    borderWidth: 0,
  },
  coverRow: {
    gap: 8,
  },
  coverTile: {
    width: 84,
    borderRadius: 14,
    padding: 5,
    alignItems: 'center',
    gap: 5,
    borderWidth: 0,
  },
  coverThumb: {
    width: 74,
    height: 48,
    borderRadius: 10,
    borderWidth: 0,
  },
  uploadCoverBox: {
    width: 74,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  coverLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  membersList: {
    gap: 8,
  },
  memberRow: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 0,
  },
  createBtn: {
    marginTop: 10,
    borderWidth: 0,
  },
});
