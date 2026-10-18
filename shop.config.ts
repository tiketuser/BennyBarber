/**
 * The shop this build is for, picked by the SHOP environment variable (default: bennycohen).
 * In the app itself vite.config.ts points every `shop.config` import straight at shops/<SHOP>/config.ts,
 * so a site only ever contains its own shop's details. Node scripts (rules, icons, tests) come through here.
 */
import { SHOPS } from './shops/index.ts';

export const SHOP_ID = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SHOP || 'bennycohen';

const shop = SHOPS[SHOP_ID as keyof typeof SHOPS];
if (!shop) throw new Error(`Unknown shop "${SHOP_ID}". Shops: ${Object.keys(SHOPS).join(', ')}`);

export default shop;
