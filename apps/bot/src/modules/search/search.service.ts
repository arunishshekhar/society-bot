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
            role: 'system',
            content: `You are a housing society assistant that extracts structured search intent from resident queries.
Classify each query and extract the following JSON fields:
- type: "worker" | "service" | "carpool" | "unknown"
- category: specific type of worker or service (e.g. "maid", "cook", "plumber", "tutor", "laundry")
- keywords: array of key descriptors (e.g. ["north indian", "experienced", "full time"])
- destination: for carpool queries, the destination location (e.g. "MG Road", "Whitefield")
- days: for carpool queries, array of abbreviated days (e.g. ["Mon","Wed","Fri"])
- time: for carpool queries, departure time mentioned (e.g. "8AM", "8:30AM")

Respond ONLY with valid JSON.`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: 200,
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
