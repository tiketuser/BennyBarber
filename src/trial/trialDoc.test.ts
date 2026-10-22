import { describe, expect, it } from 'vitest';
import base from '../../shops/trial/config.ts';
import { fromFields, isSlug, slugFromPath, toShopConfig } from './trialDoc';

describe('trial shop document', () => {
  it('reads the slug from the address', () => {
    expect(slugFromPath('/rami-hair-jerusalem')).toBe('rami-hair-jerusalem');
    expect(slugFromPath('/Rami-Hair/anything')).toBe('rami-hair');
    expect(slugFromPath('/')).toBe('');
    expect(isSlug('rami-hair')).toBe(true);
    expect(isSlug('x')).toBe(false);
    expect(isSlug('../etc')).toBe(false);
    expect(isSlug('רמי')).toBe(false);
  });

  it('turns Firestore REST values into plain JSON', () => {
    expect(
      fromFields({
        brand: { stringValue: 'רמי' },
        months: { integerValue: '3' },
        course: { mapValue: { fields: { enabled: { booleanValue: false } } } },
        admins: { arrayValue: { values: [{ stringValue: '054' }] } },
        empty: { arrayValue: {} },
        instagram: { nullValue: null },
        trialEndsAt: { timestampValue: '2026-10-27T06:00:00Z' },
      }),
    ).toEqual({ brand: 'רמי', months: 3, course: { enabled: false }, admins: ['054'], empty: [], instagram: null, trialEndsAt: '2026-10-27T06:00:00.000Z' });
  });

  it("builds the shop from the document, with the trial config's defaults for what is missing", () => {
    const shop = toShopConfig(base, { brand: 'רמי עיצוב שיער', phone: '054-1234567', adminPhones: ['054-1234567'], instagram: '', trialEndsAt: '2026-10-27T06:00:00Z' }, 'rami');
    expect(shop.brand).toBe('רמי עיצוב שיער');
    expect(shop.fullName).toBe('רמי עיצוב שיער');
    expect(shop.shopId).toBe('rami');
    expect(shop.instagram).toBeNull();
    expect(shop.colors).toEqual(base.colors);
    expect(shop.defaults.services).toEqual(base.defaults.services);
    expect(shop.trial).toEqual(base.trial);
    expect(shop.trialEndsAt).toBe('2026-10-27T06:00:00Z');
  });

  it('keeps hours the document sets and fills the rest of the settings', () => {
    const hours = { ...base.defaults.settings.hours, 6: { open: true, from: 600, to: 900 } };
    const shop = toShopConfig(base, { brand: 'x', phone: '050', defaults: { settings: { hours } } }, 'x');
    expect(shop.defaults.settings.hours[6]).toEqual({ open: true, from: 600, to: 900 });
    expect(shop.defaults.settings.vacations).toEqual([]);
  });
});
