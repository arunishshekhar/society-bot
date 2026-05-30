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
import { LostFoundService } from "../lost-found/lost-found.service";

@Controller("admin")
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly admin: AdminService,
    private readonly lostFound: LostFoundService,
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
  @Get("broadcast")
  broadcasts() {
    this.logger.log("GET /admin/broadcast");
    return this.admin.broadcasts();
  }
  @Post("ping-unregistered")
  async pingUnregistered() {
    this.logger.log("POST /admin/ping-unregistered");
    const groupId = process.env.TELEGRAM_GROUP_ID;
    if (!groupId) {
      throw new Error("TELEGRAM_GROUP_ID is not configured");
    }

    const unregistered = await this.admin.unregisteredResidents();
    const mentions: string[] = [];
    const chatId = /^-?\d+$/.test(groupId) ? Number(groupId) : groupId;

    const escapeMarkdown = (s: string) =>
      s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

    for (const resident of unregistered) {
      try {
        // Only ping if they are actually in the group
        const member = await this.bot.telegram.getChatMember(chatId, Number(resident.telegramId));
        if (member.status === "member" || member.status === "restricted" || member.status === "creator" || member.status === "administrator") {
          const name = escapeMarkdown(resident.name || "Resident");
          mentions.push(`[${name}](tg://user?id=${resident.telegramId})`);
        }
      } catch {
        // Skip if bot doesn't have permission or user not in group
      }
    }

    if (mentions.length === 0) {
      return { recipientCount: 0 };
    }

    const botUsername = this.bot.botInfo?.username ?? 'the Society Bot';
    const message = `👋 Welcome to the Society!\n\nWe noticed some of you haven't completed your registration with the Society Bot yet.\n\nPlease start a private chat with @${botUsername} and send /start to complete your registration and access all society services!\n\n${mentions.join(", ")}`;

    await this.bot.telegram.sendMessage(chatId, message, { parse_mode: "Markdown" });
    
    // Log it as a broadcast
    await this.admin.logBroadcast("Pinged unregistered members", "dashboard", mentions.length);

    return { recipientCount: mentions.length };
  }

  @Post("broadcast")
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: 5 * 1024 * 1024 } }))
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

    const imageBuffer = file && file.size > 0 ? file.buffer : null;

    let sent = 0;
    let useMarkdown = true;
    for (const resident of residents) {
      try {
        if (useMarkdown) {
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
        } else {
          if (imageBuffer) {
            await this.bot.telegram.sendPhoto(
              Number(resident.telegramId),
              { source: imageBuffer },
              { caption: `Society Notice\n\n${message}` }
            );
          } else {
            await this.bot.telegram.sendMessage(
              Number(resident.telegramId),
              `Society Notice\n\n${message}`
            );
          }
          sent += 1;
        }
      } catch (error: any) {
        this.logger.error(`Broadcast failed for ${resident.telegramId}: ${error.message || error}`);
        if (useMarkdown && error.response?.description?.includes("can't parse entities")) {
          useMarkdown = false;
          try {
            if (imageBuffer) {
              await this.bot.telegram.sendPhoto(
                Number(resident.telegramId),
                { source: imageBuffer },
                { caption: `Society Notice\n\n${message}` }
              );
            } else {
              await this.bot.telegram.sendMessage(
                Number(resident.telegramId),
                `Society Notice\n\n${message}`
              );
            }
            sent += 1;
          } catch (fallbackError: any) {
            this.logger.error(`Fallback failed for ${resident.telegramId}: ${fallbackError.message || fallbackError}`);
          }
        }
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

  // ── Lost & Found ───────────────────────────────────────────
  @Get("lost-found/found")
  foundItems(@Query("status") status?: string) {
    this.logger.log(`GET /admin/lost-found/found status=${status ?? "all"}`);
    return this.admin.foundItems(status);
  }

  @Get("lost-found/found/:id")
  foundItem(@Param("id") id: string) {
    this.logger.log(`GET /admin/lost-found/found/${id}`);
    return this.admin.foundItem(id);
  }

  @Patch("lost-found/found/:id/resolve")
  resolveFoundItem(@Param("id") id: string) {
    this.logger.log(`PATCH /admin/lost-found/found/${id}/resolve`);
    return this.admin.resolveFoundItem(id);
  }

  @Delete("lost-found/found/:id")
  deleteFoundItem(@Param("id") id: string) {
    this.logger.log(`DELETE /admin/lost-found/found/${id}`);
    return this.admin.deleteFoundItem(id);
  }

  @Get("lost-found/lost")
  lostItems(@Query("status") status?: string) {
    this.logger.log(`GET /admin/lost-found/lost status=${status ?? "all"}`);
    return this.admin.lostItems(status);
  }

  @Get("lost-found/lost/:id")
  lostItem(@Param("id") id: string) {
    this.logger.log(`GET /admin/lost-found/lost/${id}`);
    return this.admin.lostItem(id);
  }

  @Patch("lost-found/lost/:id/resolve")
  resolveLostItem(@Param("id") id: string) {
    this.logger.log(`PATCH /admin/lost-found/lost/${id}/resolve`);
    return this.admin.resolveLostItem(id);
  }

  @Delete("lost-found/lost/:id")
  deleteLostItem(@Param("id") id: string) {
    this.logger.log(`DELETE /admin/lost-found/lost/${id}`);
    return this.admin.deleteLostItem(id);
  }

  @Get("lost-found/matches")
  lostFoundMatches() {
    this.logger.log("GET /admin/lost-found/matches");
    return this.admin.lostFoundMatches();
  }

  @Post("lost-found/reprocess")
  async reprocessLostFound() {
    this.logger.log("POST /admin/lost-found/reprocess");
    // Fetch all open found items and re-scan each against open lost reports.
    // Does NOT re-run AI description generation — only the search/matching step.
    const foundItems = await this.admin.foundItems("OPEN");
    let notified = 0;
    for (const item of foundItems) {
      await this.lostFound.scanAndNotifyLostReporters(item);
      notified++;
    }
    // Also scan in reverse: each open lost item against all open found items.
    const lostItems = await this.admin.lostItems("OPEN");
    for (const item of lostItems) {
      await this.lostFound.scanAndNotifyFoundItems(item as any);
    }
    return {
      message: `Reprocessed ${foundItems.length} found item(s) and ${lostItems.length} lost item(s). New notifications sent: check bot logs.`,
      foundProcessed: foundItems.length,
      lostProcessed: lostItems.length,
    };
  }

  // ── Analytics ──────────────────────────────────────────────
  @Get("analytics")
  analytics() {
    this.logger.log("GET /admin/analytics");
    return this.admin.analytics();
  }
}
