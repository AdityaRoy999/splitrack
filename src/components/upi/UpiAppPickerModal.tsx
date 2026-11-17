import { ModalPage } from '../common/ModalPage';
import { SheetModal } from '../common/SheetModal';
import { JellyRadio } from '../common/JellyRadio';
import { ScrollEdgeFade } from '../common/ScrollEdgeFade';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
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
  UPI_APP_CATEGORIES,
  UPI_APPS_CATALOG,
  UpiAppCategory,
  UpiAppItem,
} from '../../constants/upiAppsCatalog';
import { BrandEmblemIcon } from '../common/BrandEmblemIcon';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';

interface UpiAppPickerModalProps {
  visible: boolean;
  selectedAppId?: string;
  onClose: () => void;
  onSelectApp: (app: UpiAppItem) => void;
  onAddCustomApp?: (customName: string, customHandle: string) => void;
}

export const UpiAppPickerModal: React.FC<UpiAppPickerModalProps> = ({
  visible,
  selectedAppId,
  onClose,
  onSelectApp,
  onAddCustomApp,
}) => {
  const insets = useSafeAreaInsets();
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<UpiAppCategory | 'all'>('all');
  const [customAppName, setCustomAppName] = useState('');
  const [customAppHandle, setCustomAppHandle] = useState('@');
  const [showCustomAppForm, setShowCustomAppForm] = useState(false);

  const bgSheet = isDark ? '#000000' : '#F4F4F8';
  const cardBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)')
    : (isDark ? '#141418' : '#FFFFFF');
  const inputBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.05)')
    : (isDark ? '#1B1B22' : '#ECECF2');
  const chipBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
    : (isDark ? '#1C1C24' : '#E6E7EE');
  const activeBg = isDark ? '#FFFFFF' : '#18181B';
  const activeText = isDark ? '#09090B' : '#FFFFFF';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return UPI_APPS_CATALOG.filter((app) => {
      const matchCat = activeCategory === 'all' || app.category === activeCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        app.company.toLowerCase().includes(q) ||
        app.defaultHandle.toLowerCase().includes(q) ||
        app.supportedHandles.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, activeCategory]);

  const handleSelect = (app: UpiAppItem) => {
    triggerImpact(ImpactStyle.Light);
    onSelectApp(app);
    onClose();
  };

  const handleCreateCustom = () => {
    const cleanName = customAppName.trim();
    if (!cleanName) return;
    const cleanHandle = customAppHandle.trim().startsWith('@')
      ? customAppHandle.trim()
      : `@${customAppHandle.trim()}`;

    triggerImpact(ImpactStyle.Medium);
    const customItem: UpiAppItem = {
      id: `custom_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name: cleanName,
      company: cleanName,
      defaultHandle: cleanHandle,
      supportedHandles: [cleanHandle],
      category: 'fintech',
      accentColor: '#6366F1',
      secondaryColor: '#4338CA',
      logoLetter: cleanName.slice(0, 3).toUpperCase(),
    };
    if (onAddCustomApp) {
      onAddCustomApp(cleanName, cleanHandle);
    }
    onSelectApp(customItem);
    setCustomAppName('');
    setCustomAppHandle('@');
    setShowCustomAppForm(false);
    onClose();
  };

  return (
    <SheetModal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <ModalPage>
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
            <Text style={[styles.title, { color: textColor }]}>UPI Apps & Providers</Text>
            <Text style={[styles.subtitle, { color: mutedText }]}>
              {filteredApps.length} apps available
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
              placeholder="Search app or handle (e.g. Google Pay, @slc)..."
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

        <JellyRadio
          scrollable
          items={UPI_APP_CATEGORIES.map((category) => ({ value: category.id, label: category.id === 'all' ? `All (${UPI_APPS_CATALOG.length})` : category.label }))}
          value={activeCategory}
          onChange={(value) => setActiveCategory(value as UpiAppCategory | 'all')}
          chipColor={chipBg}
          activeColor={activeBg}
          textColor={textColor}
          activeTextColor={activeText}
          fadeColor={bgSheet}
          blurWidth={28}
          size="sm"
          style={styles.categoriesWrap}
        />

        {/* Borderless Apps List */}
        <ScrollEdgeFade tint={bgSheet}>
          <FlatList
          data={filteredApps}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.appsListContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: textColor }]}>
                No UPI app found matching &quot;{searchQuery}&quot;
              </Text>
              <Text style={[styles.emptySubtitle, { color: mutedText }]}>
                You can register a custom payment app below.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCustomAppName(searchQuery);
                  setShowCustomAppForm(true);
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
            const isSelected = selectedAppId === item.id || selectedAppId === item.name;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
                style={[
                  styles.appRow,
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

                <View style={styles.appTextCol}>
                  <View style={styles.appTitleRow}>
                    <Text style={[styles.appName, { color: textColor }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={[styles.handleBadge, { backgroundColor: inputBg }]}>
                      <Text style={[styles.handleBadgeText, { color: mutedText }]}>
                        {item.defaultHandle || 'Full UPI ID'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.appCompany, { color: mutedText }]} numberOfLines={1}>
                    {item.company}
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
        </ScrollEdgeFade>

        {/* Add Custom UPI App Option */}
        <View style={styles.bottomBar}>
          {showCustomAppForm ? (
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
                  placeholder="App name (e.g. My Bank Pay)..."
                  placeholderTextColor={mutedText}
                  value={customAppName}
                  onChangeText={setCustomAppName}
                />
                <TextInput
                  style={[
                    styles.customInput,
                    { backgroundColor: inputBg, color: textColor, width: 100 },
                    Platform.OS === 'web' &&
                      ({
                        outlineStyle: 'none',
                        outlineWidth: 0,
                        outlineColor: 'transparent',
                        outline: 'none',
                        boxShadow: 'none',
                      } as any),
                  ]}
                  placeholder="@handle"
                  placeholderTextColor={mutedText}
                  value={customAppHandle}
                  onChangeText={setCustomAppHandle}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.customFormActionsRow}>
                <TouchableOpacity
                  onPress={() => setShowCustomAppForm(false)}
                  style={[styles.cancelBtn, { backgroundColor: chipBg }]}
                >
                  <Text style={[styles.cancelBtnText, { color: mutedText }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateCustom}
                  style={[styles.saveCustomBtn, { backgroundColor: activeBg }]}
                >
                  <Text style={[styles.saveCustomBtnText, { color: activeText }]}>
                    Save Custom App
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowCustomAppForm(true)}
              style={styles.openCustomTrigger}
            >
              <AddCircleIcon size={16} color="#38BDF8" />
              <Text style={[styles.openCustomText, { color: '#38BDF8' }]}>
                Can&apos;t find your app? Add a custom UPI provider
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      </ModalPage>
    </SheetModal>
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
    marginHorizontal: 16,
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
  appsListContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 8,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 12,
    borderWidth: 0,
  },
  appTextCol: {
    flex: 1,
    gap: 2,
  },
  appTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  handleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  handleBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  appCompany: {
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
