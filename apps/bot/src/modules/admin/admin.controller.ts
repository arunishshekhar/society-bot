import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { AdminService } from './admin.service';
import { BotContext } from '../../types/bot-context';

@Controller('admin')
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    @InjectBot() private readonly bot: Telegraf<BotContext>,
  ) {}

  // ── Residents ─────────────────────────────────────────────
  @Get('residents')
  residents(@Query('search') search?: string) {
    return this.admin.residents(search);
  }

  @Get('residents/:id')
  resident(@Param('id') id: string) {
    return this.admin.resident(id);
  }

  @Patch('residents/:id')
  updateResident(
    @Param('id') id: string,
    @Body() body: { name?: string; flatNumber?: string; phone?: string | null; isActive?: boolean },
  ) {
    return this.admin.updateResident(id, body);
  }

  @Delete('residents/:id')
  deleteResident(@Param('id') id: string) {
    return this.admin.deleteResident(id);
  }

  // ── Vehicles ───────────────────────────────────────────────
  @Get('vehicles/lookup')
  lookup(@Query('plate') plate = '') {
    return this.admin.vehicleLookup(plate);
  }

  // ── Workers ────────────────────────────────────────────────
  @Get('workers')
  workers(@Query('category') category?: string) {
    return this.admin.workers(category);
  }

  @Post('workers')
  createWorker(@Body() body: { name: string; phone: string; category: string; rating?: number | null; notes?: string | null }) {
    return this.admin.createWorker(body);
  }

  @Patch('workers/:id')
  updateWorker(
    @Param('id') id: string,
    @Body() body: { name?: string; phone?: string; category?: string; rating?: number | null; notes?: string | null; isActive?: boolean },
  ) {
    return this.admin.updateWorker(id, body);
  }

  @Delete('workers/:id')
  deleteWorker(@Param('id') id: string) {
    return this.admin.deleteWorker(id);
  }

  @Patch('workers/:id/ban')
  banWorker(@Param('id') id: string) {
    return this.admin.banWorker(id);
  }

  @Patch('workers/:id/unban')
  unbanWorker(@Param('id') id: string) {
    return this.admin.unbanWorker(id);
  }

  // ── Services ───────────────────────────────────────────────
  @Get('services')
  services() {
    return this.admin.services();
  }

  @Post('services')
  createService(@Body() body: { name: string; category: string; description?: string | null; timing?: string; contactPreference?: string }) {
    return this.admin.createService(body);
  }

  @Patch('services/:id')
  updateService(
    @Param('id') id: string,
    @Body() body: { name?: string; category?: string; description?: string | null; isDisabled?: boolean; isPaused?: boolean },
  ) {
    return this.admin.updateService(id, body);
  }

  @Patch('services/:id/disable')
  disableService(@Param('id') id: string, @Body() body: { isDisabled?: boolean }) {
    return this.admin.disableService(id, body.isDisabled ?? true);
  }

  @Delete('services/:id')
  deleteService(@Param('id') id: string) {
    return this.admin.deleteService(id);
  }

  // ── Carpool ────────────────────────────────────────────────
  @Get('carpool')
  carpool() {
    return this.admin.carpool();
  }

  @Patch('carpool/:id')
  updateCarpool(
    @Param('id') id: string,
    @Body() body: { destination?: string; departureTime?: string; returnTime?: string | null; seatsAvailable?: number; isPaused?: boolean },
  ) {
    return this.admin.updateCarpool(id, body);
  }

  @Delete('carpool/:id')
  deleteCarpool(@Param('id') id: string) {
    return this.admin.deleteCarpool(id);
  }

  // ── Categories ─────────────────────────────────────────────
  @Get('categories')
  categories(@Query('type') type?: string) {
    return this.admin.categories(type);
  }

  @Post('categories')
  createCategory(@Body() body: { name: string; type: string }) {
    return this.admin.createCategory(body.name, body.type);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.admin.deleteCategory(id);
  }

  // ── Broadcast ──────────────────────────────────────────────
  @Post('broadcast')
  async broadcast(@Body() body: { message: string; sentBy?: string }) {
    const residents = await this.admin.activeResidents();
    let sent = 0;
    for (const resident of residents) {
      try {
        await this.bot.telegram.sendMessage(
          Number(resident.telegramId),
          `Society Notice\n\n${body.message}`,
        );
        sent += 1;
      } catch {
        // Keep broadcasting to remaining residents.
      }
    }
    await this.admin.logBroadcast(body.message, body.sentBy ?? 'admin', sent);
    return { recipientCount: sent };
  }

  // ── Analytics ──────────────────────────────────────────────
  @Get('analytics')
  analytics() {
    return this.admin.analytics();
  }
}
