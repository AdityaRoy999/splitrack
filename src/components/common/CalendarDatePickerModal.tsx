import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { AltArrowLeftIcon } from '@solar-icons/react-native/bold/alt-arrow-left';
import { AltArrowRightIcon } from '@solar-icons/react-native/bold/alt-arrow-right';
import { AltArrowDownIcon } from '@solar-icons/react-native/bold/alt-arrow-down';
import { AltArrowUpIcon } from '@solar-icons/react-native/bold/alt-arrow-up';
import { CalendarDateIcon } from '@solar-icons/react-native/bold/calendar-date';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { triggerSelection } from '../../utils/haptics';
import { AnimatedPressable } from './MotionPrimitives';
import { JellyRadio } from './JellyRadio';
import { AppleGraphicalCalendar } from './AppleNativeControls';

interface CalendarDatePickerModalProps {
  visible: boolean;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onClose: () => void;
  markedDates?: string[];
  allowClear?: boolean;
  title?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const getTodayLocalISO = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatDisplayDate = (isoDate: string, includeYear = false): string => {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const [year, month, day] = parts;
  const monthLabel = SHORT_MONTHS[month - 1] || 'Jan';
  if (includeYear) {
    return `${monthLabel} ${day}, ${year}`;
  }
  return `${monthLabel} ${day}`;
};

const parseYearMonth = (isoDate: string | null): { year: number; month: number } => {
  if (isoDate) {
    const [y, m] = isoDate.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
      return { year: y, month: m - 1 };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
};

const toISODate = (year: number, monthIndex: number, day: number): string => {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

export const CalendarDatePickerModal: React.FC<CalendarDatePickerModalProps> = (props) => {
  const { visible, selectedDate, onClose } = props;
  const { isLiquidGlassEnabled } = useLiquidGlass();
  if (!visible) return null;

  const useNativeAppleCalendar = Platform.OS === 'ios' && isLiquidGlassEnabled;

  return (
    <Modal
      visible={visible}
      transparent={!useNativeAppleCalendar}
      presentationStyle={useNativeAppleCalendar ? 'pageSheet' : undefined}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <CalendarDialogBody key={selectedDate || 'today'} {...props} />
    </Modal>
  );
};

const CalendarDialogBody: React.FC<CalendarDatePickerModalProps> = ({
  selectedDate,
  onSelectDate,
  onClose,
  markedDates = [],
  allowClear = true,
  title = 'Select Date',
}) => {
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const useNativeAppleCalendar = Platform.OS === 'ios' && isLiquidGlassEnabled;

  const initialYM = parseYearMonth(selectedDate || getTodayLocalISO());
  const [viewYear, setViewYear] = useState<number>(initialYM.year);
  const [viewMonth, setViewMonth] = useState<number>(initialYM.month);
  const [pickerMode, setPickerMode] = useState<'days' | 'months' | 'years'>('days');
  const [yearRangeStart, setYearRangeStart] = useState<number>(initialYM.year - 5);
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    };
  }, []);

  const scheduleReturnToDays = () => {
    if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    returnTimerRef.current = setTimeout(() => {
      setPickerMode('days');
    }, 260);
  };

  const cardBg = isDark ? '#111114' : '#FFFFFF';
  const surfaceBg = isDark ? '#1B1B20' : '#F2F3F7';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';

  const todayISO = getTodayLocalISO();
  const markedSet = new Set(markedDates);

