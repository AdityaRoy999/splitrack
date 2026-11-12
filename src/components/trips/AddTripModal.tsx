import React, { useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { NotificationType, triggerNotification } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassPill } from '../glass/GlassPill';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';

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
  const { friends, addTrip } = useSplitTrack();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [tripName, setTripName] = useState('');
  const [category, setCategory] = useState<'trip' | 'apartment' | 'party' | 'weekend'>('trip');
  const [selectedGradient] = useState<[string, string]>(GRADIENT_OPTIONS[0]);
  const [selectedCover, setSelectedCover] = useState<string>(COVER_PHOTO_PRESETS[0].uri);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['user']);

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

    addTrip({
      name: tripName.trim(),
      category,
      icon: category === 'trip' ? 'Palmtree' : category === 'apartment' ? 'Home' : 'Users',
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

  const isIOS = Platform.OS === 'ios';

  return (
    <Modal
      visible={visible}
      transparent={!isIOS}
      presentationStyle={isIOS ? 'pageSheet' : undefined}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, isIOS && { backgroundColor: bgSheet }]}>
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: bgSheet },
            isIOS && {
              flex: 1,
              maxHeight: '100%',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              paddingTop: 22,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: textColor }]}>Create New Trip or Group</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1C20' : '#F3F4F6' }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </TouchableOpacity>
          </View>

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

            {/* Category Selector with rounded JellyRadio */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: mutedText }]}>CATEGORY</Text>
              <JellyRadio
                items={TRIP_CATEGORIES}
                value={category}
                onChange={(val) =>
                  setCategory(val as 'trip' | 'apartment' | 'party' | 'weekend')
                }
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.coverRow}
              >
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

          <GlassPill
            label="Create Trip"
            variant="accent"
            size="lg"
            onPress={handleCreate}
            style={styles.createBtn}
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '85%',
    borderWidth: 0,
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
    paddingBottom: 16,
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
