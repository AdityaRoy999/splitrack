import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'qrcode';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { UpiAccount, UpiProvider } from '../../types';
import { buildUpiPaymentUri, getUpiBrandMeta } from './upiBrandLogo';

export interface StyledUpiQrProps {
  account: UpiAccount;
  size?: number;
}

const isFinderCell = (row: number, col: number, matrixSize: number): boolean => {
  const inTop = row < 7;
  const inBottom = row >= matrixSize - 7;
  const inLeft = col < 7;
  const inRight = col >= matrixSize - 7;
  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
};

const roundedRectPath = (x: number, y: number, w: number, h: number, r: number): string => {
  const radius = Math.min(r, w / 2, h / 2);
  return (
    `M${(x + radius).toFixed(2)},${y.toFixed(2)}` +
    `h${(w - radius * 2).toFixed(2)}` +
    `a${radius.toFixed(2)},${radius.toFixed(2)} 0 0 1 ${radius.toFixed(2)},${radius.toFixed(2)}` +
    `v${(h - radius * 2).toFixed(2)}` +
    `a${radius.toFixed(2)},${radius.toFixed(2)} 0 0 1 -${radius.toFixed(2)},${radius.toFixed(2)}` +
    `h-${(w - radius * 2).toFixed(2)}` +
    `a${radius.toFixed(2)},${radius.toFixed(2)} 0 0 1 -${radius.toFixed(2)},-${radius.toFixed(2)}` +
    `v-${(h - radius * 2).toFixed(2)}` +
    `a${radius.toFixed(2)},${radius.toFixed(2)} 0 0 1 ${radius.toFixed(2)},-${radius.toFixed(2)}z`
  );
};

const UpiBrandCenterGlyph: React.FC<{ provider: UpiProvider; size: number }> = ({
  provider,
  size,
}) => {
  switch (provider) {
    case 'gpay':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Rect x={2} y={2} width={60} height={60} rx={16} fill="#FFFFFF" stroke="#E5E7EB" strokeWidth={2} />
          <Path d="M47.3 32.5c0-1.1-.1-2.2-.3-3.2H32v6.1h8.6c-.4 2-1.5 3.6-3.2 4.7v3.9h5.1c3-2.8 4.8-6.9 4.8-11.5z" fill="#4285F4" />
          <Path d="M32 48c4.3 0 7.9-1.4 10.5-3.9l-5.1-3.9c-1.4 1-3.2 1.5-5.4 1.5-4.1 0-7.7-2.8-8.9-6.6h-5.3v4.1C20.4 44.5 25.8 48 32 48z" fill="#34A853" />
          <Path d="M23.1 35.1c-.3-1-.5-2-.5-3.1s.2-2.1.5-3.1v-4.1h-5.3C16.7 27 16 29.4 16 32s.7 5 1.8 7.2l5.3-4.1z" fill="#FBBC05" />
          <Path d="M32 22.3c2.3 0 4.4.8 6.1 2.4l4.5-4.5C39.9 17.6 36.3 16 32 16c-6.2 0-11.6 3.5-14.2 8.8l5.3 4.1c1.2-3.8 4.8-6.6 8.9-6.6z" fill="#EA4335" />
        </Svg>
      );
    case 'phonepe':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Rect x={2} y={2} width={60} height={60} rx={16} fill="#5F259F" />
          <Path d="M21 21h22v4H37v19h-4.4V25H29v10.2c0 2.5 1.1 3.8 3.2 3.8.8 0 1.4-.1 1.9-.3v3.8c-.8.3-1.8.5-2.9.5-4.3 0-6.6-2.5-6.6-7.2V25H21v-4z" fill="#FFFFFF" />
          <Path d="M26 16.5c2.2-1.8 4.8-1.5 6.8.5l2.5 2.5H31l-5-3z" fill="#FFFFFF" />
        </Svg>
      );
    case 'paytm':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Rect x={2} y={2} width={60} height={60} rx={16} fill="#FFFFFF" stroke="#E0F2FE" strokeWidth={2} />
          <Path d="M19 44V20h10.5c5.8 0 9.6 3.4 9.6 8.4s-3.8 8.4-9.6 8.4H24.6V44H19zm5.6-11.8h4.5c2.6 0 4.3-1.5 4.3-3.8s-1.7-3.8-4.3-3.8h-4.5v7.6z" fill="#002970" />
          <Rect x={33} y={34} width={13} height={10} rx={5} fill="#00BAF2" />
          <Path d="M37 39l2.2 2 3.8-3.8" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      );
    case 'slice':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Rect x={2} y={2} width={60} height={60} rx={16} fill="#12141A" />
          <Path d="M40.5 22.5c-2.5-2-5.8-2.8-9.2-2.4-5.1.6-8.8 3.9-8.8 8 0 4.4 3.6 6.2 8.9 7.2 3.5.7 5.2 1.6 5.2 3.5 0 2.1-2.2 3.5-5.5 3.5-3.1 0-5.8-1.1-7.8-2.9l-2.8 4c2.6 2.3 6.3 3.6 10.6 3.6 6.4 0 10.7-3.4 10.7-8.4 0-4.6-3.3-6.6-9.1-7.7-3.4-.6-5-1.4-5-3.1 0-1.7 1.7-2.9 4.4-2.9 2.6 0 4.8.8 6.4 2.1l2-4.5z" fill="#FFFFFF" />
          <Circle cx={45.5} cy={18.5} r={4.5} fill="#7CFF67" />
        </Svg>
      );
    case 'cred':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Rect x={2} y={2} width={60} height={60} rx={16} fill="#111114" />
          <Path d="M32 14l14 6v11c0 9.1-5.9 16.5-14 19-8.1-2.5-14-9.9-14-19V20l14-6z" fill="none" stroke="#FFFFFF" strokeWidth={3.2} strokeLinejoin="round" />
          <Path d="M37 27.5c-1.2-1.4-2.9-2.2-4.8-2.2-3.7 0-6.4 2.8-6.4 6.7s2.7 6.7 6.4 6.7c2 0 3.7-.8 4.8-2.2" fill="none" stroke="#F97316" strokeWidth={3.2} strokeLinecap="round" />
        </Svg>
      );
    case 'bank':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Rect x={2} y={2} width={60} height={60} rx={16} fill="#059669" />
          <Path d="M18 26l14-8 14 8H18z" fill="#FFFFFF" />
          <Rect x={21} y={29} width={4} height={11} rx={1.5} fill="#FFFFFF" />
          <Rect x={30} y={29} width={4} height={11} rx={1.5} fill="#FFFFFF" />
          <Rect x={39} y={29} width={4} height={11} rx={1.5} fill="#FFFFFF" />
          <Rect x={17} y={42} width={30} height={4} rx={2} fill="#FFFFFF" />
        </Svg>
      );
  }
};

