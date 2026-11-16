/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public web address of the booking app, used in shared WhatsApp messages. */
  readonly VITE_APP_URL?: string;
}

/** True when the shop has its own logo-mark.svg in shops/<id>/public (vite.config.ts). */
declare const __SHOP_LOGO_MARK__: boolean;
declare const __TRIAL_LOGOS__: string[];
