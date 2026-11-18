import type { ImagePickerAsset } from 'expo-image-picker';

export function imageDataUri(base64: string, fallback = 'image/jpeg') {
  // Native ImagePicker can return JPEG bytes with the original asset's MIME
  // type (for example HEIC). Trust the encoded bytes when labeling uploads.
  const mime = base64.startsWith('/9j') ? 'image/jpeg' : base64.startsWith('iVBORw0KGgo') ? 'image/png' : base64.startsWith('UklGR') ? 'image/webp' : fallback;
  return `data:${mime};base64,${base64}`;
}

export function pickedImageUri(asset: Pick<ImagePickerAsset, 'uri' | 'base64' | 'mimeType'>) {
  return asset.base64 ? imageDataUri(asset.base64, asset.mimeType ?? 'image/jpeg') : asset.uri;
}
