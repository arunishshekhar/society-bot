import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY;
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const received = request.headers['x-admin-api-key'];

    // Reject immediately if the key is not configured
    if (!expected) {
      throw new UnauthorizedException('Admin API key not configured');
    }

    if (typeof received !== 'string') {
      throw new UnauthorizedException('Invalid admin API key');
    }

    // Use constant-time comparison to prevent timing oracle attacks
    try {
      const expectedBuf = Buffer.from(expected);
      const receivedBuf = Buffer.from(received);
      if (
        expectedBuf.length !== receivedBuf.length ||
        !timingSafeEqual(expectedBuf, receivedBuf)
      ) {
        throw new UnauthorizedException('Invalid admin API key');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid admin API key');
    }

    return true;
  }
}

