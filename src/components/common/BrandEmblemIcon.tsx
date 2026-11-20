import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { getBrandLogoSource, needsColoredLogoBackground } from '../../constants/brandAssets';

export interface BrandEmblemIconProps {
  id?: string;
  name: string;
  logoLetter?: string;
  accentColor: string;
  secondaryColor?: string;
  size?: number;
  borderRadius?: number;
  logoUrl?: string;
}

// Verified Indian bank IFSC slugs on jsDelivr cdn
const BANK_SLUG_MAP: Record<string, string> = {
  sbi: 'sbin',
  sbin: 'sbin',
  hdfc: 'hdfc',
  icici: 'icic',
  icic: 'icic',
  axis: 'utib',
  utib: 'utib',
  kotak: 'kkbk',
  kkbk: 'kkbk',
  pnb: 'punb',
  punb: 'punb',
  bob: 'barb',
  barb: 'barb',
  canara: 'cnrb',
  cnrb: 'cnrb',
  union: 'ubin',
  ubin: 'ubin',
  boi: 'bkid',
  bkid: 'bkid',
  rbl: 'ratn',
  ratn: 'ratn',
  idfc: 'idfb',
  idfb: 'idfb',
  yes: 'yesb',
  yesb: 'yesb',
  federal: 'fdrl',
  fdrl: 'fdrl',
  indusind: 'indb',
  indb: 'indb',
  bandhan: 'bdbl',
  bdbl: 'bdbl',
  au: 'aubl',
  aubl: 'aubl',
  equitas: 'esfb',
  esfb: 'esfb',
  ujjivan: 'ujvn',
  ujvn: 'ujvn',
  sc: 'scbl',
  scbl: 'scbl',
  standardchartered: 'scbl',
  citi: 'citi',
  hsbc: 'hsbc',
  deutsche: 'deut',
  deut: 'deut',
  dbs: 'dbss',
  dbss: 'dbss',
  airtel: 'airp',
  airp: 'airp',
  paytmbank: 'pytm',
  pytm: 'pytm',
  jiopay: 'jiop',
  jiop: 'jiop',
  central: 'cbin',
  cbin: 'cbin',
  indian: 'idib',
  idib: 'idib',
  southindian: 'sibl',
  sibl: 'sibl',
  karur: 'kvbl',
  kvbl: 'kvbl',
  cityunion: 'ciub',
  ciub: 'ciub',
  karnataka: 'karb',
  karb: 'karb',
};

// Verified UPI app CDN logos
const APP_LOGO_URLS: Record<string, string> = {
  gpay: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/google-pay.png',
  googlepay: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/google-pay.png',
  whatsapp: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/whatsapp.png',
  amazonpay: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/amazon.png',
  amazon: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/amazon.png',
  paytm: 'https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks/assets/logos/pytm/logo.png',
};

