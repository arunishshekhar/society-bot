import { UseGuards } from "@nestjs/common";
import { Action, Command, Ctx, On, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../guards/group-member.guard";
import { mainMenuKeyboard } from "../keyboards/main-menu.keyboard";
import {
  buildServiceMetadata,
  readServiceMetadata,
  ServiceContactPreference,
} from "../modules/microservices/service-metadata";
import { SearchService } from "../modules/search/search.service";
import { PrismaService } from "../prisma/prisma.service";
import { BotContext } from "../types/bot-context";
import { getCallbackData } from "../utils/callback-data";

const serviceCategories = ["food", "tutoring", "laundry", "tailoring", "other"];

@Scene("microservices")
@UseGuards(GroupMemberGuard)
export class MicroServiceScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    ctx.session.microServices = {};
    await this.showHome(ctx);
  }

  @Action("services:list_mine")
  async listMine(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.showMine(ctx);
  }

  @Action("services:create")
  async create(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.microServices = { mode: "creating", step: "name", draft: {} };
    await ctx.reply("Enter the service name. Example: Priya Home Kitchen");
  }

  @Action("services:browse")
  async browse(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.showCategoryFilter(ctx);
  }

  @Action(/services:category:.+/)
  async browseCategory(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const category =
      getCallbackData(ctx)?.split(":").slice(2).join(":") ?? "all";
    ctx.session.microServices = { mode: "browsing", browseCategory: category };
    await this.showBrowseResults(ctx);
  }

  @Action(/services:set_category:.+/)
  async setCategory(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const category = getCallbackData(ctx)?.split(":").slice(2).join(":");
    const state = ctx.session.microServices;
    if (!category || !state?.mode) return;

    if (state.mode === "editing" && state.editField === "category") {
      await this.updateOwnService(ctx, { category });
      await ctx.reply("Service updated.");
      await this.showMine(ctx);
      return;
    }

    ctx.session.microServices = {
      ...state,
      step: "description",
      draft: { ...state.draft, category },
    };
    await ctx.reply(
      "Enter a short description, or skip.",
      Markup.inlineKeyboard([
        [Markup.button.callback("Skip", "services:skip_description")],
      ]),
    );
  }

  @Action("services:skip_description")
  async skipDescription(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const state = ctx.session.microServices;

    if (state?.mode === "editing" && state.editField === "description") {
      await this.updateOwnService(ctx, { description: null });
      await ctx.reply("Description cleared.");
      await this.showMine(ctx);
      return;
    }

    ctx.session.microServices = {
      ...state,
      step: "timing",
      draft: { ...state?.draft, description: null },
    };
    await ctx.reply("Enter availability timing. Example: Mon-Fri, 12-2pm");
  }

  @Action(/services:contact_pref:.+/)
  async setContactPreference(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const preference = getCallbackData(ctx)?.split(":").at(-1);
    if (preference !== "phone" && preference !== "telegram") return;

    const state = ctx.session.microServices;
    if (!state?.mode) return;

    if (state.mode === "editing" && state.editField === "contactPreference") {
      const current = await this.getOwnService(ctx);
      const currentMetadata = current
        ? readServiceMetadata(current.metadata)
        : { timing: undefined };
      await this.updateOwnService(ctx, {
        metadata: buildServiceMetadata(
          currentMetadata.timing ?? "",
          preference,
        ),
      });
      await ctx.reply("Contact preference updated.");
      await this.showMine(ctx);
      return;
    }

    ctx.session.microServices = {
      ...state,
      draft: { ...state.draft, contactPreference: preference },
    };
    await this.saveDraft(ctx);
  }

  @Action(/services:edit:.+/)
  async edit(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const field = getCallbackData(ctx)?.split(":").at(-1);
    if (!this.isEditField(field)) {
      await this.showMine(ctx);
      return;
    }

    ctx.session.microServices = {
      mode: "editing",
      editField: field,
      step:
        field === "category" || field === "contactPreference" ? field : "field",
    };

    if (field === "category") {
      await this.promptCategories(ctx, "services:set_category");
      return;
    }

    if (field === "contactPreference") {
      await this.promptContactPreference(ctx);
      return;
    }

    if (field === "description") {
      await ctx.reply(
        "Enter updated description, or clear it.",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Clear description",
              "services:skip_description",
            ),
          ],
        ]),
      );
      return;
    }

    await ctx.reply(`Enter updated ${this.fieldLabel(field)}.`);
  }

  @Action("services:toggle_pause")
  async togglePause(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const service = await this.getOwnService(ctx);
    if (!service) {
      await this.showMine(ctx);
      return;
    }

    await this.prisma.microService.update({
      where: { id: service.id },
      data: { isPaused: !service.isPaused },
    });
    await ctx.reply(service.isPaused ? "Service resumed." : "Service paused.");
    await this.showMine(ctx);
  }

  @Action("services:delete")
  async confirmDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.reply(
      "Delete your service listing?",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Delete", "services:delete_confirm"),
          Markup.button.callback("Cancel", "services:list_mine"),
        ],
      ]),
    );
  }

  @Action("services:delete_confirm")
  async delete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const service = await this.getOwnService(ctx);
    if (service) {
      await this.prisma.microService.delete({ where: { id: service.id } });
    }
    await ctx.reply("Service listing deleted.");
    await this.showHome(ctx);
  }

  @Action(/services:contact:.+/)
  async contact(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(":").at(-1);
    if (!id) return;

    const service = await this.prisma.microService.findFirst({
      where: {
        id,
        isPaused: false,
        isDisabled: false,
        resident: { isActive: true },
      },
      include: { resident: true },
    });
    if (!service) return;

    const metadata = readServiceMetadata(service.metadata);
    const contact =
      metadata.contactPreference === "phone"
        ? (service.resident?.phone ? `[${service.resident.phone}](tel:${service.resident.phone.replace(/[^0-9+]/g, '')})` : "Phone not available")
        : service.resident?.telegramUsername
          ? `@${service.resident.telegramUsername}`
          : service.resident
            ? `Telegram ID: ${service.resident.telegramId.toString()}`
            : "Contact via admin";

    await ctx.reply(
      [
        `*${service.name}*`,
        `Flat: ${service.resident?.flatNumber ?? "Admin"}`,
        `Contact: ${contact}`,
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  }

  @Action("services:home")
  async home(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.showHome(ctx);
  }

  @Action("menu:back")
  async backToMenu(@Ctx() ctx: BotContext) {
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
    const state = ctx.session.microServices;
    const text = ctx.text?.trim();
    if (!state?.mode || !state.step || !text) {
      await this.showHome(ctx);
      return;
    }

    if (state.mode === "editing" && state.editField) {
      if (state.editField === "timing") {
        const current = await this.getOwnService(ctx);
        const preference = current
          ? readServiceMetadata(current.metadata).contactPreference
          : "telegram";
        await this.updateOwnService(ctx, {
          metadata: buildServiceMetadata(text, preference),
        });
      } else {
        await this.updateOwnService(ctx, { [state.editField]: text });
      }
      await ctx.reply("Service updated.");
      await this.showMine(ctx);
      return;
    }

    if (state.step === "name") {
      if (text.length < 2 || text.length > 80) {
        await ctx.reply(
          "Please enter a service name between 2 and 80 characters.",
        );
        return;
      }

      ctx.session.microServices = {
        ...state,
        step: "category",
        draft: { ...state.draft, name: text },
      };
      await this.promptCategories(ctx, "services:set_category");
      return;
    }

    if (state.step === "description") {
      ctx.session.microServices = {
        ...state,
        step: "timing",
        draft: { ...state.draft, description: text },
      };
      await ctx.reply("Enter availability timing. Example: Mon-Fri, 12-2pm");
      return;
    }

    if (state.step === "timing") {
      ctx.session.microServices = {
        ...state,
        step: "contactPreference",
        draft: { ...state.draft, timing: text },
      };
      await this.promptContactPreference(ctx);
    }
  }

  private async showHome(ctx: BotContext) {
    ctx.session.microServices = {};
    await ctx.reply(
      "Services",
      Markup.inlineKeyboard([
        [Markup.button.callback("My Service", "services:list_mine")],
        [Markup.button.callback("Browse Services", "services:browse")],
        [Markup.button.callback("Back", "menu:back")],
      ]),
    );
  }

  private async showMine(ctx: BotContext) {
    const service = await this.getOwnService(ctx);

    if (!service) {
      await ctx.reply(
        "You do not have a service listing yet.",
        Markup.inlineKeyboard([
          [Markup.button.callback("List My Service", "services:create")],
          [Markup.button.callback("Back", "services:home")],
        ]),
      );
      return;
    }

    const metadata = readServiceMetadata(service.metadata);
    await ctx.reply(
      [
        `${service.name} - ${this.title(service.category)}`,
        `Status: ${service.isDisabled ? "Disabled by admin" : service.isPaused ? "Paused" : "Active"}`,
        `Description: ${service.description ?? "Not set"}`,
        `Timing: ${metadata.timing ?? "Not set"}`,
        `Contact: ${metadata.contactPreference}`,
      ].join("\n"),
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Edit Name", "services:edit:name"),
          Markup.button.callback("Edit Category", "services:edit:category"),
        ],
        [
          Markup.button.callback(
            "Edit Description",
            "services:edit:description",
          ),
          Markup.button.callback("Edit Timing", "services:edit:timing"),
        ],
        [
          Markup.button.callback(
            "Edit Contact",
            "services:edit:contactPreference",
          ),
        ],
        [
          Markup.button.callback(
            service.isPaused ? "Resume" : "Pause",
            "services:toggle_pause",
          ),
        ],
        [Markup.button.callback("Delete", "services:delete")],
        [Markup.button.callback("Back", "services:home")],
      ]),
    );
  }

  private async showCategoryFilter(ctx: BotContext) {
    await ctx.reply(
      "Choose a category.",
      Markup.inlineKeyboard([
        [Markup.button.callback("All", "services:category:all")],
        ...serviceCategories.map((category) => [
          Markup.button.callback(
            this.title(category),
            `services:category:${category}`,
          ),
        ]),
        [Markup.button.callback("Back", "services:home")],
      ]),
    );
  }

  private async showBrowseResults(ctx: BotContext) {
    const category = ctx.session.microServices?.browseCategory ?? "all";
    const services = await this.prisma.microService.findMany({
      where: {
        isPaused: false,
        isDisabled: false,
        ...(category === "all" ? {} : { category }),
      },
      include: { resident: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (!services.length) {
      await ctx.reply(
        "No services found for that category.",
        this.backToServicesKeyboard(),
      );
      return;
    }

    for (const service of services) {
      const metadata = readServiceMetadata(service.metadata);
      await ctx.reply(
        [
          service.name,
          `${this.title(service.category)} | ${service.resident?.flatNumber ?? "Admin"}`,
          metadata.timing,
          service.description,
        ]
          .filter(Boolean)
          .join("\n"),
        Markup.inlineKeyboard([
          [Markup.button.callback("Contact", `services:contact:${service.id}`)],
        ]),
      );
    }

    await ctx.reply("End of results.", this.backToServicesKeyboard());
  }

  private async saveDraft(ctx: BotContext) {
    const resident = await this.getResident(ctx);
    const draft = ctx.session.microServices?.draft;

    if (
      !resident ||
      !draft?.name ||
      !draft.category ||
      !draft.timing ||
      !draft.contactPreference
    ) {
      await ctx.reply("Service details are incomplete. Please start again.");
      await this.showHome(ctx);
      return;
    }

    await this.prisma.microService.upsert({
      where: { residentId: resident.id },
      create: {
        residentId: resident.id,
        name: draft.name,
        category: draft.category,
        description: draft.description,
        metadata: buildServiceMetadata(draft.timing, draft.contactPreference),
      },
      update: {
        name: draft.name,
        category: draft.category,
        description: draft.description,
        metadata: buildServiceMetadata(draft.timing, draft.contactPreference),
        isPaused: false,
      },
    });

    await ctx.reply("Service listing saved.");
    await this.showMine(ctx);
  }

  private async getResident(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return null;
    return this.prisma.resident.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
  }

  private async getOwnService(ctx: BotContext) {
    const resident = await this.getResident(ctx);
    if (!resident) return null;
    return this.prisma.microService.findUnique({
      where: { residentId: resident.id },
    });
  }

  private async updateOwnService(
    ctx: BotContext,
    data: {
      name?: string;
      category?: string;
      description?: string | null;
      metadata?: ReturnType<typeof buildServiceMetadata>;
    },
  ) {
    const service = await this.getOwnService(ctx);
    if (!service) return;
    await this.prisma.microService.update({ where: { id: service.id }, data });
  }

  private promptCategories(ctx: BotContext, prefix: string) {
    return ctx.reply(
      "Choose a category.",
      Markup.inlineKeyboard(
        serviceCategories.map((category) => [
          Markup.button.callback(this.title(category), `${prefix}:${category}`),
        ]),
      ),
    );
  }

  private promptContactPreference(ctx: BotContext) {
    return ctx.reply(
      "Choose contact preference.",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Phone", "services:contact_pref:phone"),
          Markup.button.callback(
            "Telegram DM",
            "services:contact_pref:telegram",
          ),
        ],
      ]),
    );
  }

  private backToServicesKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback("Back", "services:home")],
    ]);
  }

  private isEditField(
    field: string | undefined,
  ): field is
    | "name"
    | "category"
    | "description"
    | "timing"
    | "contactPreference" {
    return [
      "name",
      "category",
      "description",
      "timing",
      "contactPreference",
    ].includes(field ?? "");
  }

  private fieldLabel(field: string) {
    if (field === "contactPreference") return "contact preference";
    return field;
  }

  private title(value: string) {
    return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
