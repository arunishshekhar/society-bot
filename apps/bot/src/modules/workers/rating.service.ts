import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

@Injectable()
export class RatingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Code Generation ────────────────────────────────────────────────────────

  /**
   * Generates a unique 3-character alphanumeric code (e.g. "AB3", "X7K").
   * Retries until globally unique — codes are never reused.
   */
  async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = this.randomCode();
      const existing = await this.prisma.workerRecommendation.findUnique({
        where: { workerCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    // Extremely unlikely, but fall back to 4-char code if 3-char space exhausted
    return this.randomCode() + this.randomChar();
  }

  // ─── Lookup ──────────────────────────────────────────────────────────────────

  async lookupByCode(code: string) {
    return this.prisma.workerRecommendation.findUnique({
      where: { workerCode: code.toUpperCase() },
    });
  }

  // ─── Rating ──────────────────────────────────────────────────────────────────

  /**
   * Upserts a rating for a worker by a resident.
   * Blocks self-rating. Recomputes avgRating on the worker record.
   * Returns { updated, newAvg, count } or throws on self-rate.
   */
  async rateWorker(
    workerId: string,
    residentId: string,
    stars: number,
  ): Promise<{ isUpdate: boolean; newAvg: number; count: number }> {
    // Self-rating guard: check if the worker was added by this resident
    const worker = await this.prisma.workerRecommendation.findUnique({
      where: { id: workerId },
      select: { residentId: true },
    });
    if (worker?.residentId === residentId) {
      throw new Error("SELF_RATE");
    }

    // Check if rating already exists (for update vs. new feedback)
    const existing = await this.prisma.workerRating.findUnique({
      where: { workerId_residentId: { workerId, residentId } },
    });

    // Upsert the rating
    await this.prisma.workerRating.upsert({
      where: { workerId_residentId: { workerId, residentId } },
      create: {
        id: crypto.randomUUID(),
        workerId,
        residentId,
        stars,
        updatedAt: new Date(),
      },
      update: {
        stars,
        updatedAt: new Date(),
      },
    });

    // Recompute avgRating from all ratings for this worker
    const { _avg, _count } = await this.prisma.workerRating.aggregate({
      where: { workerId },
      _avg: { stars: true },
      _count: { stars: true },
    });

    const newAvg = Math.round((_avg.stars ?? 0) * 10) / 10;
    const count = _count.stars;

    await this.prisma.workerRecommendation.update({
      where: { id: workerId },
      data: { avgRating: newAvg },
    });

    return { isUpdate: !!existing, newAvg, count };
  }

  /**
   * Returns formatted rating string: "⭐ 4.2 (8 ratings)" or "Not rated yet"
   */
  formatRating(avgRating: number | null, count?: number): string {
    if (!avgRating) return "Not rated yet";
    const countStr =
      count !== undefined
        ? ` (${count} ${count === 1 ? "rating" : "ratings"})`
        : "";
    return `⭐ ${avgRating}${countStr}`;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private randomCode(): string {
    return [0, 1, 2].map(() => this.randomChar()).join("");
  }

  private randomChar(): string {
    return CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
}
