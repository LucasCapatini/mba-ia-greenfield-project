import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { BEARER_PREFIX } from '../auth.constants';
import { JwtPayload } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type AuthRequest = {
  headers: Record<string, string | undefined>;
  user?: JwtPayload;
};

/**
 * Global JWT guard. Protected routes require a valid `Bearer` token. `@Public()` routes use
 * optional auth (video-channel-management/TD-07): no `Authorization` header → anonymous; a header
 * that is present is verified like on a protected route, so an invalid or expired token is a 401
 * even there, and a valid one populates `request.user` for `@OptionalUser()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authHeader = request.headers?.authorization;

    if (!authHeader) {
      if (isPublic) return true;
      throw new UnauthorizedException();
    }

    request.user = await this.verify(authHeader);
    return true;
  }

  private async verify(authHeader: string): Promise<JwtPayload> {
    if (!authHeader.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException();
    }
    const token = authHeader.slice(BEARER_PREFIX.length);
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
  }
}
