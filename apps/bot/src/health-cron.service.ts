import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class HealthCronService {
  private readonly logger = new Logger(HealthCronService.name);

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    // If webhook domain is defined, use it. Otherwise use localhost.
    let baseUrl = process.env.WEBHOOK_DOMAIN || `http://localhost:${process.env.PORT || 3001}`;
    if (process.env.WEBHOOK_DOMAIN && !process.env.WEBHOOK_DOMAIN.startsWith('http')) {
      baseUrl = `https://${process.env.WEBHOOK_DOMAIN}`;
    }
      
    try {
      const response = await axios.get(`${baseUrl}/health`);
      this.logger.debug(`Health check ping successful: ${response.status}`);
    } catch (error: any) {
      this.logger.error(`Health check ping failed: ${error?.message}`);
    }
  }
}
