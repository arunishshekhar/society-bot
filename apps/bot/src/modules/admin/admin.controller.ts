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
} from "@nestjs/common";
import { InjectBot } from "nestjs-telegraf";
import { Telegraf } from "telegraf";
import { AdminApiKeyGuard } from "./admin-api-key.guard";
import { AdminService } from "./admin.service";
import { BotContext } from "../../types/bot-context";

@Controller("admin")
@UseGuards(AdminApiKeyGuard)
export class AdminController {
	constructor(
		private readonly admin: AdminService,
		@InjectBot() private readonly bot: Telegraf<BotContext>,
	) {}

	@Get("health")
	health() {
		return { status: "ok" };
	}
	@Get("residents")
	residents(@Query("search") search?: string) {
		return this.admin.residents(search);
	}

	@Get("residents/:id")
	resident(@Param("id") id: string) {
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
		return this.admin.updateResident(id, body);
	}

	@Get("vehicles/lookup")
	lookup(@Query("plate") plate = "") {
		return this.admin.vehicleLookup(plate);
	}

	@Get("workers")
	workers(@Query("category") category?: string) {
		return this.admin.workers(category);
	}

	@Delete("workers/:id")
	deleteWorker(@Param("id") id: string) {
		return this.admin.deleteWorker(id);
	}

	@Patch("workers/:id/ban")
	banWorker(@Param("id") id: string) {
		return this.admin.banWorker(id);
	}

	@Get("services")
	services() {
		return this.admin.services();
	}

	@Patch("services/:id/disable")
	disableService(
		@Param("id") id: string,
		@Body() body: { isDisabled?: boolean },
	) {
		return this.admin.disableService(id, body.isDisabled ?? true);
	}

	@Get("carpool")
	carpool() {
		return this.admin.carpool();
	}

	@Delete("carpool/:id")
	deleteCarpool(@Param("id") id: string) {
		return this.admin.deleteCarpool(id);
	}

	@Post("broadcast")
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
		await this.admin.logBroadcast(
			body.message,
			body.sentBy ?? "admin",
			sent,
		);
		return { recipientCount: sent };
	}

	@Get("analytics")
	analytics() {
		return this.admin.analytics();
	}
}
