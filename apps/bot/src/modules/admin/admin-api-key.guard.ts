import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const received = request.headers['x-admin-api-key'];

    if (!expected || received !== expected) {
      throw new UnauthorizedException('Invalid admin API key');
    }

    return true;
  }
}
