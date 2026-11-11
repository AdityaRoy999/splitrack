import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { MinimalisticMagnifierIcon } from '@solar-icons/react-native/bold/minimalistic-magnifier';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import {
  SOLAR_ICON_CATALOG,
  SOLAR_ICON_GROUPS,
  SolarIconGroup,
  renderSolarIcon,
} from '../../constants/solarIconsCatalog';
import { ExpenseCategory } from '../../types';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import { GlassPill } from '../glass/GlassPill';

interface AddCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (category: ExpenseCategory) => void;
}

const ACCENT_PALETTE = [
  '#6366F1',
  '#10B981',
  '#F97316',
  '#3B82F6',
  '#EC4899',
  '#8B5CF6',
  '#14B8A6',
  '#F59E0B',
];

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  visible,
  onClose,
  onCreated,
}) => {
  const { addCategory } = useSplitTrack();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<SolarIconGroup>('All');
  const [selectedIconKey, setSelectedIconKey] = useState('cup-hot');
  const [selectedColor, setSelectedColor] = useState(ACCENT_PALETTE[0]);

  const sheetBg = isDark ? '#0B0B0E' : '#F6F7FB';
  const cardBg = isDark ? '#141418' : '#FFFFFF';
  const inputBg = isDark ? '#1D1D22' : '#EFEFF4';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

  const filteredIcons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SOLAR_ICON_CATALOG.filter((entry) => {
      if (selectedGroup !== 'All' && entry.group !== selectedGroup) return false;
      if (!q) return true;
      return (
        entry.label.toLowerCase().includes(q) ||
        entry.keywords.toLowerCase().includes(q) ||
        entry.group.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedGroup]);

  const handleSave = () => {
    const cleaned = name.trim();
    if (!cleaned) {
      triggerNotification(NotificationType.Error);
      return;
    }
    const created = addCategory(cleaned, selectedIconKey, selectedColor);
    setName('');
    setSearchQuery('');
    setSelectedGroup('All');
    onCreated?.(created);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.35)' }]}>
        <View style={[styles.sheet, { backgroundColor: sheetBg }]}>
          <View style={styles.dragHandleWrap}>
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)' },
              ]}
            />
          </View>

          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: textColor }]}>New Category</Text>
              <Text style={[styles.subtitle, { color: mutedText }]}>
                Pick a symbol from {SOLAR_ICON_CATALOG.length} Solar Bold icons
              </Text>
            </View>
            <AnimatedPressable
              scaleTo={0.9}
              onPress={onClose}
              accessibilityLabel="Close category modal"
              contentStyle={[styles.closeBtn, { backgroundColor: inputBg }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </AnimatedPressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Category Preview + Name Input */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <View style={styles.previewRow}>
                <View style={[styles.previewIconBox, { backgroundColor: `${selectedColor}24` }]}>
                  {renderSolarIcon(selectedIconKey, 22, selectedColor)}
                </View>
                <TextInput
                  style={[
                    styles.nameInput,
                    { backgroundColor: inputBg, color: textColor },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null,
                  ]}
                  placeholder="Name (e.g. Drinks, Gym, Pets)"
                  placeholderTextColor={mutedText}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <Text style={[styles.fieldLabel, { color: mutedText }]}>ACCENT COLOR</Text>
              <View style={styles.colorRow}>
                {ACCENT_PALETTE.map((hex) => {
                  const active = selectedColor === hex;
                  return (
                    <AnimatedPressable
                      key={hex}
                      scaleTo={0.9}
                      onPress={() => {
                        triggerImpact(ImpactStyle.Light);
                        setSelectedColor(hex);
                      }}
                      contentStyle={[
                        styles.colorCircle,
                        {
                          backgroundColor: hex,
                          transform: [{ scale: active ? 1.15 : 1 }],
                          opacity: active ? 1 : 0.6,
                        },
                      ]}
                    >
                      <View />
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            {/* Solar Bold Icon Menu */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <View style={styles.menuHeaderRow}>
                <Text style={[styles.fieldLabel, { color: mutedText, marginBottom: 0 }]}>
                  SOLAR SYMBOL MENU
                </Text>
                <Text style={[styles.iconCountText, { color: mutedText }]}>
                  {filteredIcons.length} icons
                </Text>
              </View>

              <View style={[styles.searchBox, { backgroundColor: inputBg }]}>
                <MinimalisticMagnifierIcon size={16} color={mutedText} />
                <TextInput
                  style={[
                    styles.searchInput,
                    { color: textColor },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null,
                  ]}
                  placeholder="Search coffee, car, gym, food, wifi..."
                  placeholderTextColor={mutedText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <View style={styles.groupRadioWrap}>
                <JellyRadio
                  scrollable
                  items={[...SOLAR_ICON_GROUPS]}
                  value={selectedGroup}
                  onChange={(val) => setSelectedGroup(val as SolarIconGroup)}
                  chipColor={inputBg}
                  activeColor={isDark ? '#FFFFFF' : '#18181B'}
                  textColor={mutedText}
                  activeTextColor={isDark ? '#09090B' : '#FFFFFF'}
                  size="sm"
                  gap={8}
                  radius={999}
                />
              </View>

              <View style={styles.iconsGrid}>
                {filteredIcons.map((item) => {
                  const active = selectedIconKey === item.key;
                  return (
                    <AnimatedPressable
                      key={item.key}
                      scaleTo={0.92}
                      onPress={() => {
                        triggerImpact(ImpactStyle.Light);
                        setSelectedIconKey(item.key);
                      }}
                      contentStyle={[
                        styles.iconTile,
                        {
                          backgroundColor: active ? selectedColor : inputBg,
                        },
                      ]}
                    >
                      {renderSolarIcon(item.key, 20, active ? '#FFFFFF' : textColor)}
                      <Text
                        style={[
                          styles.iconTileLabel,
                          { color: active ? '#FFFFFF' : mutedText },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <GlassPill
            label="Create Category"
            onPress={handleSave}
            variant="accent"
            size="lg"
            style={styles.saveBtn}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 24,
    maxHeight: '88%',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  dragHandleWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  subtitle: {
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
    borderWidth: 0,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 14,
  },
  sectionCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  previewIconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '400',
    borderWidth: 0,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 0,
  },
  menuHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCountText: {
    fontSize: 11,
    fontWeight: '400',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
    borderWidth: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    borderWidth: 0,
  },
  groupRadioWrap: {
    marginBottom: 10,
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconTile: {
    width: '23%',
    minWidth: 72,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 0,
  },
  iconTileLabel: {
    fontSize: 10,
    fontWeight: '400',
  },
  saveBtn: {
    marginTop: 8,
  },
});

export default AddCategoryModal;
