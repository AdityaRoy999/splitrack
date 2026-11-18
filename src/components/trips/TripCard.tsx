import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { ArrowRightUpIcon } from '@solar-icons/react-native/bold/arrow-right-up';
import { CalendarDateIcon } from '@solar-icons/react-native/bold/calendar-date';
import { Home2Icon } from '@solar-icons/react-native/bold/home-2';
import { MapPointIcon } from '@solar-icons/react-native/bold/map-point';
import { MinusCircleIcon } from '@solar-icons/react-native/bold/minus-circle';
import { SuitcaseLinesIcon } from '@solar-icons/react-native/bold/suitcase-lines';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { renderSolarIcon } from '../../constants/solarIconsCatalog';
import { ExpenseCategory, Trip } from '../../types';
import { SpotlightCard } from '../glass/SpotlightCard';
import { useAuth } from '../../auth/AuthContext';
import { UserAvatar } from '../common/UserAvatar';
import { AnimatedPressable } from '../common/MotionPrimitives';

interface TripCardProps {
  trip: Trip;
  onPress: () => void;
  onRemove?: () => Promise<void>;
}

const CARD_EXIT = FadeOut.duration(180).reduceMotion(ReduceMotion.System);
const CARD_LAYOUT = LinearTransition.duration(220).reduceMotion(ReduceMotion.System);

const getTripCategoryIcon = (
  category: Trip['category'],
  iconKey: string | undefined,
  categories: ExpenseCategory[],
  color: string
) => {
  switch (category.toLowerCase()) {
    case 'apartment':
      return <Home2Icon size={20} color={color} />;
    case 'trip':
      return <SuitcaseLinesIcon size={20} color={color} />;
    default: {
      const catMatch = categories.find(
        (c) => c.name.toLowerCase() === category.toLowerCase()
      );
      if (catMatch) {
        return renderSolarIcon(catMatch.iconKey, 20, color);
      }
      if (iconKey && iconKey !== 'Palmtree' && iconKey !== 'Home' && iconKey !== 'Users') {
        return renderSolarIcon(iconKey, 20, color);
      }
      return <MapPointIcon size={20} color={color} />;
    }
  }
};

/**
 * React-Bits inspired Spotlight Trip Card:
 * Quiet inner spotlight surface with date, title, and member summary,
 * paired with a tracked footer displaying category, total spend, and arrow.
 */
export const TripCard: React.FC<TripCardProps> = ({ trip, onPress, onRemove }) => {
  const { friends, categories } = useSplitTrack();
  const { profile } = useAuth();
  const [removing, setRemoving] = useState(false);
  const pending = useRef(false);
  const { formatAmount, themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const tripMembers = trip.members.map(id => id === 'user'
    ? { id, name: profile?.displayName ?? 'You', avatar: profile?.avatar ?? '' }
    : friends.find(friend => friend.id === id) ?? { id, name: 'Member', avatar: '' });
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const subtleIconBg = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)';
  const remove = async () => {
    if (!onRemove || pending.current) return;
    pending.current = true;
    setRemoving(true);
    try { await onRemove(); }
    catch { pending.current = false; setRemoving(false); }
  };

  const footerContent = (
    <View style={styles.footerRow}>
      <View style={styles.footerLeft}>
        <Text style={[styles.footerEyebrow, { color: mutedText }]}>
          {trip.category.toUpperCase()} • TOTAL SPENT
        </Text>
        <Text style={[styles.footerSpend, { color: textColor }]}>
          {formatAmount(trip.totalSpend)}
        </Text>
      </View>

      <ArrowRightUpIcon size={18} color={mutedText} />
    </View>
  );

  return (
    <Animated.View style={styles.cardWrap} exiting={CARD_EXIT} layout={CARD_LAYOUT}>
      <SpotlightCard
        onPress={onRemove ? undefined : onPress}
        coverImageUri={trip.coverImage}
        highlightableCover={Boolean(trip.coverImage)}
        panelStyle={styles.innerShowcasePanel}
        footer={footerContent}
        borderRadius={24}
      >
        <View style={styles.panelTopRow}>
          <View style={[styles.iconChip, { backgroundColor: subtleIconBg }]}>
            {getTripCategoryIcon(trip.category, trip.icon, categories, textColor)}
          </View>

          <View style={styles.dateBadge}>
            <CalendarDateIcon size={13} color={mutedText} />
            <Text style={[styles.dateText, { color: mutedText }]}>{trip.startDate}</Text>
          </View>
        </View>

        <Text style={[styles.tripTitle, { color: textColor }]} numberOfLines={1}>
          {trip.name}
        </Text>

        <View style={styles.membersRow}>
          <View style={styles.avatarStack}>
            {tripMembers.slice(0, 3).map((f, i) => (
              <UserAvatar
                key={f.id}
                avatarUri={f.avatar} name={f.name} size={22} borderRadius={11} isDark={isDark}
                style={[
                  styles.avatar,
                  {
                    marginLeft: i > 0 ? -7 : 0,
                    zIndex: 10 - i,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.membersSubtitle, { color: mutedText }]} numberOfLines={1}>
            {trip.members.length} members • Shared group splits
          </Text>
        </View>
      </SpotlightCard>
      {onRemove ? <AnimatedPressable
        onPress={remove} disabled={removing} accessibilityLabel={`Remove ${trip.name}`}
        accessibilityState={{ busy: removing, disabled: removing }}
        style={styles.removeAnchor}
        contentStyle={[styles.removeBadge, { backgroundColor: isDark ? '#3F3F46' : '#E4E4E7' }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {removing ? <ActivityIndicator size="small" color={textColor} /> : <MinusCircleIcon size={22} color={textColor} />}
      </AnimatedPressable> : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrap: {
    marginBottom: 12,
    width: '100%',
  },
  removeAnchor: { position: 'absolute', top: 6, right: 6, zIndex: 20 },
  removeBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  innerShowcasePanel: {
    minHeight: 152,
    justifyContent: 'space-between',
  },
  panelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '400',
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 0,
  },
  membersSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    flex: 1,
  },
  footerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    gap: 2,
  },
  footerEyebrow: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.0,
  },
  footerSpend: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
});
