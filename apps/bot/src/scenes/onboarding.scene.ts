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
  isValidVehicleNumber,
  normalizeFlatNumber,
  normalizeVehicleNumber,
} from "../utils/validation";

@Scene("onboarding")
@UseGuards(GroupMemberGuard)
export class OnboardingScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    ctx.session.onboarding ??= { step: "name" };
    await this.promptForCurrentStep(ctx);
  }

  @Command(["ask", "menu", "exit"])
  async onAskCommand(@Ctx() ctx: BotContext) {
    await ctx.reply("Please complete your registration first to access other features.");
    await this.promptForCurrentStep(ctx);
  }

  @On("text")
  async onText(@Ctx() ctx: BotContext) {
    const text = ctx.text?.trim();
    const state = ctx.session.onboarding ?? { step: "name" };

    if (!text) {
      await this.promptForCurrentStep(ctx);
      return;
    }

    if (state.step === "name") {
      if (!isValidName(text)) {
        await ctx.reply("Please enter a name between 2 and 80 characters.");
        return;
      }

      ctx.session.onboarding = { ...state, step: "flat", name: text };
      await ctx.reply("Thanks. What is your flat number? Example: A-101");
      return;
    }

    if (state.step === "flat") {
      if (!isValidFlatNumber(text)) {
        await ctx.reply(
          "Please enter a valid flat number. Pattern: Tower-Floor-Unit (e.g., 03-12-03 for Tower 3, Floor 12, Unit 3).",
        );
        return;
      }

      ctx.session.onboarding = {
        ...state,
        step: "phone",
        flatNumber: normalizeFlatNumber(text),
      };
      await ctx.reply(
        "Share your phone number, or skip it for now.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Skip for now", "onboarding:skip_phone")],
        ]),
      );
      return;
    }

    if (state.step === "phone") {
      ctx.session.onboarding = {
        ...state,
        step: "vehicle_choice",
        phone: text,
      };
      await this.promptVehicleChoice(ctx);
      return;
    }

    if (state.step === "vehicle_number") {
      const number = normalizeVehicleNumber(text);
      if (!isValidVehicleNumber(text)) {
        await ctx.reply(
          "Please enter a valid vehicle number (at least 2 characters).",
        );
        return;
      }

      ctx.session.onboarding = {
        ...state,
        step: "vehicle_type",
        vehicle: { ...state.vehicle, number },
      };
      await ctx.reply(
        "Select vehicle type.",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("Car", "onboarding:vehicle_type:car"),
            Markup.button.callback("Bike", "onboarding:vehicle_type:bike"),
            Markup.button.callback("EV", "onboarding:vehicle_type:ev"),
          ],
        ]),
      );
      return;
    }

    if (state.step === "vehicle_color") {
      ctx.session.onboarding = {
        ...state,
        step: "vehicle_model",
        vehicle: { ...state.vehicle, color: text },
      };
      await ctx.reply(
        "What is the model name?",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Skip for now",
              "onboarding:skip_vehicle_model",
            ),
          ],
        ]),
      );
      return;
    }

    if (state.step === "vehicle_model") {
      ctx.session.onboarding = {
        ...state,
        step: "vehicle_parking",
        vehicle: { ...state.vehicle, model: text },
      };
      await ctx.reply(
        "What is the parking slot?",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Skip for now",
              "onboarding:skip_vehicle_parking",
            ),
          ],
        ]),
      );
      return;
    }

    if (state.step === "vehicle_parking") {
      ctx.session.onboarding = {
        ...state,
        vehicle: { ...state.vehicle, parkingSlot: text },
      };
      await this.completeOnboarding(ctx);
      return;
    }

    await this.promptForCurrentStep(ctx);
  }

  @Action("onboarding:skip_phone")
  async skipPhone(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const state = ctx.session.onboarding ?? { step: "phone" };
    ctx.session.onboarding = { ...state, step: "vehicle_choice" };
    await this.promptVehicleChoice(ctx);
  }

  @Action("onboarding:add_vehicle")
  async addVehicle(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const state = ctx.session.onboarding ?? { step: "vehicle_choice" };
    ctx.session.onboarding = { ...state, step: "vehicle_number", vehicle: {} };
    await ctx.reply("What is your vehicle number?");
  }

  @Action("onboarding:skip_vehicle")
  async skipVehicle(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.completeOnboarding(ctx);
  }

  @Action(/onboarding:vehicle_type:.+/)
  async setVehicleType(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const data =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data
        : "";
    const type = data.split(":").at(-1);
    const state = ctx.session.onboarding ?? { step: "vehicle_type" };

    if (!type) {
      await ctx.reply("Please select a vehicle type.");
      return;
    }

    ctx.session.onboarding = {
      ...state,
      step: "vehicle_color",
      vehicle: { ...state.vehicle, type },
    };
    await ctx.reply("What color is the vehicle?");
  }

  @Action("onboarding:skip_vehicle_model")
  async skipVehicleModel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const state = ctx.session.onboarding ?? { step: "vehicle_model" };
    ctx.session.onboarding = { ...state, step: "vehicle_parking" };
    await ctx.reply(
      "What is the parking slot?",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "Skip for now",
            "onboarding:skip_vehicle_parking",
          ),
        ],
      ]),
    );
  }

  @Action("onboarding:skip_vehicle_parking")
  async skipVehicleParking(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.completeOnboarding(ctx);
  }

  private async promptForCurrentStep(ctx: BotContext) {
    const step = ctx.session.onboarding?.step ?? "name";

    if (step === "flat") {
      await ctx.reply(
        "What is your flat number? Pattern: Tower-Floor-Unit (e.g., 03-12-03 for Tower 3, Floor 12, Unit 3)",
      );
      return;
    }

    if (step === "phone") {
      await ctx.reply(
        "Share your phone number, or skip it for now.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Skip for now", "onboarding:skip_phone")],
        ]),
      );
      return;
    }

    if (step === "vehicle_choice") {
      await this.promptVehicleChoice(ctx);
      return;
    }

    if (step === "vehicle_number") {
      await ctx.reply("What is your vehicle number?");
      return;
    }

    if (step === "vehicle_type") {
      await ctx.reply(
        "Select vehicle type.",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("Car", "onboarding:vehicle_type:car"),
            Markup.button.callback("Bike", "onboarding:vehicle_type:bike"),
            Markup.button.callback("EV", "onboarding:vehicle_type:ev"),
          ],
        ]),
      );
      return;
    }

    if (step === "vehicle_color") {
      await ctx.reply("What color is the vehicle?");
      return;
    }

    if (step === "vehicle_model") {
      await ctx.reply(
        "What is the model name?",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Skip for now",
              "onboarding:skip_vehicle_model",
            ),
          ],
        ]),
      );
      return;
    }

    if (step === "vehicle_parking") {
      await ctx.reply(
        "What is the parking slot?",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Skip for now",
              "onboarding:skip_vehicle_parking",
            ),
          ],
        ]),
      );
      return;
    }

    await ctx.reply("Welcome to Society Bot. What is your full name?");
  }

  private async promptVehicleChoice(ctx: BotContext) {
    await ctx.reply(
      "Would you like to add your first vehicle now?",
      Markup.inlineKeyboard([
        [Markup.button.callback("Add Vehicle", "onboarding:add_vehicle")],
        [Markup.button.callback("Skip for now", "onboarding:skip_vehicle")],
      ]),
    );
  }

  private async completeOnboarding(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    const state = ctx.session.onboarding;

    if (!telegramId || !state?.name || !state.flatNumber) {
      ctx.session.onboarding = { step: "name" };
      await this.promptForCurrentStep(ctx);
      return;
    }

    const resident = await this.prisma.resident.upsert({
      where: { telegramId: BigInt(telegramId) },
      create: {
        telegramId: BigInt(telegramId),
        telegramUsername: ctx.from?.username,
        name: state.name,
        flatNumber: state.flatNumber,
        phone: state.phone,
        onboardingComplete: true,
      },
      update: {
        telegramUsername: ctx.from?.username,
        name: state.name,
        flatNumber: state.flatNumber,
        phone: state.phone,
        isActive: true,
        onboardingComplete: true,
      },
    });

    if (state.vehicle?.number && state.vehicle.type && state.vehicle.color) {
      await this.prisma.vehicle.upsert({
        where: { number: state.vehicle.number },
        create: {
          residentId: resident.id,
          number: state.vehicle.number,
          type: state.vehicle.type,
          color: state.vehicle.color,
          model: state.vehicle.model,
          parkingSlot: state.vehicle.parkingSlot,
        },
        update: {
          residentId: resident.id,
          type: state.vehicle.type,
          color: state.vehicle.color,
          model: state.vehicle.model,
          parkingSlot: state.vehicle.parkingSlot,
        },
      });
    }

    ctx.session.onboarding = undefined;
    await ctx.reply("Onboarding complete.");
    await ctx.reply("Society Bot", mainMenuKeyboard());
    await ctx.scene.leave();
  }
}
