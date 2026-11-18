import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
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
import { useAuth, type EmailCredentials } from '../../auth/AuthContext';
import { authenticationError } from '../../auth/authErrors';
import { Sun2Icon } from '@solar-icons/react-native/bold/sun-2';
import { MoonIcon } from '@solar-icons/react-native/bold/moon';
import { AltArrowRightIcon } from '@solar-icons/react-native/bold/alt-arrow-right';
import { UserIcon } from '@solar-icons/react-native/bold/user';
import { LetterIcon } from '@solar-icons/react-native/bold/letter';
import { LockPasswordIcon } from '@solar-icons/react-native/bold/lock-password';
import { EyeIcon } from '@solar-icons/react-native/bold/eye';
import { EyeClosedIcon } from '@solar-icons/react-native/bold/eye-closed';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { measureNodeInWindow, type ViewRefNode, type WindowRect } from '../../utils/measureWindow';
import { AnimatedPressable } from '../common/MotionPrimitives';

export type AuthLogoRect = WindowRect;

interface OnboardingAuthScreenProps {
  hideLogo?: boolean;
  onLogoLayout?: (rect: AuthLogoRect) => void;
  onLogoNode?: (node: ViewRefNode | null) => void;
  onAuthenticate: (payload: EmailCredentials) => Promise<void>;
}

const AUTH_LOGO_SIZE = 68;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export const OnboardingAuthScreen: React.FC<OnboardingAuthScreenProps> = ({
  hideLogo = false,
  onLogoLayout,
  onLogoNode,
  onAuthenticate,
}) => {
  const insets = useSafeAreaInsets();
  const { themeMode, toggleTheme } = useLiquidGlass();
  const { resetPassword, authenticateWithGoogle } = useAuth();
  const isDark = themeMode === 'dark';

  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<'email' | 'google' | 'reset' | null>(null);
  const busy = useRef(false);
  const pending = pendingAction !== null;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
  const inputIdleBg = isDark ? '#161619' : '#F1F3F6';
  const inputFocusBg = isDark ? '#1D1D22' : '#E8ECF2';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const labelText = isDark ? '#9CA3AF' : '#64748B';
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

  const handlePrimarySubmit = async () => {
    if (busy.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (!password || (isSignUp && password.length < 6)) { setError(isSignUp ? 'Use a password with at least 6 characters.' : 'Enter your password.'); return; }
    if (isSignUp && !fullName.trim()) { setError('Enter your name.'); return; }
    busy.current = true; setPendingAction('email'); setError(''); setNotice('');
    try {
      await onAuthenticate({ mode: authMode, name: fullName.trim() || undefined, email: email.trim(), password });
      triggerNotification(NotificationType.Success);
    } catch (failure) {
      setError(authenticationError(failure));
    } finally { busy.current = false; setPendingAction(null); }
  };
  const handleGoogleSubmit = async () => {
    if (busy.current) return;
    busy.current = true; setPendingAction('google'); setError(''); setNotice('');
    try {
      if (await authenticateWithGoogle()) triggerNotification(NotificationType.Success);
    } catch (failure) {
      setError(authenticationError(failure));
    } finally { busy.current = false; setPendingAction(null); }
  };
  const handlePasswordReset = async () => {
    if (busy.current) return;
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    busy.current = true; setPendingAction('reset'); setError(''); setNotice('');
    try { await resetPassword(email); setNotice('If this email has an account, a reset link has been sent.'); }
    catch (failure) { setError(authenticationError(failure)); }
    finally { busy.current = false; setPendingAction(null); }
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
                <Sun2Icon size={16} color="#E4E4E7" />
              ) : (
                <MoonIcon size={16} color="#18181B" />
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

            <AnimatedPressable
              disabled={pending}
              onPress={handleGoogleSubmit}
              accessibilityLabel="Continue with Google"
              accessibilityState={{ busy: pendingAction === 'google', disabled: pending }}
              contentStyle={[styles.googlePillBtn, { backgroundColor: surfaceCardBg }]}
            >
              <View style={styles.googleLeftSlot}>
                <Image source={require('../../../assets/auth/google-g.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
              </View>
              <Text style={[styles.googlePillText, { color: textColor }]}>Continue with Google</Text>
              <View style={styles.googleRightSlot}>
                {pendingAction === 'google'
                  ? <ActivityIndicator size="small" color={textColor} />
                  : <AltArrowRightIcon size={17} color={textColor} />}
              </View>
            </AnimatedPressable>
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: inputIdleBg }]} />
              <Text style={[styles.orText, { color: mutedText }]}>OR</Text>
              <View style={[styles.orLine, { backgroundColor: inputIdleBg }]} />
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
                    <UserIcon
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
                  <LetterIcon
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
                  <LockPasswordIcon
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
                      <EyeClosedIcon size={16} color={mutedText} />
                    ) : (
                      <EyeIcon size={16} color={mutedText} />
                    )}
                  </AnimatedPressable>
                </View>
              </View>

              {/* High-Contrast Pill Primary CTA */}
              {error ? <Text accessibilityLiveRegion="polite" style={{ color: '#F87171', marginBottom: 14 }}>{error}</Text> : null}
              {notice ? <Text accessibilityLiveRegion="polite" style={{ color: '#10B981', marginBottom: 14 }}>{notice}</Text> : null}
              <AnimatedPressable
                disabled={pending}
                scaleTo={0.975}
                onPress={handlePrimarySubmit}
                contentStyle={[styles.primaryPillBtn, { backgroundColor: ctaBg }]}
              >
                <View style={styles.ctaSpacer} />
                <Text style={[styles.primaryPillText, { color: ctaText }]}>
                  {pendingAction === 'email' ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
                <View style={styles.ctaRightArrow}>
                  <AltArrowRightIcon size={17} color={ctaText} />
                </View>
              </AnimatedPressable>
            </Animated.View>

            {/* Account actions */}
            <View style={styles.footerRow}>
              <AnimatedPressable
                disabled={pending}
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
                disabled={pending}
                onPress={handlePasswordReset}
                contentStyle={styles.guestLinkBtn}
              >
                <Text style={[styles.guestLinkText, { color: mutedText }]}>
                  Forgot password?
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
