import { Reflector } from '@nestjs/core';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';

// Exposes the protected tracker so the unit test can call it directly.
class TestableGuard extends ThrottlerBehindProxyGuard {
  track(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }
}

describe('ThrottlerBehindProxyGuard.getTracker', () => {
  const guard = new TestableGuard(
    { throttlers: [] } as ThrottlerModuleOptions,
    {} as ThrottlerStorage,
    new Reflector(),
  );

  it('should track the first X-Forwarded-For address when Express trusted the proxy', async () => {
    const tracker = await guard.track({
      ip: '203.0.113.7',
      ips: ['203.0.113.7', '172.30.0.10'],
    });

    expect(tracker).toBe('203.0.113.7');
  });

  it('should fall back to the socket IP when no proxy is trusted (req.ips is empty)', async () => {
    const tracker = await guard.track({ ip: '172.30.0.10', ips: [] });

    expect(tracker).toBe('172.30.0.10');
  });
});
