import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AltArrowLeftIcon } from '@solar-icons/react-native/bold/alt-arrow-left';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { MagnifierIcon } from '@solar-icons/react-native/bold/magnifier';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import {
  BANK_CATEGORIES,
  BankCategory,
  BankItem,
  BANKS_CATALOG,
} from '../../constants/banksCatalog';
import { BrandEmblemIcon } from '../common/BrandEmblemIcon';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';

interface BankIssuerPickerModalProps {
  visible: boolean;
  selectedBankId?: string;
  onClose: () => void;
  onSelectBank: (bank: BankItem) => void;
  onAddCustomBank?: (customName: string) => void;
}

export const BankIssuerPickerModal: React.FC<BankIssuerPickerModalProps> = ({
  visible,
  selectedBankId,
  onClose,
  onSelectBank,
  onAddCustomBank,
}) => {
  const insets = useSafeAreaInsets();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<BankCategory | 'all'>('all');
  const [customBankInput, setCustomBankInput] = useState('');
  const [showCustomBankForm, setShowCustomBankForm] = useState(false);

  const bgSheet = isDark ? '#09090B' : '#F4F4F8';
  const cardBg = isDark ? '#141418' : '#FFFFFF';
  const inputBg = isDark ? '#1B1B22' : '#ECECF2';
  const chipBg = isDark ? '#1C1C24' : '#E6E7EE';
  const activeBg = isDark ? '#FFFFFF' : '#18181B';
  const activeText = isDark ? '#09090B' : '#FFFFFF';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

  const filteredBanks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return BANKS_CATALOG.filter((bank) => {
      const matchCat = activeCategory === 'all' || bank.category === activeCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        bank.name.toLowerCase().includes(q) ||
        bank.shortName.toLowerCase().includes(q) ||
        bank.logoLetter.toLowerCase().includes(q) ||
        (bank.tagline && bank.tagline.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, activeCategory]);

  const handleSelect = (bank: BankItem) => {
    triggerImpact(ImpactStyle.Light);
    onSelectBank(bank);
    onClose();
  };

  const handleCreateCustom = () => {
    const clean = customBankInput.trim();
    if (!clean) return;
    triggerImpact(ImpactStyle.Medium);
    const customItem: BankItem = {
      id: `custom_${clean.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name: clean,
      shortName: clean.split(' ')[0] || clean,
      category: 'private',
      accentColor: '#4F46E5',
      secondaryColor: '#312E81',
      logoLetter: clean.slice(0, 3).toUpperCase(),
    };
    if (onAddCustomBank) {
      onAddCustomBank(clean);
    }
    onSelectBank(customItem);
    setCustomBankInput('');
    setShowCustomBankForm(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.pageContainer,
          {
            backgroundColor: bgSheet,
            paddingTop: Math.max(16, insets.top),
            paddingBottom: Math.max(16, insets.bottom),
          },
        ]}
      >
        {/* Full Page Navigation Header */}
        <View style={styles.navBar}>
          <AnimatedPressable
            scaleTo={0.92}
            onPress={onClose}
            accessibilityLabel="Back to profile form"
            contentStyle={[styles.backBtn, { backgroundColor: cardBg }]}
          >
            <AltArrowLeftIcon size={18} color={textColor} />
            <Text style={[styles.backBtnText, { color: textColor }]}>Back</Text>
          </AnimatedPressable>

          <View style={styles.titleCol}>
            <Text style={[styles.title, { color: textColor }]}>Bank Issuers</Text>
            <Text style={[styles.subtitle, { color: mutedText }]}>
              {filteredBanks.length} banks available
            </Text>
          </View>

          <View style={styles.headerRightSpacer} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={[styles.searchBox, { backgroundColor: inputBg }]}>
            <MagnifierIcon size={16} color={mutedText} />
            <TextInput
              style={[
                styles.searchInput,
                { color: textColor },
                Platform.OS === 'web' &&
                  ({
                    outlineStyle: 'none',
                    outlineWidth: 0,
                    outlineColor: 'transparent',
                    outline: 'none',
                    boxShadow: 'none',
                  } as any),
              ]}
              placeholder="Search bank name or code (e.g. SBI, HDFC, Axis)..."
              placeholderTextColor={mutedText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <CloseCircleIcon size={16} color={mutedText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Horizontal Filter Chips */}
        <View style={styles.categoriesWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={BANK_CATEGORIES}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.categoryChipsList}
            renderItem={({ item }) => {
              const isSelected = activeCategory === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    triggerImpact(ImpactStyle.Light);
                    setActiveCategory(item.id);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: isSelected ? activeBg : chipBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: isSelected ? activeText : textColor },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Borderless Banks List */}
        <FlatList
          data={filteredBanks}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.banksListContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: textColor }]}>
                No bank found matching &quot;{searchQuery}&quot;
              </Text>
              <Text style={[styles.emptySubtitle, { color: mutedText }]}>
                You can add a custom bank issuer below.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCustomBankInput(searchQuery);
                  setShowCustomBankForm(true);
                }}
                style={[styles.addCustomBtn, { backgroundColor: activeBg }]}
              >
                <AddCircleIcon size={16} color={activeText} />
                <Text style={[styles.addCustomText, { color: activeText }]}>
                  Add &quot;{searchQuery}&quot;
                </Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedBankId === item.id || selectedBankId === item.shortName;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
                style={[
                  styles.bankRow,
                  {
                    backgroundColor: cardBg,
                    borderWidth: 0,
                  },
                ]}
              >
                <BrandEmblemIcon
                  id={item.id}
                  name={item.name}
                  logoLetter={item.logoLetter}
                  accentColor={item.accentColor}
                  secondaryColor={item.secondaryColor}
                  size={38}
                  borderRadius={10}
                />

                <View style={styles.bankTextCol}>
                  <View style={styles.bankTitleRow}>
                    <Text style={[styles.bankName, { color: textColor }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={[styles.shortNameBadge, { backgroundColor: inputBg }]}>
                      <Text style={[styles.shortNameBadgeText, { color: mutedText }]}>
                        {item.shortName}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.bankTagline, { color: mutedText }]} numberOfLines={1}>
                    {item.tagline || `${item.category.toUpperCase()} BANK`}
                  </Text>
                </View>

                {isSelected && (
                  <View style={styles.checkSlot}>
                    <CheckCircleIcon size={20} color="#10B981" />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />

        {/* Add Custom Bank Option */}
        <View style={styles.bottomBar}>
          {showCustomBankForm ? (
            <View style={styles.customFormCol}>
              <View style={styles.customFormInputsRow}>
                <TextInput
                  style={[
                    styles.customInput,
                    { backgroundColor: inputBg, color: textColor, flex: 1 },
                    Platform.OS === 'web' &&
                      ({
                        outlineStyle: 'none',
                        outlineWidth: 0,
                        outlineColor: 'transparent',
                        outline: 'none',
                        boxShadow: 'none',
                      } as any),
                  ]}
                  placeholder="Bank name (e.g. DBS Bank)..."
                  placeholderTextColor={mutedText}
                  value={customBankInput}
                  onChangeText={setCustomBankInput}
                />
              </View>
              <View style={styles.customFormActionsRow}>
                <TouchableOpacity
                  onPress={() => setShowCustomBankForm(false)}
                  style={[styles.cancelBtn, { backgroundColor: chipBg }]}
                >
                  <Text style={[styles.cancelBtnText, { color: mutedText }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateCustom}
                  style={[styles.saveCustomBtn, { backgroundColor: activeBg }]}
                >
                  <Text style={[styles.saveCustomBtnText, { color: activeText }]}>
                    Save Bank
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowCustomBankForm(true)}
              style={styles.openCustomTrigger}
            >
              <AddCircleIcon size={16} color="#38BDF8" />
              <Text style={[styles.openCustomText, { color: '#38BDF8' }]}>
                Can&apos;t find your bank? Add custom bank issuer
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 0,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  titleCol: {
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  headerRightSpacer: {
    width: 65,
  },
  searchSection: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 14,
    gap: 10,
    borderWidth: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    paddingVertical: 0,
    borderWidth: 0,
  },
  categoriesWrap: {
    marginBottom: 8,
  },
  categoryChipsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 0,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  banksListContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 8,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 12,
    borderWidth: 0,
  },
  bankTextCol: {
    flex: 1,
    gap: 2,
  },
  bankTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  shortNameBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shortNameBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  bankTagline: {
    fontSize: 12,
    fontWeight: '400',
  },
  checkSlot: {
    marginLeft: 6,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addCustomText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  openCustomTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  openCustomText: {
    fontSize: 13,
    fontWeight: '500',
  },
  customFormCol: {
    gap: 10,
  },
  customFormInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customInput: {
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    borderWidth: 0,
  },
  customFormActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  saveCustomBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  saveCustomBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
