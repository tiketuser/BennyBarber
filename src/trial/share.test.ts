import { describe, expect, it } from 'vitest';
import { shareDescription, withShareMeta } from '../../shops/share';

const html = `<head>
<meta name="apple-mobile-web-app-title" content="המספרה" />
<meta name="description" content="x" />
<meta property="og:site_name" content="המספרה" />
<meta property="og:title" content="קביעת תורים" />
<meta property="og:description" content="x" />
<meta property="og:image" content="https://a.web.app/pwa-512.png" />
<meta property="og:url" content="https://a.web.app" />
<title>קביעת תורים</title></head>`;

describe('link preview', () => {
  it('describes a shop by name and address, and the trial build generally', () => {
    expect(shareDescription({ fullName: 'יוסי וגיא', address: { street: 'הרצל 1', city: 'הוד השרון' } })).toBe('קביעת תור ביוסי וגיא, הרצל 1 הוד השרון');
    expect(shareDescription({ fullName: 'יוסי וגיא', address: { street: '', city: '' } })).toBe('קביעת תור ביוסי וגיא');
    expect(shareDescription({ fullName: 'האדריכל', address: { street: '', city: '' } })).toBe('קביעת תור באדריכל');
    expect(shareDescription({ fullName: 'קביעת תורים', address: { street: '', city: '' }, trial: { contactName: '', contactPhone: '' } })).not.toContain('קביעת תורים');
  });

  it("puts the shop's name, logo and address into every tag", () => {
    const out = withShareMeta(html, { title: 'Yosi & "Guy"', brand: 'יוסי', description: 'd', image: 'https://s.web.app/logos/y.png', url: 'https://s.web.app' });
    expect(out).toContain('<title>Yosi &amp; &quot;Guy&quot;</title>');
    expect(out).toContain('<meta property="og:title" content="Yosi &amp; &quot;Guy&quot;" />');
    expect(out).toContain('<meta property="og:image" content="https://s.web.app/logos/y.png" />');
    expect(out).toContain('<meta property="og:url" content="https://s.web.app" />');
    expect(out).toContain('<meta name="apple-mobile-web-app-title" content="יוסי" />');
    expect(out).not.toContain('קביעת תורים');
  });
});
