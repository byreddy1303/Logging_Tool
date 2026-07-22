import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { jwtRoleClaim } from '../../supabase/functions/_shared/cron-auth';

function jwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${encoded}.gateway-verified-signature`;
}

describe('daily digest cron authorization', () => {
  it('keeps gateway JWT verification enabled for the digest function', () => {
    const config = readFileSync('supabase/config.toml', 'utf8');
    const section = config.match(/\[functions\.daily-digest\]([\s\S]*?)(?=\n\[|$)/)?.[1];
    expect(section).toContain('verify_jwt = true');
  });

  it('recognizes the service-role claim from a gateway-verified JWT', () => {
    expect(jwtRoleClaim(jwt({ role: 'service_role', exp: 1_900_000_000 }))).toBe(
      'service_role'
    );
  });

  it('does not promote user, malformed, or unsigned tokens', () => {
    expect(jwtRoleClaim(jwt({ role: 'authenticated' }))).toBe('authenticated');
    expect(jwtRoleClaim('not-a-jwt')).toBeNull();
    expect(jwtRoleClaim('header.payload.')).toBeNull();
  });
});
