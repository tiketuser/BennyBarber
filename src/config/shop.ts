// Shop facts in one place. Values in [brackets] are placeholders to fill before launch.
export const SHOP = {
  brand: 'בני כהן',
  fullName: 'בני כהן ברברשופ',
  address: 'אריה שנקר 65, חולון',
  /** Shop WhatsApp / phone number, digits only. Placeholder until the real number is set. */
  phone: '0500000000',
  instagram: '[שם באינסטגרם]',
  instagramUrl: 'https://instagram.com/',
  wazeUrl: 'https://waze.com/ul?q=' + encodeURIComponent('אריה שנקר 65 חולון') + '&navigate=yes',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('אריה שנקר 65 חולון'),
  course: { details: '[משך הקורס] • [מחיר] • [מועד הפתיחה הבא]' },
} as const;
