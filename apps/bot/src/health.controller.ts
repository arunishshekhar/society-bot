import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  // Render pings /health every 5s — do NOT log here or it floods the output
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('admin/health')
  adminHealth() {
    return { status: 'ok' };
  }
}
