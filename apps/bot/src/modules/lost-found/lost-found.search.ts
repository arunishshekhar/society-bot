import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FoundItem, LostItem } from '@prisma/client';

export type FoundItemMatch = FoundItem & {
  name: string;
  flatNumber: string;
  telegramId: bigint;
  rank?: number;
};

export type LostItemMatch = LostItem & {
  name: string;
  flatNumber: string;
  telegramId: bigint;
  rank?: number;
};

@Injectable()
export class LostFoundSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async findMatchingLostReports(foundItemAiDescription: string, foundItemId: string): Promise<LostItemMatch[]> {
    // Pure tsvector search — no AI
    const matches = await this.prisma.$queryRaw<LostItemMatch[]>`
      SELECT l.*, r."telegramId", r.name, r."flatNumber",
             ts_rank(l.search_vector, plainto_tsquery('english', ${foundItemAiDescription})) AS rank
      FROM "LostItem" l
      JOIN "Resident" r ON l."reportedById" = r.id
      WHERE l.status = 'OPEN'
      AND l.search_vector @@ plainto_tsquery('english', ${foundItemAiDescription})
      AND NOT EXISTS (
        SELECT 1 FROM "LostFoundMatch" m 
        WHERE m."foundItemId" = ${foundItemId}::text
        AND m."lostItemId" = l.id
      )
      ORDER BY rank DESC
      LIMIT 10
    `;
    return matches;
  }

  async findMatchingFoundItems(lostItemAiDescription: string): Promise<FoundItemMatch[]> {
    // Pure tsvector search
    const matches = await this.prisma.$queryRaw<FoundItemMatch[]>`
      SELECT f.*, r.name, r."flatNumber", r."telegramId",
             ts_rank(f.search_vector, plainto_tsquery('english', ${lostItemAiDescription})) AS rank
      FROM "FoundItem" f
      JOIN "Resident" r ON f."reportedById" = r.id
      WHERE f.status = 'OPEN'
      AND f.search_vector @@ plainto_tsquery('english', ${lostItemAiDescription})
      ORDER BY rank DESC
      LIMIT 5
    `;
    return matches;
  }
}
