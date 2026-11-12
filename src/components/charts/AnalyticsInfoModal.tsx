import React from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { CalendarDateIcon } from '@solar-icons/react-native/bold/calendar-date';
import { GraphUpIcon } from '@solar-icons/react-native/bold/graph-up';
import { PieChart2Icon } from '@solar-icons/react-native/bold/pie-chart-2';
import { CursorIcon } from '@solar-icons/react-native/bold/cursor';
import { HandIcon } from '@solar-icons/react-native/bold/hand';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GradualBlur } from '../effects/GradualBlur';

interface AnalyticsInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

interface InstructionItem {
  id: string;
  title: string;
  description: string;
  accent: string;
  renderIcon: (color: string) => React.ReactNode;
}

const INSTRUCTIONS: InstructionItem[] = [
  {
    id: 'glide-line',
    title: 'Glide Over Cash Flow Chart',
    description:
      'Hover your cursor or drag smoothly across the Cash Flow curve and bottom labels to inspect income, spending, and dates without tapping each point.',
    accent: '#F59E0B',
    renderIcon: (color) => <GraphUpIcon size={18} color={color} />,
  },
  {
    id: 'donut-glide',
    title: 'Inspect Category Slices',
    description:
      'Glide over the Category Distribution ring or legend chips to preview category percentages and totals. Tap any slice or pill to lock it.',
    accent: '#89F5A2',
    renderIcon: (color) => <PieChart2Icon size={18} color={color} />,
  },
  {
    id: 'filters-calendar',
    title: 'Date, Month & Year Filters',
    description:
      'Switch between All, Date, Month, or Year views, or tap the calendar icon to jump directly to a specific date.',
    accent: '#65D8F7',
    renderIcon: (color) => <CalendarDateIcon size={18} color={color} />,
  },
  {
    id: 'swipe-day',
    title: 'Quick Day Navigation',
    description:
      'Swipe left or right across either chart card to step backward or forward one day at a time.',
    accent: '#C482FA',
    renderIcon: (color) => <CursorIcon size={18} color={color} />,
  },
  {
    id: 'hold-month',
    title: 'Hold 2s + Swipe for Months',
    description:
      'Press and hold for 2 seconds until Month Mode highlights green, then swipe left or right to jump across months.',
    accent: '#10B981',
    renderIcon: (color) => <HandIcon size={18} color={color} />,
  },
];

export const AnalyticsInfoModal: React.FC<AnalyticsInfoModalProps> = ({
  visible,
  onClose,
}) => {
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const sheetBg = isLiquidGlassEnabled
    ? isDark
      ? '#0A0A10'
      : '#EEF2FA'
    : isDark
      ? '#0E0E12'
      : '#FFFFFF';
  const cardBg = isLiquidGlassEnabled
    ? isDark
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(255,255,255,0.72)'
    : isDark
      ? '#16161C'
      : '#F4F5F8';
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
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: isIOS
              ? sheetBg
              : isDark
                ? 'rgba(0,0,0,0.72)'
                : 'rgba(15,23,42,0.35)',
          },
        ]}
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: sheetBg },
            isIOS && {
              flex: 1,
              maxHeight: '100%',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              paddingTop: 18,
            },
          ]}
        >
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
              <Text style={[styles.title, { color: textColor }]}>Analytics Guide</Text>
              <Text style={[styles.subtitle, { color: mutedText }]}>
                Gestures, chart gliding & date controls
              </Text>
            </View>
            <AnimatedPressable
              scaleTo={0.9}
              onPress={onClose}
              accessibilityLabel="Close analytics guide"
              contentStyle={[
                styles.closeBtn,
                { backgroundColor: isDark ? '#1B1B22' : '#E5E7EB' },
              ]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </AnimatedPressable>
          </View>

          <View style={styles.scrollWrap}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {INSTRUCTIONS.map((item) => (
                <View key={item.id} style={[styles.itemCard, { backgroundColor: cardBg }]}>
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: `${item.accent}22` },
                    ]}
                  >
                    {item.renderIcon(item.accent)}
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={[styles.itemTitle, { color: textColor }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemDesc, { color: mutedText }]}>
                      {item.description}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <GradualBlur position="top" height={18} strength={1.1} layers={5} tint={sheetBg} />
            <GradualBlur position="bottom" height={22} strength={1.2} layers={6} tint={sheetBg} />
          </View>

          <AnimatedPressable
            scaleTo={0.97}
            onPress={onClose}
            contentStyle={[
              styles.doneBtn,
              { backgroundColor: isDark ? '#F4F4F5' : '#18181B' },
            ]}
          >
            <Text style={[styles.doneBtnText, { color: isDark ? '#09090B' : '#FFFFFF' }]}>
              Got It
            </Text>
          </AnimatedPressable>
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
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderWidth: 0,
  },
  dragHandleWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dragHandle: {
    width: 38,
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
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  scrollWrap: {
    position: 'relative',
    flexShrink: 1,
  },
  scrollContent: {
    gap: 10,
    paddingVertical: 6,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  itemDesc: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
  },
  doneBtn: {
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AnalyticsInfoModal;
