import { UseGuards } from "@nestjs/common";
import { Action, Command, Ctx, On, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../guards/group-member.guard";
import { mainMenuKeyboard } from "../keyboards/main-menu.keyboard";
import { SearchService } from "../modules/search/search.service";
import { PrismaService } from "../prisma/prisma.service";
import { BotContext } from "../types/bot-context";
import { getCallbackData } from "../utils/callback-data";
import {
  isValidVehicleNumber,
  normalizeVehicleNumber,
} from "../utils/validation";

@Scene("vehicles")
@UseGuards(GroupMemberGuard)
export class VehicleScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    ctx.session.vehicles = {};
    await this.showVehicleList(ctx);
  }

  @Action("vehicles:add")
  async add(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.vehicles = { mode: "adding", step: "number", draft: {} };
    await ctx.reply("Enter vehicle number. Example: KA01AB1234");
  }

  @Action(/vehicles:select:.+/)
  async selectVehicle(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(":").at(-1);
    if (!id) return;

    ctx.session.vehicles = { selectedId: id };
    await this.showVehicleDetail(ctx, id);
  }

  @Action(/vehicles:edit:.+/)
  async editField(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const field = getCallbackData(ctx)?.split(":").at(-1);
    const selectedId = ctx.session.vehicles?.selectedId;

    if (!selectedId || !this.isEditableField(field)) {
      await this.showVehicleList(ctx);
      return;
    }

    ctx.session.vehicles = {
      mode: "editing",
      selectedId,
      step: field,
      draft: {},
    };

    if (field === "type") {
      await this.promptVehicleType(ctx, "vehicles:type");
      return;
    }

    await ctx.reply(`Enter updated ${this.fieldLabel(field)}.`);
  }

  @Action(/vehicles:type:.+/)
  async setType(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const type = getCallbackData(ctx)?.split(":").at(-1);
    const state = ctx.session.vehicles;

    if (!type || !state?.mode) return;

    if (state.mode === "editing" && state.selectedId) {
      await this.prisma.vehicle.update({
        where: { id: state.selectedId },
        data: { type },
      });
      ctx.session.vehicles = { selectedId: state.selectedId };
      await ctx.reply("Vehicle updated.");
      await this.showVehicleDetail(ctx, state.selectedId);
      return;
    }

    ctx.session.vehicles = {
      ...state,
      step: "color",
      draft: { ...state.draft, type },
    };
    await ctx.reply("Enter vehicle color.");
  }

  @Action(/vehicles:delete:.+/)
  async confirmDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(":").at(-1);
    if (!id) return;

    await ctx.reply(
      "Delete this vehicle?",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Delete", `vehicles:delete_confirm:${id}`),
          Markup.button.callback("Cancel", `vehicles:select:${id}`),
        ],
      ]),
    );
  }

  @Action(/vehicles:delete_confirm:.+/)
  async deleteVehicle(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(":").at(-1);
    if (!id) return;

    await this.prisma.vehicle.delete({ where: { id } });
    ctx.session.vehicles = {};
    await ctx.reply("Vehicle deleted.");
    await this.showVehicleList(ctx);
  }

  @Action("vehicles:skip_model")
  async skipModel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const state = ctx.session.vehicles;
    if (!state) return;

    ctx.session.vehicles = { ...state, step: "parkingSlot" };
    await ctx.reply(
      "Enter parking slot.",
      Markup.inlineKeyboard([
        [Markup.button.callback("Skip for now", "vehicles:skip_parking")],
      ]),
    );
  }

  @Action("vehicles:skip_parking")
  async skipParking(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.saveVehicleDraft(ctx);
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
    const state = ctx.session.vehicles;
    const text = ctx.text?.trim();

    if (!state?.mode || !state.step || !text) {
      await this.showVehicleList(ctx);
      return;
    }

    if (state.step === "number") {
      const number = normalizeVehicleNumber(text);
      if (!isValidVehicleNumber(text)) {
        await ctx.reply(
          "Please enter a valid vehicle number (at least 2 characters).",
        );
        return;
      }

      if (state.mode === "editing" && state.selectedId) {
        await this.prisma.vehicle.update({
          where: { id: state.selectedId },
          data: { number },
        });
        ctx.session.vehicles = { selectedId: state.selectedId };
        await ctx.reply("Vehicle updated.");
        await this.showVehicleDetail(ctx, state.selectedId);
        return;
      }

      ctx.session.vehicles = {
        ...state,
        step: "type",
        draft: { ...state.draft, number },
      };
      await this.promptVehicleType(ctx, "vehicles:type");
      return;
    }

    if (state.mode === "editing" && state.selectedId) {
      await this.prisma.vehicle.update({
        where: { id: state.selectedId },
        data: { [state.step]: text },
      });
      ctx.session.vehicles = { selectedId: state.selectedId };
      await ctx.reply("Vehicle updated.");
      await this.showVehicleDetail(ctx, state.selectedId);
      return;
    }

    const nextStep = this.nextAddStep(state.step);
    ctx.session.vehicles = {
      ...state,
      step: nextStep,
      draft: { ...state.draft, [state.step]: text },
    };

    if (nextStep === "model") {
      await ctx.reply(
        "Enter model name.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Skip for now", "vehicles:skip_model")],
        ]),
      );
      return;
    }

    if (nextStep === "parkingSlot") {
      await ctx.reply(
        "Enter parking slot.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Skip for now", "vehicles:skip_parking")],
        ]),
      );
      return;
    }

    await this.saveVehicleDraft(ctx);
  }

  private async showVehicleList(ctx: BotContext) {
    const resident = await this.getResident(ctx);
    if (!resident) {
      await ctx.scene.enter("onboarding");
      return;
    }

    const vehicles = await this.prisma.vehicle.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: "asc" },
    });

    const lines = vehicles.length
      ? vehicles.map((v, i) => {
          const details = [v.model, v.color, v.parkingSlot]
            .filter(Boolean)
            .join(", ");
          return `${i + 1}. ${v.number} - ${details || v.type}`;
        })
      : ["No vehicles added yet."];
    const vehicleButtons = vehicles.map((v) => [
      Markup.button.callback(v.number, `vehicles:select:${v.id}`),
    ]);

    await ctx.reply(
      ["My Vehicles", "", ...lines].join("\n"),
      Markup.inlineKeyboard([
        ...vehicleButtons,
        [Markup.button.callback("Add Vehicle", "vehicles:add")],
        [Markup.button.callback("Back", "menu:back")],
      ]),
    );
  }

  private async showVehicleDetail(ctx: BotContext, id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });

    if (!vehicle) {
      await this.showVehicleList(ctx);
      return;
    }

    await ctx.reply(
      [
        vehicle.number,
        `Type: ${vehicle.type}`,
        `Color: ${vehicle.color ?? "Not set"}`,
        `Model: ${vehicle.model ?? "Not set"}`,
        `Parking: ${vehicle.parkingSlot ?? "Not set"}`,
      ].join("\n"),
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Edit Number", "vehicles:edit:number"),
          Markup.button.callback("Edit Type", "vehicles:edit:type"),
        ],
        [
          Markup.button.callback("Edit Color", "vehicles:edit:color"),
          Markup.button.callback("Edit Model", "vehicles:edit:model"),
        ],
        [Markup.button.callback("Edit Parking", "vehicles:edit:parkingSlot")],
        [Markup.button.callback("Delete", `vehicles:delete:${vehicle.id}`)],
        [Markup.button.callback("Back", "vehicles:list")],
      ]),
    );
  }

  @Action("vehicles:list")
  async list(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.vehicles = {};
    await this.showVehicleList(ctx);
  }

  @Action("menu:back")
  async backToMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    await ctx.reply("Society Bot", mainMenuKeyboard());
  }

  private async saveVehicleDraft(ctx: BotContext) {
    const resident = await this.getResident(ctx);
    const draft = ctx.session.vehicles?.draft;

    if (!resident || !draft?.number || !draft.type || !draft.color) {
      await ctx.reply("Vehicle details are incomplete. Please start again.");
      ctx.session.vehicles = {};
      await this.showVehicleList(ctx);
      return;
    }

    await this.prisma.vehicle.create({
      data: {
        residentId: resident.id,
        number: draft.number,
        type: draft.type,
        color: draft.color,
        model: draft.model,
        parkingSlot: draft.parkingSlot,
      },
    });

    ctx.session.vehicles = {};
    await ctx.reply("Vehicle saved.");
    await this.showVehicleList(ctx);
  }

  private async getResident(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return null;

    return this.prisma.resident.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
  }

  private promptVehicleType(ctx: BotContext, prefix: string) {
    return ctx.reply(
      "Select vehicle type.",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Car", `${prefix}:car`),
          Markup.button.callback("Bike", `${prefix}:bike`),
          Markup.button.callback("EV", `${prefix}:ev`),
        ],
      ]),
    );
  }

  private nextAddStep(step: string) {
    if (step === "color") return "model";
    if (step === "model") return "parkingSlot";
    return undefined;
  }

  private isEditableField(
    field: string | undefined,
  ): field is "number" | "type" | "color" | "model" | "parkingSlot" {
    return ["number", "type", "color", "model", "parkingSlot"].includes(
      field ?? "",
    );
  }

  private fieldLabel(field: string) {
    if (field === "parkingSlot") return "parking slot";
    return field;
  }
}
