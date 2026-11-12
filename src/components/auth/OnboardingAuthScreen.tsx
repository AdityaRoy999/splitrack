import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ArrowRight, ChevronRight, Eye, EyeOff, Lock, Mail, Moon, Sun, User } from 'lucide-react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { measureNodeInWindow, type ViewRefNode, type WindowRect } from '../../utils/measureWindow';
import { AnimatedPressable } from '../common/MotionPrimitives';

export type AuthLogoRect = WindowRect;

interface OnboardingAuthScreenProps {
  hideLogo?: boolean;
  onLogoLayout?: (rect: AuthLogoRect) => void;
  onLogoNode?: (node: ViewRefNode | null) => void;
  onAuthenticate: (payload: {
    provider: 'email' | 'google' | 'guest';
    mode: 'signin' | 'signup';
    name?: string;
    email?: string;
  }) => void;
}

const AUTH_LOGO_SIZE = 68;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const GoogleLogoMark: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <Path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <Path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <Path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </Svg>
);

export const OnboardingAuthScreen: React.FC<OnboardingAuthScreenProps> = ({
  hideLogo = false,
  onLogoLayout,
  onLogoNode,
  onAuthenticate,
}) => {
  const insets = useSafeAreaInsets();
  const { themeMode, toggleTheme } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);
  const [formFadeAnim] = useState(() => new Animated.Value(1));

  const logoAnchorRef = useRef<ViewRefNode>(null);

  const setLogoRef = useCallback(
    (node: ViewRefNode | null) => {
      logoAnchorRef.current = node;
      onLogoNode?.(node);
    },
    [onLogoNode]
  );

  const reportLogoLayout = useCallback(() => {
    if (!onLogoLayout) return;
    requestAnimationFrame(() => {
      measureNodeInWindow(logoAnchorRef.current, onLogoLayout);
    });
  }, [onLogoLayout]);

  const isSignUp = authMode === 'signup';

  const handleToggleAuthMode = () => {
    triggerImpact(ImpactStyle.Light);
    setAuthMode((prev) => (prev === 'signup' ? 'signin' : 'signup'));
    formFadeAnim.setValue(0.65);
    Animated.timing(formFadeAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const rootBg = isDark ? '#000000' : '#F4F5F7';
  const surfaceCardBg = isDark ? '#0B0B0D' : '#FFFFFF';
  const googleCardBg = isDark ? '#121215' : '#FFFFFF';
  const inputIdleBg = isDark ? '#161619' : '#F1F3F6';
  const inputFocusBg = isDark ? '#1D1D22' : '#E8ECF2';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const labelText = isDark ? '#9CA3AF' : '#64748B';
  const dividerLineBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const ctaBg = isDark ? '#FFFFFF' : '#09090B';
  const ctaText = isDark ? '#09090B' : '#FFFFFF';
  const themeBtnBg = isDark ? '#121215' : '#FFFFFF';

  const webInputReset =
    Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
          outline: 'none',
          boxShadow: 'none',
        } as any)
      : undefined;

  const handlePrimarySubmit = () => {
    triggerNotification(NotificationType.Success);
    onAuthenticate({
      provider: 'email',
      mode: authMode,
      name: fullName.trim() || undefined,
      email: email.trim() || undefined,
    });
  };

  const handleGoogleContinue = () => {
    triggerImpact(ImpactStyle.Medium);
    onAuthenticate({
      provider: 'google',
      mode: authMode,
      name: fullName.trim() || undefined,
      email: email.trim() || undefined,
    });
  };

  const handleGuestContinue = () => {
    triggerImpact(ImpactStyle.Light);
    onAuthenticate({
      provider: 'guest',
      mode: authMode,
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: rootBg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(28, insets.bottom + 18) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quiet borderless top-right theme switcher */}
          <View style={styles.topFloatRow}>
            <AnimatedPressable
              scaleTo={0.9}
              onPress={() => {
                triggerImpact(ImpactStyle.Light);
                toggleTheme();
              }}
              accessibilityLabel="Toggle theme mode"
              contentStyle={[styles.themeIconBtn, { backgroundColor: themeBtnBg }]}
            >
              {isDark ? (
                <Sun size={16} color="#E4E4E7" />
              ) : (
                <Moon size={16} color="#18181B" />
              )}
            </AnimatedPressable>
          </View>

          <View style={styles.container}>
            {/* Minimal Borderless Brand Emblem & Headline */}
            <View style={styles.heroHeader}>
              <View
                ref={setLogoRef}
                collapsable={false}
                onLayout={reportLogoLayout}
                style={styles.logoSlot}
              >
                <Image
                  source={
                    isDark
                      ? require('../../../assets/icon-dark.png')
                      : require('../../../assets/icon-light.png')
                  }
                  resizeMode="cover"
                  style={[
                    styles.logoImage,
                    {
                      backgroundColor: isDark ? '#000000' : '#FFFFFF',
                      opacity: hideLogo ? 0 : 1,
                    },
                  ]}
                />
              </View>

              <Text style={[styles.heroTitle, { color: textColor }]}>
                {isSignUp ? 'Create your space.' : 'Welcome back.'}
              </Text>
              <Text style={[styles.heroSubtitle, { color: mutedText }]}>
                {isSignUp
                  ? 'Effortless bill splitting, smart debt minimization, and instant UPI QR payouts.'
                  : 'Sign in to track trips, balances, and instant UPI settlements.'}
              </Text>
            </View>

            {/* Borderless Google Action Pill */}
            <AnimatedPressable
              scaleTo={0.98}
              onPress={handleGoogleContinue}
              contentStyle={[styles.googlePillBtn, { backgroundColor: googleCardBg }]}
            >
              <View style={styles.googleLeftSlot}>
                <GoogleLogoMark size={20} />
              </View>
              <Text style={[styles.googlePillText, { color: textColor }]}>
                {isSignUp ? 'Sign up with Google' : 'Continue with Google'}
              </Text>
              <View style={styles.googleRightSlot}>
                <ChevronRight size={17} color={mutedText} />
              </View>
            </AnimatedPressable>

            {/* Subtle OR Divider */}
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: dividerLineBg }]} />
              <Text style={[styles.orText, { color: mutedText }]}>OR</Text>
              <View style={[styles.orLine, { backgroundColor: dividerLineBg }]} />
            </View>

            {/* Completely Borderless Form Surface */}
            <Animated.View
              style={[
                styles.formCard,
                { backgroundColor: surfaceCardBg, opacity: formFadeAnim },
              ]}
            >
              {isSignUp && (
                <View style={styles.fieldBlock}>
                  <Text style={[styles.fieldLabel, { color: labelText }]}>Full Name</Text>
                  <View
                    style={[
                      styles.inputBox,
                      { backgroundColor: focusedField === 'name' ? inputFocusBg : inputIdleBg },
                    ]}
                  >
                    <User
                      size={16}
                      color={focusedField === 'name' ? textColor : mutedText}
                    />
                    <TextInput
                      style={[styles.textInput, { color: textColor }, webInputReset]}
                      placeholder="Alex Morgan"
                      placeholderTextColor={mutedText}
                      value={fullName}
                      onChangeText={setFullName}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField((prev) => (prev === 'name' ? null : prev))}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>
                </View>
              )}

              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: labelText }]}>Email Address</Text>
                <View
                  style={[
                    styles.inputBox,
                    { backgroundColor: focusedField === 'email' ? inputFocusBg : inputIdleBg },
                  ]}
                >
                  <Mail
                    size={16}
                    color={focusedField === 'email' ? textColor : mutedText}
                  />
                  <TextInput
                    style={[styles.textInput, { color: textColor }, webInputReset]}
                    placeholder="alex@splittrack.app"
                    placeholderTextColor={mutedText}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField((prev) => (prev === 'email' ? null : prev))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: labelText }]}>Password</Text>
                <View
                  style={[
                    styles.inputBox,
                    {
                      backgroundColor:
                        focusedField === 'password' ? inputFocusBg : inputIdleBg,
                    },
                  ]}
                >
                  <Lock
                    size={16}
                    color={focusedField === 'password' ? textColor : mutedText}
                  />
                  <TextInput
                    style={[styles.textInput, { color: textColor }, webInputReset]}
                    placeholder="••••••••"
                    placeholderTextColor={mutedText}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() =>
                      setFocusedField((prev) => (prev === 'password' ? null : prev))
                    }
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handlePrimarySubmit}
                  />
                  <AnimatedPressable
                    scaleTo={0.9}
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    contentStyle={styles.eyeBtn}
                  >
                    {showPassword ? (
                      <EyeOff size={16} color={mutedText} />
                    ) : (
                      <Eye size={16} color={mutedText} />
                    )}
                  </AnimatedPressable>
                </View>
              </View>

              {/* High-Contrast Pill Primary CTA */}
              <AnimatedPressable
                scaleTo={0.975}
                onPress={handlePrimarySubmit}
                contentStyle={[styles.primaryPillBtn, { backgroundColor: ctaBg }]}
              >
                <View style={styles.ctaSpacer} />
                <Text style={[styles.primaryPillText, { color: ctaText }]}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
                <View style={styles.ctaRightArrow}>
                  <ArrowRight size={17} color={ctaText} />
                </View>
              </AnimatedPressable>
            </Animated.View>

            {/* Minimal Mode Switch & Guest Footer (zero borders) */}
            <View style={styles.footerRow}>
              <AnimatedPressable
                scaleTo={0.97}
                onPress={handleToggleAuthMode}
                contentStyle={styles.switchModeBtn}
              >
                <Text style={[styles.switchPromptText, { color: mutedText }]}>
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <Text style={[styles.switchActionText, { color: textColor }]}>
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </Text>
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                scaleTo={0.97}
                onPress={handleGuestContinue}
                contentStyle={styles.guestLinkBtn}
              >
                <Text style={[styles.guestLinkText, { color: mutedText }]}>
                  Continue as Guest
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  topFloatRow: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  themeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  heroHeader: {
    alignItems: 'center',
    marginBottom: 26,
  },
  logoSlot: {
    width: AUTH_LOGO_SIZE,
    height: AUTH_LOGO_SIZE,
    borderRadius: AUTH_LOGO_SIZE / 2,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 0,
  },
  logoImage: {
    width: AUTH_LOGO_SIZE,
    height: AUTH_LOGO_SIZE,
    borderRadius: AUTH_LOGO_SIZE / 2,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13.5,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 310,
  },
  googlePillBtn: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0,
  },
  googleLeftSlot: {
    width: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  googlePillText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  googleRightSlot: {
    width: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.9,
  },
  formCard: {
    width: '100%',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  fieldBlock: {
    gap: 7,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    borderWidth: 0,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '400',
    paddingVertical: 0,
    borderWidth: 0,
  },
  eyeBtn: {
    padding: 2,
  },
  primaryPillBtn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    borderWidth: 0,
  },
  ctaSpacer: {
    width: 20,
  },
  primaryPillText: {
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  ctaRightArrow: {
    width: 20,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  footerRow: {
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  switchModeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  switchPromptText: {
    fontSize: 13,
    fontWeight: '400',
  },
  switchActionText: {
    fontWeight: '600',
  },
  guestLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  guestLinkText: {
    fontSize: 12,
    fontWeight: '400',
  },
});

export default OnboardingAuthScreen;
