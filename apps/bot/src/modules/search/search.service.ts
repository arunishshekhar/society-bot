import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { normalizeSearchIntent, SearchIntent } from './search-intent';

@Injectable()
export class SearchService {
  private readonly groq =
    process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 0
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : null;

  async classifyIntent(query: string): Promise<SearchIntent> {
    if (!this.groq) {
      return this.fallbackIntent(query);
    }

    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'user',
            content: `Classify this housing society query as worker, service, carpool, or unknown. Extract category and keywords. Respond only with JSON: {"type":"worker|service|carpool|unknown","category":"string","keywords":["string"]}\nQuery: ${query}`,
          },
        ],
        max_tokens: 120,
        response_format: { type: 'json_object' },
      });

      return normalizeSearchIntent(JSON.parse(response.choices[0]?.message?.content ?? '{}'));
    } catch {
      return this.fallbackIntent(query);
    }
  }

  private fallbackIntent(query: string): SearchIntent {
    const lower = query.toLowerCase();
    const keywords = lower.split(/[^a-z0-9]+/).filter(Boolean).slice(0, 8);

    if (/(carpool|ride|cab|whitefield|koramangala|electronic|mg road)/.test(lower)) {
      return { type: 'carpool', keywords };
    }

    if (/(food|meal|tutor|tuition|laundry|tailor|service)/.test(lower)) {
      return { type: 'service', keywords };
    }

    if (/(plumber|electrician|maid|cook|driver|carpenter|repair|ac|geyser|paint)/.test(lower)) {
      return { type: 'worker', keywords };
    }

    return { type: 'unknown', keywords };
  }
}
