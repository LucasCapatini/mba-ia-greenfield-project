import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../auth.types';

/**
 * Authenticated user on a `@Public()` route with optional auth (video-channel-management/TD-07):
 * the payload when a valid `Bearer` token was sent, `undefined` for anonymous requests. Invalid
 * tokens never reach the handler — the global `JwtAuthGuard` answers 401 first.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    return request.user;
  },
);
