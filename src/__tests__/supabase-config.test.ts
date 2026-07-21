import { describe, expect, it } from 'vitest';
import { isValidSupabaseUrl } from '@/lib/supabase';

describe('Supabase configuration validation', () => {
  it('accepts HTTP and HTTPS project URLs', () => {
    expect(isValidSupabaseUrl('https://project.supabase.co')).toBe(true);
    expect(isValidSupabaseUrl('http://127.0.0.1:54321')).toBe(true);
  });

  it('rejects missing, placeholder, and unsafe URLs without throwing', () => {
    expect(isValidSupabaseUrl(undefined)).toBe(false);
    expect(isValidSupabaseUrl('supabase-url')).toBe(false);
    expect(isValidSupabaseUrl('javascript:alert(1)')).toBe(false);
  });
});
