import { describe, expect, it } from 'vitest';
import { courseFrom } from './shop';

describe('course switch in the shop config', () => {
  it('turned off hides the course (null everywhere)', () => {
    expect(courseFrom({ enabled: false, details: 'x' })).toBeNull();
  });
  it('turned on keeps its details', () => {
    expect(courseFrom({ enabled: true, details: '8 מפגשים' })).toEqual({ details: '8 מפגשים' });
  });
});
