import { Injectable } from '@nestjs/common';
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
  private readonly groq =
    process.env.GROQ_API_KEY
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Given a found item's AI description, find matching OPEN lost reports.
   * Uses Groq semantic scoring when available; falls back to ILIKE keyword search.
   */
  async findMatchingLostReports(
    foundAiDescription: string,
    foundItemId: string,
  ): Promise<LostItemMatch[]> {
    // Load all open lost items that haven't already been matched to this found item
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

    if (!candidates.length) return [];

    return this.rankBySimilarity(lostAiDescription, candidates, 'found');
  }

  // ── Ranking ─────────────────────────────────────────────────────────────────

  private async rankBySimilarity(
    queryDescription: string,
    candidates: (FoundItemMatch | LostItemMatch)[],
    mode: 'found' | 'lost',
  ): Promise<any[]> {
    // Try Groq semantic scoring first
    if (this.groq && candidates.length > 0) {
      try {
        return await this.groqRank(queryDescription, candidates, mode);
      } catch {
        // fallback to keyword search below
      }
    }

    // Keyword fallback: extract meaningful words and score by how many appear
    return this.keywordRank(queryDescription, candidates);
  }

  private async groqRank(
    queryDescription: string,
    candidates: (FoundItemMatch | LostItemMatch)[],
    mode: 'found' | 'lost',
  ): Promise<any[]> {
    const list = candidates
      .map((c, i) => `[${i}] ${c.aiDescription || c.originalDescription}`)
      .join('\n');

    const prompt =
      mode === 'found'
        ? `A resident FOUND this item:\n"${queryDescription}"\n\nBelow are open LOST item reports (indexed):\n${list}\n\nReturn a JSON array of indices (0-based) that are a plausible match for the found item. A match means the items could be the same physical object. Be generous — "plastic toy" matches "plastic toy shovel". Return [] if nothing plausibly matches. Return ONLY valid JSON, no explanation.`
        : `A resident LOST this item:\n"${queryDescription}"\n\nBelow are open FOUND item reports (indexed):\n${list}\n\nReturn a JSON array of indices (0-based) that are a plausible match for the lost item. A match means the items could be the same physical object. Be generous — "yellow toy" matches "plastic toy shovel" if size/type align. Return [] if nothing plausibly matches. Return ONLY valid JSON, no explanation.`;

    const response = await this.groq!.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    // Model may return {"indices": [...]} or just [...]
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }

    const indices: number[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.indices)
        ? parsed.indices
        : Array.isArray(parsed.matches)
          ? parsed.matches
          : [];

    return indices
      .filter((i) => typeof i === 'number' && i >= 0 && i < candidates.length)
      .map((i) => ({ ...candidates[i], score: 1 }));
  }

  private keywordRank(
    queryDescription: string,
    candidates: (FoundItemMatch | LostItemMatch)[],
  ): any[] {
    // Extract words ≥ 3 chars, skip common stop words
    const stop = new Set(['the', 'and', 'for', 'with', 'has', 'are', 'this', 'that', 'was', 'has']);
    const keywords = queryDescription
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !stop.has(w));

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
