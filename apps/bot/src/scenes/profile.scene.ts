import { UseGuards } from "@nestjs/common";
import { Action, Command, Ctx, On, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../guards/group-member.guard";
import { mainMenuKeyboard } from "../keyboards/main-menu.keyboard";
import { SearchService } from "../modules/search/search.service";
import { PrismaService } from "../prisma/prisma.service";
import { BotContext } from "../types/bot-context";
import {
  isValidFlatNumber,
  isValidName,
  normalizeFlatNumber,
} from "../utils/validation";

@Scene("profile")
@UseGuards(GroupMemberGuard)
export class ProfileScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    ctx.session.profile = {};
    await this.showProfile(ctx);
  }

  @Action("profile:edit_name")
  async editName(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.profile = { editing: "name" };
    await ctx.reply("Enter your updated name.");
  }

  @Action("profile:edit_flat")
  async editFlat(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.profile = { editing: "flatNumber" };
    await ctx.reply(
      "Enter your updated flat number. Pattern: Tower-Floor-Unit (e.g., 03-12-03)",
    );
  }

  @Action("profile:edit_phone")
  async editPhone(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.profile = { editing: "phone" };
    await ctx.reply(
      "Enter your updated phone number.",
      Markup.inlineKeyboard([
        [Markup.button.callback("Clear phone", "profile:clear_phone")],
      ]),
    );
  }

  @Action("profile:clear_phone")
  async clearPhone(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.updateResident(ctx, { phone: null });
    ctx.session.profile = {};
    await ctx.reply("Phone number cleared.");
    await this.showProfile(ctx);
  }

  @Action("menu:back")
  async back(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    await ctx.reply("Society Bot", mainMenuKeyboard());
  }

  @Command(["ask", "menu", "exit"])
  async onAskCommand(@Ctx() ctx: BotContext) {
    const text = (ctx.message as { text?: string })?.text ?? "";

    if (text.startsWith("/menu") || text.startsWith("/exit")) {
      await ctx.scene.leave();
      await ctx.reply("Society Bot", mainMenuKeyboard());
      return;
    }

    const query = text.replace(/^\/ask\s*/i, "").trim();
    await ctx.scene.leave();
    await this.searchService.handleAsk(ctx, query);
  }

  @On("text")
  async onText(@Ctx() ctx: BotContext) {
    const field = ctx.session.profile?.editing;
    const text = ctx.text?.trim();

    if (!field || !text) {
      await this.showProfile(ctx);
      return;
    }

    if (field === "name" && !isValidName(text)) {
      await ctx.reply("Please enter a name between 2 and 80 characters.");
      return;
    }

    if (field === "flatNumber" && !isValidFlatNumber(text)) {
      await ctx.reply(
        "Please enter a valid flat number. Pattern: Tower-Floor-Unit (e.g., 03-12-03).",
      );
      return;
    }

    // Whitelist defence — prevent session tampering from writing isActive etc.
    const EDITABLE: Array<"name" | "flatNumber" | "phone"> = ["name", "flatNumber", "phone"];
    if (!EDITABLE.includes(field as any)) {
      await this.showProfile(ctx);
      return;
    }

    await this.updateResident(ctx, {
      [field]: field === "flatNumber" ? normalizeFlatNumber(text) : text,
    });
    ctx.session.profile = {};
    await ctx.reply("Profile updated.");
    await this.showProfile(ctx);
  }

  private async showProfile(ctx: BotContext) {
    const resident = await this.getResident(ctx);

    if (!resident) {
      await ctx.scene.enter("onboarding");
      return;
    }

    await ctx.reply(
      [
        "My Profile",
        "",
        `Name: ${resident.name}`,
        `Flat: ${resident.flatNumber}`,
        `Phone: ${resident.phone ? (resident.phone.startsWith('+') ? resident.phone : '+91' + resident.phone) : "Not set"}`,
      ].join("\n"),
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Edit Name", "profile:edit_name"),
          Markup.button.callback("Edit Flat", "profile:edit_flat"),
        ],
        [Markup.button.callback("Edit Phone", "profile:edit_phone")],
        [Markup.button.callback("Back", "menu:back")],
      ]),
    );
  }

  private async getResident(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return null;

    return this.prisma.resident.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
  }

  private async updateResident(
    ctx: BotContext,
    data: { name?: string; flatNumber?: string; phone?: string | null },
  ) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    await this.prisma.resident.update({
      where: { telegramId: BigInt(telegramId) },
      data,
    });
  }
}