export const BrandEmblemIcon: React.FC<BrandEmblemIconProps> = ({
  id,
  name,
  logoLetter,
  accentColor,
  secondaryColor = '#000000',
  size = 38,
  borderRadius = 10,
  logoUrl,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const normId = (id || name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const localLogo = getBrandLogoSource(normId);

  if (localLogo) {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius, backgroundColor: needsColoredLogoBackground(localLogo) ? accentColor : '#FFFFFF' }]}>
        {/* Fill the tile; its rounded clipping removes square artwork corners. */}
        <Image source={localLogo} style={{ width: size, height: size }} resizeMode="contain" />
      </View>
    );
  }

  // 1. Resolve remote logo URL if available
  let resolvedUrl = logoUrl;
  if (!resolvedUrl && !imageFailed) {
    if (APP_LOGO_URLS[normId]) {
      resolvedUrl = APP_LOGO_URLS[normId];
    } else if (BANK_SLUG_MAP[normId]) {
      const slug = BANK_SLUG_MAP[normId];
      resolvedUrl = `https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks/assets/logos/${slug}/logo.png`;
    }
  }

  if (resolvedUrl && !imageFailed) {
    return (
      <View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: '#FFFFFF',
          },
        ]}
      >
        <Image
          source={{ uri: resolvedUrl }}
          style={{ width: size * 0.82, height: size * 0.82 }}
          resizeMode="contain"
          onError={() => setImageFailed(true)}
        />
      </View>
    );
  }

  // A generic bank identity has no app metadata; use an offline bank emblem.
  if (normId === 'bank') {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius, backgroundColor: accentColor }]}>
        <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24">
          <Path d="M3 9l9-6 9 6H3zM3 20h18" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M6 12v5m6-5v5m6-5v5" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </View>
    );
  }

  // 2. High-precision vector graphics for key UPI brands
  if (normId === 'gpay' || normId === 'googlepay') {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius, backgroundColor: '#FFFFFF' }]}>
        <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 24 24">
          <Path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
          <Path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
          <Path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
          <Path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
        </Svg>
      </View>
    );
  }

  if (normId === 'phonepe') {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius, backgroundColor: '#5F259F' }]}>
        <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24">
          <Path d="M8 7h8v2H14v8h-2.5V9H11v4c0 1.2.5 1.8 1.5 1.8.4 0 .7 0 .9-.1v2c-.4.1-.8.2-1.3.2-2 0-3.1-1.2-3.1-3.4V9H8V7z" fill="#FFFFFF" />
          <Path d="M10 4.5c1.1-.9 2.4-.7 3.4.2l1.2 1.2h-2.2l-2.4-1.4z" fill="#FFFFFF" />
        </Svg>
      </View>
    );
  }

  if (normId === 'paytm') {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius, backgroundColor: '#FFFFFF' }]}>
        <Svg width={size * 0.8} height={size * 0.45} viewBox="0 0 40 20">
          <Path d="M4 16V4h6.5c3.5 0 5.8 2 5.8 5s-2.3 5-5.8 5H7.5V16H4zm3.5-7h2.8c1.6 0 2.6-.9 2.6-2.3s-1-2.3-2.6-2.3H7.5V9z" fill="#002970" />
          <Rect x={18} y={7} width={14} height={9} rx={4.5} fill="#00BAF2" />
          <Path d="M22 11.5l1.8 1.8 3.5-3.5" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
    );
  }

  if (normId === 'slice' || normId === 'sliceupi') {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius, backgroundColor: '#12141A' }]}>
        <Svg width={size * 0.68} height={size * 0.68} viewBox="0 0 32 32">
          <Path d="M21 11c-1.4-1.1-3.2-1.5-5-1.3-2.8.3-4.8 2.1-4.8 4.4 0 2.4 2 3.4 4.9 3.9 1.9.4 2.8.9 2.8 1.9 0 1.2-1.2 1.9-3 1.9-1.7 0-3.2-.6-4.3-1.6l-1.5 2.2c1.4 1.3 3.4 2 5.8 2 3.5 0 5.8-1.9 5.8-4.6 0-2.5-1.8-3.6-5-4.2-1.9-.3-2.7-.8-2.7-1.7 0-.9.9-1.6 2.4-1.6 1.4 0 2.6.4 3.5 1.1l1.1-2.4z" fill="#FFFFFF" />
          <Circle cx="24" cy="9" r="2.6" fill="#7CFF67" />
        </Svg>
      </View>
    );
  }

  if (normId === 'cred') {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius, backgroundColor: '#111114' }]}>
        <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 32 32">
          <Path d="M16 6l8 3.5v6.5c0 5.5-3.5 10-8 11.5-4.5-1.5-8-6-8-11.5V9.5L16 6z" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" />
          <Path d="M19 14.5c-.7-.8-1.7-1.3-2.8-1.3-2.2 0-3.8 1.6-3.8 3.9s1.6 3.9 3.8 3.9c1.2 0 2.2-.5 2.8-1.3" fill="none" stroke="#F97316" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </View>
    );
  }

  if (normId === 'bhim') {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius, backgroundColor: '#00796B' }]}>
        <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 32 32">
          <Path d="M7 6h8c3.5 0 6 2 6 5 0 1.8-.9 3.2-2.3 4 2 .8 3.3 2.5 3.3 4.8 0 3.5-2.7 6.2-7 6.2H7V6zm5 7.5h3c1.5 0 2.5-.8 2.5-2s-1-2-2.5-2H12v4zm0 8.5h3.5c1.7 0 2.8-.9 2.8-2.3s-1.1-2.2-2.8-2.2H12V22z" fill="#FFFFFF" />
        </Svg>
      </View>
    );
  }

  // 3. Clean fallback emblem (borderless, high-contrast, modern typography)
  const glyph = (logoLetter || name.slice(0, 3)).toUpperCase();
  const fontSize =
    glyph.length > 3
      ? Math.round(size * 0.28)
      : glyph.length === 3
      ? Math.round(size * 0.33)
      : Math.round(size * 0.42);

  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: accentColor || '#27272A',
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.monogramText,
          {
            fontSize,
            color: '#FFFFFF',
          },
        ]}
      >
        {glyph}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,
  },
  monogramText: {
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
});
