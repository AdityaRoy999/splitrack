import type { ImagePickerAsset } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export function imageDataUri(base64: string, fallback = 'image/jpeg') {
  // Native ImagePicker can return JPEG bytes with the original asset's MIME
  // type (for example HEIC). Trust the encoded bytes when labeling uploads.
  const mime = base64.startsWith('/9j') ? 'image/jpeg' : base64.startsWith('iVBORw0KGgo') ? 'image/png' : base64.startsWith('UklGR') ? 'image/webp' : fallback;
  return `data:${mime};base64,${base64}`;
}

export async function pickedImageUri(asset: Pick<ImagePickerAsset, 'uri' | 'width' | 'height'>, maxDimension = 1024) {
  // Decode at the size used by the app, convert HEIC to JPEG, and keep uploads
  // below the existing AWS 3 MB limit without passing full camera images to JS.
  const context = ImageManipulator.manipulate(asset.uri, { maxWidth: maxDimension, maxHeight: maxDimension });
  let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  try {
    image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
    if (!result.base64) throw new Error('The photo could not be prepared. Try another picture.');
    if (result.base64.length > 4 * 1024 * 1024) throw new Error('Choose a smaller photo to upload.');
    return imageDataUri(result.base64);
  } finally {
    image?.release();
    context.release();
  }
}
