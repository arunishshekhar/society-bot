import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { InjectBot } from "nestjs-telegraf";
import { Telegraf } from "telegraf";
import { AdminApiKeyGuard } from "./admin-api-key.guard";
import { AdminService } from "./admin.service";
import { BotContext } from "../../types/bot-context";

@Controller("admin")
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly admin: AdminService,
    @InjectBot() private readonly bot: Telegraf<BotContext>,
  ) {}

  // ── Residents ─────────────────────────────────────────────
  @Get("residents")
  residents(@Query("search") search?: string) {
    this.logger.log(`GET /admin/residents search=${search ?? ""}`);
    return this.admin.residents(search);
  }

  @Get("residents/:id")
  resident(@Param("id") id: string) {
    this.logger.log(`GET /admin/residents/${id}`);
    return this.admin.resident(id);
  }

  @Patch("residents/:id")
  updateResident(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      flatNumber?: string;
      phone?: string | null;
      isActive?: boolean;
    },
  ) {
    this.logger.log(`PATCH /admin/residents/${id}`);
    return this.admin.updateResident(id, body);
  }

  @Delete("residents/:id")
  deleteResident(@Param("id") id: string) {
    this.logger.log(`DELETE /admin/residents/${id}`);
    return this.admin.deleteResident(id);
  }

  // ── Vehicles ───────────────────────────────────────────────
  @Get("vehicles/lookup")
  lookup(@Query("plate") plate = "") {
    this.logger.log(`GET /admin/vehicles/lookup plate=${plate}`);
    return this.admin.vehicleLookup(plate);
  }

  // ── Workers ────────────────────────────────────────────────
  @Get("workers")
  workers(@Query("category") category?: string) {
    this.logger.log(`GET /admin/workers category=${category ?? ""}`);
    return this.admin.workers(category);
  }

  @Post("workers")
  createWorker(
    @Body()
    body: {
      name: string;
      phone: string;
      category: string;
      rating?: number | null;
      notes?: string | null;
    },
  ) {
    this.logger.log(`POST /admin/workers name=${body.name}`);
    return this.admin.createWorker(body);
  }

  @Patch("workers/:id")
  updateWorker(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      category?: string;
      rating?: number | null;
      notes?: string | null;
      isActive?: boolean;
    },
  ) {
    this.logger.log(`PATCH /admin/workers/${id}`);
    return this.admin.updateWorker(id, body);
  }

  @Delete("workers/:id")
  deleteWorker(@Param("id") id: string) {
    this.logger.log(`DELETE /admin/workers/${id}`);
    return this.admin.deleteWorker(id);
  }

  @Patch("workers/:id/ban")
  banWorker(@Param("id") id: string) {
    return this.admin.banWorker(id);
  }

  @Patch("workers/:id/unban")
  unbanWorker(@Param("id") id: string) {
    return this.admin.unbanWorker(id);
  }

  // ── Services ───────────────────────────────────────────────
  @Get("services")
  services() {
    this.logger.log("GET /admin/services");
    return this.admin.services();
  }

  @Post("services")
  createService(
    @Body()
    body: {
      name: string;
      category: string;
      description?: string | null;
      timing?: string;
      contactPreference?: string;
    },
  ) {
    this.logger.log(`POST /admin/services name=${body.name}`);
    return this.admin.createService(body);
  }

  @Patch("services/:id")
  updateService(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      category?: string;
      description?: string | null;
      isDisabled?: boolean;
      isPaused?: boolean;
    },
  ) {
    this.logger.log(`PATCH /admin/services/${id}`);
    return this.admin.updateService(id, body);
  }

  @Patch("services/:id/disable")
  disableService(
    @Param("id") id: string,
    @Body() body: { isDisabled?: boolean },
  ) {
    this.logger.log(
      `PATCH /admin/services/${id}/disable isDisabled=${body.isDisabled ?? true}`,
    );
    return this.admin.disableService(id, body.isDisabled ?? true);
  }

  @Delete("services/:id")
  deleteService(@Param("id") id: string) {
    this.logger.log(`DELETE /admin/services/${id}`);
    return this.admin.deleteService(id);
  }

  // ── Carpool ────────────────────────────────────────────────
  @Get("carpool")
  carpool() {
    this.logger.log("GET /admin/carpool");
    return this.admin.carpool();
  }

  @Patch("carpool/:id")
  updateCarpool(
    @Param("id") id: string,
    @Body()
    body: {
      destination?: string;
      departureTime?: string;
      returnTime?: string | null;
      seatsAvailable?: number;
      isPaused?: boolean;
    },
  ) {
    this.logger.log(`PATCH /admin/carpool/${id}`);
    return this.admin.updateCarpool(id, body);
  }

  @Delete("carpool/:id")
  deleteCarpool(@Param("id") id: string) {
    this.logger.log(`DELETE /admin/carpool/${id}`);
    return this.admin.deleteCarpool(id);
  }

  // ── Categories ─────────────────────────────────────────────
  @Get("categories")
  categories(@Query("type") type?: string) {
    this.logger.log(`GET /admin/categories type=${type ?? ""}`);
    return this.admin.categories(type);
  }

  @Post("categories")
  createCategory(@Body() body: { name: string; type: string }) {
    this.logger.log(
      `POST /admin/categories name=${body.name} type=${body.type}`,
    );
    return this.admin.createCategory(body.name, body.type);
  }

  @Delete("categories/:id")
  deleteCategory(@Param("id") id: string) {
    this.logger.log(`DELETE /admin/categories/${id}`);
    return this.admin.deleteCategory(id);
  }

  // ── Broadcast ──────────────────────────────────────────────
  @Post("broadcast")
  @UseInterceptors(FileInterceptor("image"))
  async broadcast(
    @Body("message") message: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body("sentBy") sentBy?: string,
  ) {
    this.logger.log(
      `POST /admin/broadcast sentBy=${sentBy ?? "admin"} image=${!!file}`,
    );
    const residents = await this.admin.activeResidents();
    this.logger.log(`Broadcast target: ${residents.length} active residents`);

    const imageBuffer = file?.buffer ?? null;

    let sent = 0;
    for (const resident of residents) {
      try {
        if (imageBuffer) {
          await this.bot.telegram.sendPhoto(
            Number(resident.telegramId),
            { source: imageBuffer },
            {
              caption: `Society Notice\n\n${message}`,
              parse_mode: "MarkdownV2",
            },
          );
        } else {
          await this.bot.telegram.sendMessage(
            Number(resident.telegramId),
            `Society Notice\n\n${message}`,
            { parse_mode: "MarkdownV2" },
          );
        }
        sent += 1;
      } catch {
        // Keep broadcasting to remaining residents.
      }
    }
    await this.admin.logBroadcast(message, sentBy ?? "admin", sent);
    this.logger.log(`Broadcast complete: sent=${sent}/${residents.length}`);
    return { recipientCount: sent };
  }

  // ── FAQs ───────────────────────────────────────────────────
  @Get("faqs")
  faqs() {
    this.logger.log("GET /admin/faqs");
    return this.admin.faqs();
  }

  @Post("faqs")
  createFaq(@Body() body: { question: string; answer: string }) {
    this.logger.log(`POST /admin/faqs question=${body.question}`);
    return this.admin.createFaq(body);
  }

  @Patch("faqs/:id")
  updateFaq(
    @Param("id") id: string,
    @Body() body: { question?: string; answer?: string },
  ) {
    this.logger.log(`PATCH /admin/faqs/${id}`);
    return this.admin.updateFaq(id, body);
  }

  @Delete("faqs/:id")
  deleteFaq(@Param("id") id: string) {
    this.logger.log(`DELETE /admin/faqs/${id}`);
    return this.admin.deleteFaq(id);
  }

  // ── Analytics ──────────────────────────────────────────────
  @Get("analytics")
  analytics() {
    this.logger.log("GET /admin/analytics");
    return this.admin.analytics();
  }
}
