import { OnboardingScene } from "./onboarding.scene";
import { BotContext } from "../types/bot-context";

function createContext(overrides: Partial<BotContext> = {}) {
  return {
    session: {},
    reply: jest.fn(),
    ...overrides,
  } as unknown as BotContext & { reply: jest.Mock };
}

describe("OnboardingScene", () => {
  it("resumes from the saved flat-number step", async () => {
    const scene = new OnboardingScene({} as never, {} as never);
    const ctx = createContext({
      session: { onboarding: { step: "flat", name: "Arunish" } },
    } as Partial<BotContext>);

    await scene.enter(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      "What is your flat number? Pattern: Tower-Floor-Unit (e.g., 03-12-03 for Tower 3, Floor 12, Unit 3)",
    );
  });

  it("validates flat number input and preserves the current step on failure", async () => {
    const scene = new OnboardingScene({} as never, {} as never);
    const ctx = createContext({
      text: "Tower A",
      session: { onboarding: { step: "flat", name: "Arunish" } },
    } as Partial<BotContext>);

    await scene.onText(ctx);

    expect(ctx.session.onboarding?.step).toBe("flat");
    expect(ctx.reply).toHaveBeenCalledWith(
      "Please enter a valid flat number. Pattern: Tower-Floor-Unit (e.g., 03-12-03 for Tower 3, Floor 12, Unit 3).",
    );
  });

  it("normalizes a valid flat number and moves to phone capture", async () => {
    const scene = new OnboardingScene({} as never, {} as never);
    const ctx = createContext({
      text: "03-12-03",
      session: { onboarding: { step: "flat", name: "Arunish" } },
    } as Partial<BotContext>);

    await scene.onText(ctx);

    expect(ctx.session.onboarding).toMatchObject({
      step: "phone",
      flatNumber: "03-12-03",
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      "Share your phone number, or skip it for now.",
      expect.any(Object),
    );
  });
});
