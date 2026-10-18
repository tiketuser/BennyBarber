import { describe, expect, it } from 'vitest';
import { courseFrom, placeForms } from './shop';

describe('course switch in the shop config', () => {
  it('turned off hides the course (null everywhere)', () => {
    expect(courseFrom({ enabled: false, details: 'x' })).toBeNull();
  });
  it('turned on keeps its details', () => {
    expect(courseFrom({ enabled: true, details: '8 מפגשים' })).toEqual({ details: '8 מפגשים' });
  });
});

describe('the shop as a place in sentences', () => {
  it('defaults to "המספרה"', () => {
    expect(placeForms()).toEqual({ place: 'המספרה', inPlace: 'במספרה', toPlace: 'למספרה', closed: 'המספרה סגורה' });
  });
  it('a salon reads "בסלון", "הסלון סגור"', () => {
    expect(placeForms('הסלון')).toEqual({ place: 'הסלון', inPlace: 'בסלון', toPlace: 'לסלון', closed: 'הסלון סגור' });
  });
});
