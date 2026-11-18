import { File } from 'expo-file-system';
import { api } from './api';
import { imageDataUri } from '../utils/pickedImage';

export async function uploadImage(uri: string) {
  if (!uri || uri.startsWith('cartoon:') || uri.startsWith('media:') || uri.startsWith('https://')) return uri;
  let data = uri;
  if (!uri.startsWith('data:')) {
    const mime = /\.png(?:\?|$)/i.test(uri) ? 'image/png' : /\.webp(?:\?|$)/i.test(uri) ? 'image/webp' : 'image/jpeg';
    data = imageDataUri(await new File(uri).base64(), mime);
  }
  const result = await api<{ reference: string }>('/api/media', { method: 'POST', body: { data } });
  return result.reference;
}
