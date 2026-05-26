import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // Also serve /admin/health without auth so Render's configured health check path works
  @Get('admin/health')
  adminHealth() {
    return { status: 'ok' };
  }
}
