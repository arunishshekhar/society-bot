import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '../../types/bot-context';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

@Injectable()
export class LostFoundAiService {
  private readonly logger = new Logger(LostFoundAiService.name);

  async generateFoundDescription(
    fileId: string,
    userDescription: string,
    ctx: BotContext,
  ): Promise<string> {
    try {
      const file = await ctx.telegram.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

      const response = await groq.chat.completions.create({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are cataloging a FOUND item for a residential society lost-and-found system.
The finder described it as: "${userDescription}"

Analyze the image carefully and write a DETAILED, RICH description for the search index.
Your description must cover ALL of the following — write at least 5–8 sentences:

1. WHAT it is: exact object type (e.g. "child's plastic toy beach shovel / spade")
2. COLOR: all colors visible (e.g. "bright yellow handle, red blade")
3. MATERIAL: what it is made of (e.g. "lightweight plastic, hollow construction")
4. SIZE: approximate dimensions or size relative to common objects
5. BRAND / MARKINGS: any text, logo, sticker, or label visible — say "none visible" if absent
6. CONDITION: new, used, dirty, broken, worn, etc.
7. DISTINCTIVE FEATURES: scratches, stickers, unique shape, writing, damage
8. LIKELY OWNER / USE CASE: child toy, kitchen item, sports gear, clothing, electronics, etc.
9. SYNONYMS & RELATED WORDS: include alternate names people might use to search for it
   Example: "shovel spade digger scoop gardening toy beach play sand"

Write as a continuous, dense paragraph — NO bullet points, NO headers.
Pack in as many searchable keywords as possible. Min 100 words.`,
              },
              {
                type: 'image_url',
                image_url: { url: fileUrl },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      const result = response.choices[0]?.message?.content?.trim();
      return result && result.length > 20 ? result : userDescription;
    } catch (error) {
      this.logger.error('Error generating found description via Groq Vision:', error);
      return userDescription;
    }
  }

  async enrichLostDescription(userDescription: string): Promise<string> {
    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a lost-and-found assistant for a residential society. 
Your job is to expand a brief item description into a rich, detailed search profile.
Always write at least 6–8 sentences covering: object type, likely colors, material, size, brand possibilities, use case, and synonyms.
Be specific and generous with search terms. Do NOT make up facts — use "possibly", "likely", "typically" for inferences.`,
          },
          {
            role: 'user',
            content: `The resident described their lost item as: "${userDescription}"

Write a detailed, keyword-rich description for searching the found-items database.
Cover:
1. What the item is (exact type + category)
2. Typical colors for this type of item
3. Typical material / construction
4. Approximate size
5. Possible brand names or variants
6. Who typically owns or uses this item
7. Synonyms and alternate names someone might use to describe it
8. Any distinguishing features that are common for this item type

Example output for "black wallet":
"Black leather bifold wallet, likely a men's slim card holder or billfold, dark colored, compact rectangular shape approximately 9x11cm, possibly branded (Levis, Wildcraft, Tommy, no-brand), made of faux or genuine leather or synthetic material, contains compartments for cards and cash, personal accessory, also called purse, cardholder, money clip holder, billfold, pocket wallet. Typically owned by an adult male. Small enough to fit in a trouser pocket."

Write a similarly detailed description for the lost item. Min 80 words.`,
          },
        ],
        max_tokens: 400,
      });

      const result = response.choices[0]?.message?.content?.trim();
      return result && result.length > 20 ? result : userDescription;
    } catch (error) {
      this.logger.error('Error enriching lost description via Groq:', error);
      return userDescription;
    }
  }
}
