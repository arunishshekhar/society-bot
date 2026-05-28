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
                text: `You are helping catalog a lost and found item in a residential society.
                
                The finder described it as: "${userDescription}"
                
                Analyze the image and generate a detailed, searchable description that includes:
                - Object type and category
                - Color(s)
                - Material (if visible)
                - Brand or markings (if visible)
                - Size (approximate)
                - Condition
                - Any distinctive features
                - Possible use case or owner type
                
                Write as a dense, keyword-rich paragraph optimized for text search.
                Do NOT include location or personal info.
                Be factual and descriptive only.`,
              },
              {
                type: 'image_url',
                image_url: { url: fileUrl },
              },
            ],
          },
        ],
        max_tokens: 300,
      });

      return response.choices[0]?.message?.content || userDescription;
    } catch (error) {
      this.logger.error('Error generating found description via Groq Vision:', error);
      return userDescription; // fallback to original
    }
  }

  async enrichLostDescription(userDescription: string): Promise<string> {
    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'user',
            content: `You are helping catalog a lost item report in a residential society.
            
            The person described their lost item as: "${userDescription}"
            
            Expand this into a detailed, keyword-rich description for search.
            Include synonyms, related terms, and inferred attributes.
            
            Example: "black wallet" -> "black leather wallet billfold card holder bifold money purse dark colored slim compact personal accessory"
            
            Write as a dense keyword paragraph. Be factual, no assumptions about value.
            Max 150 words.`,
          },
        ],
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content || userDescription;
    } catch (error) {
      this.logger.error('Error enriching lost description via Groq:', error);
      return userDescription; // fallback to original
    }
  }
}