export const StyledUpiQr: React.FC<StyledUpiQrProps> = ({ account, size = 216 }) => {
  const meta = getUpiBrandMeta(account.provider, account.bankBrand);
  const value = buildUpiPaymentUri(account);
  const centerSize = Math.round(size * 0.24);

  const qrLayout = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
    const matrixSize = qr.modules.size;
    const margin = 2;
    const totalUnits = matrixSize + margin * 2;
    const cell = size / totalUnits;

    // Excavate center area (~27% of matrix width) so the UPI logo sits crisply without collisions
    const halfExcavated = Math.max(3, Math.ceil((matrixSize * 0.28) / 2));
    const centerIndex = Math.floor(matrixSize / 2);
    const exMin = centerIndex - halfExcavated;
    const exMax = centerIndex + halfExcavated;

    let pathD = '';
    const dotSize = cell * 0.88;
    const inset = (cell - dotSize) / 2;
    const radius = dotSize * 0.36;

    for (let row = 0; row < matrixSize; row += 1) {
      for (let col = 0; col < matrixSize; col += 1) {
        if (!qr.modules.get(row, col)) continue;
        if (isFinderCell(row, col, matrixSize)) continue;
        if (row >= exMin && row <= exMax && col >= exMin && col <= exMax) continue;

        const x = (col + margin) * cell + inset;
        const y = (row + margin) * cell + inset;
        pathD += roundedRectPath(x, y, dotSize, dotSize, radius);
      }
    }

    const finders = [
      { row: 0, col: 0 },
      { row: 0, col: matrixSize - 7 },
      { row: matrixSize - 7, col: 0 },
    ].map(({ row, col }) => ({
      x: (col + margin) * cell,
      y: (row + margin) * cell,
      outerSize: 7 * cell,
      gapX: (col + margin + 1) * cell,
      gapY: (row + margin + 1) * cell,
      gapSize: 5 * cell,
      innerX: (col + margin + 2) * cell,
      innerY: (row + margin + 2) * cell,
      innerSize: 3 * cell,
    }));

    return { pathD, finders, cell };
  }, [size, value]);

  return (
    <View style={[styles.qrFrame, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="upiQrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={meta.qrGradientStart} />
            <Stop offset="100%" stopColor={meta.qrGradientEnd} />
          </LinearGradient>
        </Defs>

        <Rect width={size} height={size} rx={18} fill="#FFFFFF" />

        {qrLayout.pathD ? <Path d={qrLayout.pathD} fill="url(#upiQrGrad)" /> : null}

        {qrLayout.finders.map((finder, idx) => (
          <React.Fragment key={idx}>
            <Rect
              x={finder.x}
              y={finder.y}
              width={finder.outerSize}
              height={finder.outerSize}
              rx={qrLayout.cell * 1.9}
              fill={meta.eyeOuterColor}
            />
            <Rect
              x={finder.gapX}
              y={finder.gapY}
              width={finder.gapSize}
              height={finder.gapSize}
              rx={qrLayout.cell * 1.15}
              fill="#FFFFFF"
            />
            <Rect
              x={finder.innerX}
              y={finder.innerY}
              width={finder.innerSize}
              height={finder.innerSize}
              rx={qrLayout.cell * 0.85}
              fill={meta.eyeInnerColor}
            />
          </React.Fragment>
        ))}
      </Svg>

      <View
        pointerEvents="none"
        style={[
          styles.centerLogoWrap,
          {
            width: centerSize + 8,
            height: centerSize + 8,
            borderRadius: Math.round((centerSize + 8) * 0.28),
          },
        ]}
      >
        <UpiBrandCenterGlyph provider={account.provider} size={centerSize} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  qrFrame: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLogoWrap: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
