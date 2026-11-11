import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Aurora } from '../effects/Aurora';
import { triggerImpact, triggerNotification, ImpactStyle, NotificationType } from '../../utils/haptics';
import { CopyIcon } from '@solar-icons/react-native/bold/copy';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { QrCodeIcon } from '@solar-icons/react-native/bold/qr-code';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { UpiAccount } from '../../types';
import { AnimatedPressable } from '../common/MotionPrimitives';

const CARD_HEIGHT = 180;

export const StackedCardDeck: React.FC<{
  onSelectAccount?: (acc: UpiAccount) => void;
  onOpenQr?: (acc: UpiAccount) => void;
}> = ({ onSelectAccount, onOpenQr }) => {
  const { accounts, selectedAccountId, setSelectedAccountId } = useSplitTrack();
  const { formatAmount, themeMode } = useLiquidGlass();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<string | null>(null);

  const [expandAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, expandAnim]);

  const isDark = themeMode === 'dark';

  const toggleExpand = () => {
    triggerImpact(ImpactStyle.Medium);
    setIsExpanded(!isExpanded);
  };

  const handleSelect = (account: UpiAccount) => {
    triggerImpact(ImpactStyle.Light);
    setSelectedAccountId(account.id);
    if (onSelectAccount) onSelectAccount(account);
  };

  const copyUpi = (upi: string) => {
    triggerNotification(NotificationType.Success);
    setCopiedUpi(upi);
    setTimeout(() => setCopiedUpi(null), 2000);
  };

  const cardAuroraStops: [string, string, string][] = [
    ['#5227FF', '#7cff67', '#5227FF'],
    ['#0EA5E9', '#38BDF8', '#22C55E'],
    ['#7C3AED', '#EC4899', '#6366F1'],
  ];

  const containerHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_HEIGHT + 70, accounts.length * 155 + 40],
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            Cards & Wallets
          </Text>
          <Text style={[styles.sectionSubtitle, { color: isDark ? '#71717A' : '#8E8E93' }]}>
            {isExpanded ? 'Tap a card to select active account' : 'Tap deck to fan out cards'}
          </Text>
        </View>
        <AnimatedPressable
          onPress={toggleExpand}
          scaleTo={0.94}
          contentStyle={[
            styles.expandTogglePill,
            { backgroundColor: isDark ? '#18181D' : '#FFFFFF' },
          ]}
        >
          <Text style={[styles.expandToggleText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            {isExpanded ? 'Stack Cards' : 'Expand Deck'}
          </Text>
        </AnimatedPressable>
      </View>

      <Animated.View style={[styles.deckContainer, { height: containerHeight }]}>
        {accounts.map((acc, index) => {
          const isSelected = acc.id === selectedAccountId;
          const offsetTop = expandAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [index * 26, index * 150],
          });
          const scale = expandAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1 - index * 0.04, 1],
          });
          const zIndex = accounts.length - index;
          const auroraStops = cardAuroraStops[index % cardAuroraStops.length];

          return (
            <Animated.View
              key={acc.id}
              style={[
                styles.cardWrapper,
                {
                  top: offsetTop,
                  zIndex: isSelected ? 99 : zIndex,
                  transform: [{ scale }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  if (!isExpanded) {
                    toggleExpand();
                  } else {
                    handleSelect(acc);
                  }
                }}
                style={{ flex: 1 }}
              >
                <View
                  style={[
                    styles.cardGradient,
                    { backgroundColor: '#111114', overflow: 'hidden' },
                  ]}
                >
                  <Aurora
                    colorStops={auroraStops}
                    amplitude={1}
                    blend={0.55}
                    height={0.65}
                    speed={0.9}
                    glow={0.6}
                    layers={2}
                    direction="bottom"
                    opacity={0.7}
                    lightMode={false}
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: '#111114', borderRadius: 24 },
                    ]}
                  />
                  {/* Top Row: Cardholder & VISA */}
                  <View style={styles.cardTopRow}>
                    <View>
                      <Text style={styles.cardHolderName}>{acc.cardHolder}</Text>
                      <View style={styles.upiHandleRow}>
                        <Text style={styles.upiHandleText}>{acc.upiId}</Text>
                        <TouchableOpacity
                          onPress={() => copyUpi(acc.upiId)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {copiedUpi === acc.upiId ? (
                            <CheckCircleIcon size={13} color="#10B981" />
                          ) : (
                            <CopyIcon size={12} color="rgba(255,255,255,0.6)" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.brandBadge}>
                      <Text style={styles.cardType}>{acc.cardType}</Text>
                    </View>
                  </View>

                  {/* Middle: Emulated Chip */}
                  <View style={styles.chipRow}>
                    <View style={styles.emvChip}>
                      <View style={styles.chipLine1} />
                      <View style={styles.chipLine2} />
                    </View>
                    {isSelected && (
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>Active</Text>
                      </View>
                    )}
                  </View>

                  {/* Card Number Embossed Text */}
                  <View style={styles.cardNumberContainer}>
                    <Text style={styles.cardNumberText} numberOfLines={1}>
                      {acc.cardNumber}
                    </Text>
                  </View>

                  {/* Bottom Row: Expiry, Balance, QR */}
                  <View style={styles.cardBottomRow}>
                    <View>
                      <Text style={styles.expiryLabel}>EXPIRES</Text>
                      <Text style={styles.expiryValue}>{acc.expiry}</Text>
                    </View>
                    <View style={styles.balanceContainer}>
                      <Text style={styles.balanceLabel}>AVAILABLE</Text>
                      <Text style={styles.balanceValue}>{formatAmount(acc.balance)}</Text>
                    </View>
                    {onOpenQr && (
                      <TouchableOpacity
                        onPress={() => onOpenQr(acc)}
                        style={styles.qrIconBtn}
                      >
                        <QrCodeIcon size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  expandTogglePill: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 0,
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deckContainer: {
    height: CARD_HEIGHT + 70,
    position: 'relative',
  },
  cardWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardGradient: {
    height: CARD_HEIGHT,
    borderRadius: 24,
    padding: 18,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 0, // completely borderless
    shadowOpacity: 0,
    elevation: 0,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHolderName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  upiHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  upiHandleText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  brandBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 0,
  },
  cardType: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontStyle: 'italic',
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emvChip: {
    width: 32,
    height: 24,
    backgroundColor: '#D4AF37',
    borderRadius: 5,
    padding: 3,
    justifyContent: 'center',
    borderWidth: 0,
  },
  chipLine1: {
    height: 1,
    backgroundColor: '#8B6A1A',
    marginVertical: 2,
  },
  chipLine2: {
    height: 1,
    backgroundColor: '#8B6A1A',
  },
  activeTag: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  activeTagText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  cardNumberContainer: {
    marginVertical: 4,
  },
  cardNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1.6,
    fontFamily: 'Courier',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  expiryLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 8,
    fontWeight: '700',
  },
  expiryValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  balanceContainer: {
    alignItems: 'center',
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 8,
    fontWeight: '700',
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  qrIconBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    padding: 6,
    borderRadius: 10,
    borderWidth: 0,
  },
});
