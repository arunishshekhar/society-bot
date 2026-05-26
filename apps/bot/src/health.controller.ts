import { Controller, Get, Logger } from '@nestjs/common';

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get('health')
  health() {
    this.logger.log('GET /health — backend is alive');
    return { status: 'ok' };
  }

  // Also serve /admin/health without auth so Render's configured health check path works
  @Get('admin/health')
  adminHealth() {
    this.logger.log('GET /admin/health — backend is alive');
    return { status: 'ok' };
  }
}
