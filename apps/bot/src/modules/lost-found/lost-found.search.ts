import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FoundItem, LostItem } from '@prisma/client';
import Groq from 'groq-sdk';

export type FoundItemMatch = FoundItem & {
  name: string;
  flatNumber: string;
  telegramId: bigint;
  score: number;
};

export type LostItemMatch = LostItem & {
  name: string;
  flatNumber: string;
  telegramId: bigint;
  score: number;
};

@Injectable()
export class LostFoundSearchService {
  private readonly logger = new Logger(LostFoundSearchService.name);
  private readonly groq = process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Given a found item's AI description, find matching OPEN lost reports.
   */
  async findMatchingLostReports(
    foundAiDescription: string,
    foundItemId: string,
  ): Promise<LostItemMatch[]> {
    const candidates = await this.prisma.$queryRaw<LostItemMatch[]>`
      SELECT
        l.id, l."reportedById", l."originalDescription", l."aiDescription",
        l.status, l."resolvedAt", l."resolvedById", l."createdAt", l."updatedAt",
        r."telegramId", r.name, r."flatNumber"
      FROM "LostItem" l
      JOIN "Resident" r ON l."reportedById" = r.id
      WHERE l.status = 'OPEN'
      AND NOT EXISTS (
        SELECT 1 FROM "LostFoundMatch" m
        WHERE m."foundItemId" = ${foundItemId}
        AND m."lostItemId" = l.id
      )
      ORDER BY l."createdAt" DESC
      LIMIT 30
    `;

    this.logger.log(
      `findMatchingLostReports: ${candidates.length} candidates for found item`,
    );
    if (!candidates.length) return [];
    return this.rankBySimilarity(foundAiDescription, candidates, 'lost');
  }

  /**
   * Given a lost item's AI description, find matching OPEN found items.
   */
  async findMatchingFoundItems(
    lostAiDescription: string,
  ): Promise<FoundItemMatch[]> {
    const candidates = await this.prisma.$queryRaw<FoundItemMatch[]>`
      SELECT
        f.id, f."reportedById", f."originalDescription", f."aiDescription",
        f."imageFileId", f."collectionLocation", f.status,
        f."resolvedAt", f."resolvedById", f."createdAt", f."updatedAt",
        r.name, r."flatNumber", r."telegramId"
      FROM "FoundItem" f
      JOIN "Resident" r ON f."reportedById" = r.id
      WHERE f.status = 'OPEN'
      ORDER BY f."createdAt" DESC
      LIMIT 30
    `;

    this.logger.log(
      `findMatchingFoundItems: ${candidates.length} candidates for lost item`,
    );
    if (!candidates.length) return [];
    return this.rankBySimilarity(lostAiDescription, candidates, 'found');
  }

  // ── Ranking ─────────────────────────────────────────────────────────────────

  private async rankBySimilarity(
    queryDescription: string,
    candidates: (FoundItemMatch | LostItemMatch)[],
    mode: 'found' | 'lost',
  ): Promise<any[]> {
    if (this.groq && candidates.length > 0) {
      try {
        const result = await this.groqRank(queryDescription, candidates, mode);
        this.logger.log(`groqRank returned ${result.length} match(es)`);
        if (result.length > 0) return result;
        // If Groq returns nothing, also try keyword as a safety net
      } catch (err) {
        this.logger.warn(`groqRank failed, falling back to keywords: ${err}`);
      }
    }
    const result = this.keywordRank(queryDescription, candidates);
    this.logger.log(`keywordRank returned ${result.length} match(es)`);
    return result;
  }

  private async groqRank(
    queryDescription: string,
    candidates: (FoundItemMatch | LostItemMatch)[],
    mode: 'found' | 'lost',
  ): Promise<any[]> {
    const list = candidates
      .map((c, i) => `[${i}] ${c.aiDescription || c.originalDescription}`)
      .join('\n');

    // Use a clear system + user prompt. Do NOT use response_format json_object
    // because the model output is an array, not an object, and the constraint causes
    // the model to wrap the result in unpredictable ways.
    const systemPrompt =
      'You are a lost-and-found matching assistant. Respond ONLY with a raw JSON array of integer indices, e.g. [0, 2]. No explanation, no markdown, no object wrapper.';

    const userPrompt =
      mode === 'found'
        ? `FOUND item description:\n"${queryDescription}"\n\nCandidate LOST reports:\n${list}\n\nWhich indices could describe the SAME physical object as the found item? Be generous — if a toy matches a "plastic toy shovel", include it. Reply with ONLY a JSON array like [0] or [0,2] or [].`
        : `LOST item description:\n"${queryDescription}"\n\nCandidate FOUND items:\n${list}\n\nWhich indices could describe the SAME physical object as the lost item? Be generous — if a toy matches a "plastic toy shovel", include it. Reply with ONLY a JSON array like [0] or [0,2] or [].`;

    const response = await this.groq!.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 100,
      temperature: 0,
    });

    const raw = (response.choices[0]?.message?.content ?? '').trim();
    this.logger.log(`groqRank raw response: ${raw}`);

    // Extract the first JSON array from the response (handles trailing text)
    const match = raw.match(/\[[\d,\s]*\]/);
    if (!match) return this.keywordRank(queryDescription, candidates);

    const indices: number[] = JSON.parse(match[0]);
    return indices
      .filter((i) => typeof i === 'number' && i >= 0 && i < candidates.length)
      .map((i) => ({ ...candidates[i], score: 1 }));
  }

  private keywordRank(
    queryDescription: string,
    candidates: (FoundItemMatch | LostItemMatch)[],
  ): any[] {
    const stop = new Set([
      'the', 'and', 'for', 'with', 'has', 'are', 'this', 'that',
      'was', 'its', 'item', 'found', 'lost', 'any', 'some', 'very',
    ]);
    const keywords = queryDescription
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !stop.has(w));

    this.logger.debug(`keywordRank keywords: ${keywords.join(', ')}`);
    if (!keywords.length) return [];

    const scored = candidates
      .map((c) => {
        const text = `${c.aiDescription ?? ''} ${c.originalDescription ?? ''}`.toLowerCase();
        const score = keywords.filter((kw) => text.includes(kw)).length;
        return { ...c, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 5);
  }
}