  // Compute days grid starting Monday
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const jsWeekday = firstDayOfMonth.getDay(); // 0=Sun..6=Sat
  const leadingEmpty = (jsWeekday + 6) % 7; // Convert so 0=Mon..6=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: ({ day: number; iso: string } | null)[] = [];
  for (let i = 0; i < leadingEmpty; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      day,
      iso: toISODate(viewYear, viewMonth, day),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const handlePrevNav = () => {
    triggerSelection();
    if (pickerMode === 'years') {
      setYearRangeStart((start) => start - 12);
      return;
    }
    if (pickerMode === 'months') {
      setViewYear((y) => y - 1);
      return;
    }
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextNav = () => {
    triggerSelection();
    if (pickerMode === 'years') {
      setYearRangeStart((start) => start + 12);
      return;
    }
    if (pickerMode === 'months') {
      setViewYear((y) => y + 1);
      return;
    }
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const toggleMonthMenu = () => {
    triggerSelection();
    setPickerMode((prev) => (prev === 'months' ? 'days' : 'months'));
  };

  const toggleYearMenu = () => {
    triggerSelection();
    setYearRangeStart(viewYear - 5);
    setPickerMode((prev) => (prev === 'years' ? 'days' : 'years'));
  };

  const yearsGrid = Array.from({ length: 12 }, (_, idx) => yearRangeStart + idx);

  const handlePickDay = (iso: string) => {
    triggerSelection();
    onSelectDate(iso);
    onClose();
  };

  const handleToday = () => {
    triggerSelection();
    const today = getTodayLocalISO();
    onSelectDate(today);
    onClose();
  };

  const handleClear = () => {
    triggerSelection();
    onSelectDate(null);
    onClose();
  };

  if (useNativeAppleCalendar) {
    const sheetBg = isDark ? '#09090B' : '#F2F2F7';
    return (
      <View style={[styles.overlay, { backgroundColor: sheetBg, justifyContent: 'flex-start', paddingTop: 22 }]}>
        <View style={[styles.card, { backgroundColor: cardBg, maxWidth: 460 }]}>
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <View style={[styles.iconBadge, { backgroundColor: surfaceBg }]}>
                <CalendarDateIcon size={18} color={textColor} />
              </View>
              <View>
                <Text style={[styles.titleText, { color: textColor }]}>{title}</Text>
                <Text style={[styles.subtitleText, { color: mutedText }]}>
                  {selectedDate ? formatDisplayDate(selectedDate, true) : 'Showing all recorded dates'}
                </Text>
              </View>
            </View>
            <AnimatedPressable
              onPress={onClose}
              scaleTo={0.9}
              accessibilityLabel="Close calendar modal"
              contentStyle={[styles.closeBtn, { backgroundColor: surfaceBg }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </AnimatedPressable>
          </View>

          <View style={[styles.hairline, { backgroundColor: dividerColor }]} />

          <AppleGraphicalCalendar
            title={title}
            selectedDate={selectedDate}
            onSelectDate={(iso) => {
              triggerSelection();
              onSelectDate(iso);
              onClose();
            }}
            onToday={handleToday}
            onClear={allowClear ? handleClear : undefined}
            allowClear={allowClear}
            isDark={isDark}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { backgroundColor: cardBg }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <View style={[styles.iconBadge, { backgroundColor: surfaceBg }]}>
                <CalendarDateIcon size={18} color={textColor} />
              </View>
              <View>
                <Text style={[styles.titleText, { color: textColor }]}>{title}</Text>
                <Text style={[styles.subtitleText, { color: mutedText }]}>
                  {selectedDate ? formatDisplayDate(selectedDate, true) : 'Showing all recorded dates'}
                </Text>
              </View>
            </View>
            <AnimatedPressable
              onPress={onClose}
              scaleTo={0.9}
              accessibilityLabel="Close calendar modal"
              contentStyle={[styles.closeBtn, { backgroundColor: surfaceBg }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </AnimatedPressable>
          </View>

          <View style={[styles.hairline, { backgroundColor: dividerColor }]} />

          {/* Month & Year Switcher with clickable Month & Year picker menus */}
          <View style={styles.monthBar}>
            <AnimatedPressable
              onPress={handlePrevNav}
              scaleTo={0.9}
              accessibilityLabel="Previous period"
              contentStyle={[styles.navBtn, { backgroundColor: surfaceBg }]}
            >
              <AltArrowLeftIcon size={16} color={textColor} />
            </AnimatedPressable>

            <View style={styles.periodSelectorsRow}>
              <AnimatedPressable
                onPress={toggleMonthMenu}
                scaleTo={0.94}
                accessibilityLabel="Open month picker"
                contentStyle={[
                  styles.periodChip,
                  { backgroundColor: pickerMode === 'months' ? activeBg : surfaceBg },
                ]}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    { color: pickerMode === 'months' ? activeText : textColor },
                  ]}
                >
                  {MONTH_NAMES[viewMonth]}
                </Text>
                {pickerMode === 'months' ? (
                  <AltArrowUpIcon size={13} color={activeText} />
                ) : (
                  <AltArrowDownIcon size={13} color={mutedText} />
                )}
              </AnimatedPressable>

              <AnimatedPressable
                onPress={toggleYearMenu}
                scaleTo={0.94}
                accessibilityLabel="Open year picker"
                contentStyle={[
                  styles.periodChip,
                  { backgroundColor: pickerMode === 'years' ? activeBg : surfaceBg },
                ]}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    { color: pickerMode === 'years' ? activeText : textColor },
                  ]}
                >
                  {viewYear}
                </Text>
                {pickerMode === 'years' ? (
                  <AltArrowUpIcon size={13} color={activeText} />
                ) : (
                  <AltArrowDownIcon size={13} color={mutedText} />
                )}
              </AnimatedPressable>
            </View>

            <AnimatedPressable
              onPress={handleNextNav}
              scaleTo={0.9}
              accessibilityLabel="Next period"
              contentStyle={[styles.navBtn, { backgroundColor: surfaceBg }]}
            >
              <AltArrowRightIcon size={16} color={textColor} />
            </AnimatedPressable>
          </View>

          {pickerMode === 'months' && (
            <JellyRadio
              items={MONTH_NAMES.map((monthName, idx) => ({
                value: String(idx),
                label: SHORT_MONTHS[idx],
                accessibilityLabel: `Select month ${monthName}`,
              }))}
              value={String(viewMonth)}
              onChange={(val) => {
                setViewMonth(Number(val));
                scheduleReturnToDays();
              }}
              columns={3}
              size="lg"
              gap={8}
              radius={999}
              chipColor={surfaceBg}
              activeColor={activeBg}
              textColor={textColor}
              activeTextColor={activeText}
              style={styles.pickerGrid}
            />
          )}

          {pickerMode === 'years' && (
            <JellyRadio
              items={yearsGrid.map((yearVal) => ({
                value: String(yearVal),
                label: String(yearVal),
                accessibilityLabel: `Select year ${yearVal}`,
              }))}
              value={String(viewYear)}
              onChange={(val) => {
                setViewYear(Number(val));
                scheduleReturnToDays();
              }}
              columns={3}
              size="lg"
              gap={8}
              radius={999}
              chipColor={surfaceBg}
              activeColor={activeBg}
              textColor={textColor}
              activeTextColor={activeText}
              style={styles.pickerGrid}
            />
          )}

          {pickerMode === 'days' && (
            <>
              {/* Weekday Headers */}
              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((wd) => (
                  <Text key={wd} style={[styles.weekdayText, { color: mutedText }]}>
                    {wd}
                  </Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.grid}>
                {weeks.map((week, wIdx) => (
                  <View key={wIdx} style={styles.weekRow}>
                    {week.map((cell, cIdx) => {
                      if (!cell) {
                        return <View key={`empty-${wIdx}-${cIdx}`} style={styles.dayCellSpacer} />;
                      }

                      const isSelected = selectedDate === cell.iso;
                      const isToday = todayISO === cell.iso;
                      const hasEntry = markedSet.has(cell.iso);

                      return (
                        <AnimatedPressable
                          key={cell.iso}
                          scaleTo={0.9}
                          onPress={() => handlePickDay(cell.iso)}
                          accessibilityLabel={`Select ${cell.iso}`}
                          style={styles.dayCellOuter}
                          contentStyle={[
                            styles.dayCellPill,
                            {
                              backgroundColor: isSelected
                                ? activeBg
                                : isToday
                                  ? surfaceBg
                                  : 'transparent',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              {
                                color: isSelected
                                  ? activeText
                                  : isToday
                                    ? textColor
                                    : isDark
                                      ? '#D4D4D8'
                                      : '#27272A',
                              },
                            ]}
                          >
                            {cell.day}
                          </Text>
                          <View
                            style={[
                              styles.entryDot,
                              {
                                backgroundColor: hasEntry
                                  ? isSelected
                                    ? activeText
                                    : '#10B981'
                                  : 'transparent',
                              },
                            ]}
                          />
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={[styles.hairline, { backgroundColor: dividerColor }]} />

          {/* Quick Actions Footer */}
          <View style={styles.footerRow}>
            <AnimatedPressable
              scaleTo={0.94}
              onPress={handleToday}
              contentStyle={[styles.footerPill, { backgroundColor: surfaceBg }]}
            >
              <Text style={[styles.footerPillText, { color: textColor }]}>Today</Text>
            </AnimatedPressable>

            {allowClear && (
              <AnimatedPressable
                scaleTo={0.94}
                onPress={handleClear}
                contentStyle={[styles.footerPill, { backgroundColor: activeBg }]}
              >
                <Text style={[styles.footerPillText, { color: activeText }]}>All Dates</Text>
              </AnimatedPressable>
            )}
          </View>
        </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 26,
    padding: 18,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  hairline: {
    height: 1,
    width: '100%',
    marginBottom: 14,
  },
  monthBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  periodSelectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  periodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 0,
  },
  periodChipText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  pickerGrid: {
    marginBottom: 14,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '400',
  },
  grid: {
    gap: 4,
    marginBottom: 14,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 2,
  },
  dayCellSpacer: {
    flex: 1,
    height: 42,
  },
  dayCellOuter: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '400',
  },
  entryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  footerPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 0,
  },
  footerPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
