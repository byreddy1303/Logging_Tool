import { describe, expect, it } from 'vitest';
import { resolveNativeBackAction, routeFromAppUrl } from '@/lib/native';

describe('native URL routing', () => {
  it('maps the custom scheme to an in-app route', () => {
    expect(routeFromAppUrl('airjournal://auth?invite=abc123')).toBe('/auth?invite=abc123');
  });

  it('maps an HTTPS app link without carrying its origin', () => {
    expect(routeFromAppUrl('https://journal.example.com/signup?invite=abc#pin')).toBe(
      '/signup?invite=abc#pin'
    );
  });

  it('rejects unsupported and malformed protocols', () => {
    expect(routeFromAppUrl('javascript:alert(1)')).toBeNull();
    expect(routeFromAppUrl('not a url')).toBeNull();
  });
});

describe('Android Back policy', () => {
  it('uses normal history navigation inside the app', () => {
    expect(
      resolveNativeBackAction({ path: '/planner', canGoBack: true, now: 10_000, lastRootBackAt: 0 })
    ).toEqual({ type: 'history' });
  });

  it('routes a deep-linked inner page home instead of closing', () => {
    expect(
      resolveNativeBackAction({ path: '/planner', canGoBack: false, now: 10_000, lastRootBackAt: 0 })
    ).toEqual({ type: 'route', to: '/' });
  });

  it('requires two root Back presses within two seconds to exit', () => {
    expect(
      resolveNativeBackAction({ path: '/', canGoBack: true, now: 10_000, lastRootBackAt: 0 })
    ).toEqual({ type: 'arm-exit' });
    expect(
      resolveNativeBackAction({ path: '/', canGoBack: true, now: 11_500, lastRootBackAt: 10_000 })
    ).toEqual({ type: 'exit' });
  });
});
