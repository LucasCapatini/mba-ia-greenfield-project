import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type TrackedRequest = { ip?: string; ips?: string[] };

/**
 * Throttler keyed by the visitor's IP (watch-page/TD-03). Behind the BFF every request reaches the
 * API from the `next-frontend` container, so the default tracker (`req.ip`) would give all visitors
 * one shared budget. With `trust proxy` set to the BFF address (TRUST_PROXY, main.ts) Express fills
 * `req.ips` from `X-Forwarded-For`; the first entry is the visitor. Without it `req.ips` is empty and
 * the socket IP is used — the header is ignored. Pattern from the @nestjs/throttler docs ("Proxies").
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const { ip, ips } = req as TrackedRequest;
    return Promise.resolve(ips && ips.length > 0 ? ips[0] : (ip ?? ''));
  }
}
