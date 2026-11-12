import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ReactQRCode } from '@lglab/react-qr-code';
import { UpiAccount } from '../../types';
import {
  buildUpiPaymentUri,
  getUpiBrandMeta,
  getUpiCenterLogoDataUri,
} from './upiBrandLogo';

export interface StyledUpiQrProps {
  account: UpiAccount;
  size?: number;
}

export const StyledUpiQr: React.FC<StyledUpiQrProps> = ({ account, size = 216 }) => {
  const meta = getUpiBrandMeta(account.provider, account.bankBrand);
  const value = buildUpiPaymentUri(account);
  const logoSrc = getUpiCenterLogoDataUri(account.provider);
  const centerSize = Math.round(size * 0.24);

  return (
    <View style={[styles.qrFrame, { width: size, height: size }]}>
      <ReactQRCode
        value={value}
        size={size}
        level="H"
        marginSize={2}
        background="#FFFFFF"
        gradient={{
          type: 'linear',
          rotation: 135,
          stops: [
            { offset: '0%', color: meta.qrGradientStart },
            { offset: '100%', color: meta.qrGradientEnd },
          ],
        }}
        dataModulesSettings={{
          style: 'rounded',
          lineWidth: 0.88,
        }}
        finderPatternOuterSettings={{
          style: 'rounded-lg',
          color: meta.eyeOuterColor,
        }}
        finderPatternInnerSettings={{
          style: 'rounded',
          color: meta.eyeInnerColor,
        }}
        imageSettings={{
          src: logoSrc,
          width: centerSize,
          height: centerSize,
          excavate: true,
        }}
        svgProps={{
          'aria-label': `UPI QR Code for ${account.upiId}`,
          style: { display: 'block', borderRadius: 16 },
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  qrFrame: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
