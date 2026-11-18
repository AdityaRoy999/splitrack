import 'firebase/auth';
import type { Persistence } from 'firebase/auth';

// This documented SDK export is exposed only by its react-native entry point.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
