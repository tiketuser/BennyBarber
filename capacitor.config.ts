import type { CapacitorConfig } from '@capacitor/cli';
import shop from './shop.config';

// The same build (dist/) ships as the PWA and inside the native iOS/Android shells.
// After installing Xcode / Android Studio: `npx cap add ios`, `npx cap add android`, then `npm run cap:sync`.
const config: CapacitorConfig = {
  appId: shop.appId,
  appName: shop.brand,
  webDir: 'dist',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
};

export default config;
