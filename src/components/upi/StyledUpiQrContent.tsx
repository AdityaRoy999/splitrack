import React, { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'qrcode';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { UpiAccount } from '../../types';
import { getUpiBrandMeta } from './upiBrandLogo';
import { buildUpiPaymentUri, formatUpiAmount, type UpiPaymentDetails } from '../../utils/upi';
import { BrandEmblemIcon } from '../common/BrandEmblemIcon';
import { resolveReceivingUpiBrand } from '../../utils/upiBrand';

export interface StyledUpiQrProps extends UpiPaymentDetails {
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


export const StyledUpiQr: React.FC<StyledUpiQrProps> = ({ account, size = 216, amount, note }) => {
  const instanceId = useId();
  const gradientId = `upiQrGrad${instanceId.replace(/[^a-z0-9]/gi, '')}`;
  const brand = resolveReceivingUpiBrand(account);
  const meta = getUpiBrandMeta(brand.provider, brand.bankBrand);
  const value = buildUpiPaymentUri(account, { amount, note });
  const centerSize = Math.round(size * 0.24);

  const qrLayout = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
    const matrixSize = qr.modules.size;
    const margin = 4;
    const totalUnits = matrixSize + margin * 2;
    const cell = size / totalUnits;

    // Remove complete modules intersecting the logo's white frame, with a
    // four-module quiet zone around the QR on both web and native.
    const halfLogoUnits = (centerSize + 8) / (2 * cell);
    const exMin = Math.floor(matrixSize / 2 - halfLogoUnits);
    const exMax = Math.ceil(matrixSize / 2 + halfLogoUnits) - 1;

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
  }, [centerSize, size, value]);

  return (
    <View accessibilityRole="image" accessibilityLabel={`UPI QR Code for ${account.upiId}${amount === undefined ? '' : `, ${formatUpiAmount(amount)} INR`}`} style={[styles.qrFrame, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={meta.qrGradientStart} />
            <Stop offset="100%" stopColor={meta.qrGradientEnd} />
          </LinearGradient>
        </Defs>

        <Rect width={size} height={size} rx={18} fill="#FFFFFF" />

        {qrLayout.pathD ? <Path d={qrLayout.pathD} fill={`url(#${gradientId})`} /> : null}

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
        <BrandEmblemIcon id={brand.provider === 'bank' ? brand.bankBrand ?? 'bank' : brand.provider} name={meta.label} accentColor={meta.primary} size={centerSize} borderRadius={Math.round(centerSize * 0.22)} />
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
