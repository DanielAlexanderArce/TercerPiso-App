import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn utility', () => {
  it('should merge tailwind classes correctly', () => {
    const result = cn('px-2 py-2', 'px-4');
    expect(result).toBe('py-2 px-4');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', true && 'active', false && 'inactive');
    expect(result).toContain('base');
    expect(result).toContain('active');
    expect(result).not.toContain('inactive');
  });

  it('should handle undefined and null values', () => {
    const result = cn('base', undefined, null);
    expect(result).toBe('base');
  });
});
