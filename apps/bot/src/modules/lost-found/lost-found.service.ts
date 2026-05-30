import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LostFoundAiService } from './lost-found.ai';
import { LostFoundSearchService, LostItemMatch } from './lost-found.search';
import { FoundItem, LostItem } from '@prisma/client';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../types/bot-context';
import { InjectBot } from 'nestjs-telegraf';

export interface FoundItemSession {
  fileId: string;
  originalDescription?: string;
  collectionLocation?: string;
  aiDescription?: string;
}

export interface LostItemSession {
  originalDescription?: string;
  aiDescription?: string;
}

@Injectable()
export class LostFoundService {
  private readonly logger = new Logger(LostFoundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: LostFoundAiService,
    private readonly searchService: LostFoundSearchService,
    @InjectBot() private readonly bot: Telegraf<BotContext>,
  ) {}

  async saveFoundItem(session: FoundItemSession, reportedById: string): Promise<FoundItem> {
    const item = await this.prisma.foundItem.create({
      data: {
        reportedById,
        originalDescription: session.originalDescription!,
        aiDescription: session.aiDescription!,
        imageFileId: session.fileId,
        collectionLocation: session.collectionLocation!,
      },
    });

    // Scan for matches in the background
    this.scanAndNotifyLostReporters(item).catch((err) => {
      this.logger.error('Error scanning lost reports:', err);
    });

    return item;
  }

  async scanAndNotifyLostReporters(foundItem: FoundItem) {
    const matches = await this.searchService.findMatchingLostReports(foundItem.aiDescription, foundItem.id);

    for (const lostReport of matches) {
      // Avoid duplicate match records and notifications (same pattern as scanAndNotifyFoundItems)
      const alreadyMatched = await this.prisma.lostFoundMatch.findUnique({
        where: { foundItemId_lostItemId: { foundItemId: foundItem.id, lostItemId: lostReport.id } },
      });
      if (alreadyMatched) continue;

      // Record match
      await this.prisma.lostFoundMatch.create({
        data: {
          foundItemId: foundItem.id,
          lostItemId: lostReport.id,
        },
      });

      // Notify the person who lost the item
      try {
        await this.bot.telegram.sendPhoto(
          lostReport.telegramId.toString(),
          foundItem.imageFileId,
          {
            caption:
              `🎉 *Possible match found for your lost item!*\n\n` +
              `📦 Found item: ${foundItem.originalDescription}\n` +
              `📍 Collect from: ${foundItem.collectionLocation}\n\n` +
              `Is this your item?`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Yes, this is mine', callback_data: `lf:c:${foundItem.id.slice(0,8)}:${lostReport.id.slice(0,8)}` },
                { text: '❌ Not mine', callback_data: `lf:r:${foundItem.id.slice(0,8)}:${lostReport.id.slice(0,8)}` },
              ]],
            },
          }
        );
      } catch (err) {
        this.logger.error(`Failed to notify resident ${lostReport.telegramId} of match:`, err);
      }
    }
  }

  async saveLostItem(session: LostItemSession, reportedById: string): Promise<LostItem> {
    const item = await this.prisma.lostItem.create({
      data: {
        reportedById,
        originalDescription: session.originalDescription!,
        aiDescription: session.aiDescription!,
      },
    });

    // Immediately scan open found items for matches
    this.scanAndNotifyFoundItems(item).catch((err) => {
      this.logger.error('Error scanning found items for new lost report:', err);
    });

    return item;
  }

  async scanAndNotifyFoundItems(lostItem: LostItem) {
    const matches = await this.searchService.findMatchingFoundItems(lostItem.aiDescription);

    for (const foundItem of matches) {
      // Avoid duplicate matches
      const alreadyMatched = await this.prisma.lostFoundMatch.findUnique({
        where: { foundItemId_lostItemId: { foundItemId: foundItem.id, lostItemId: lostItem.id } },
      });
      if (alreadyMatched) continue;

      await this.prisma.lostFoundMatch.create({
        data: { foundItemId: foundItem.id, lostItemId: lostItem.id },
      });

      // Notify the person who lost the item
      const reporter = await this.prisma.resident.findUnique({
        where: { id: lostItem.reportedById },
      });
      if (!reporter) continue;

      try {
        await this.bot.telegram.sendPhoto(
          reporter.telegramId.toString(),
          foundItem.imageFileId,
          {
            caption:
              `🎉 *Possible match found for your lost item!*\n\n` +
              `📦 Found: ${foundItem.originalDescription}\n` +
              `📍 Collect from: ${foundItem.collectionLocation}\n\n` +
              `Is this your item?`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Yes, this is mine', callback_data: `lf:c:${foundItem.id.slice(0,8)}:${lostItem.id.slice(0,8)}` },
                { text: '❌ Not mine', callback_data: `lf:r:${foundItem.id.slice(0,8)}:${lostItem.id.slice(0,8)}` },
              ]],
            },
          }
        );
      } catch (err) {
        this.logger.error(`Failed to notify resident of found match:`, err);
      }
    }
  }

  async resolveItems(
    foundItemId: string,
    lostItemId: string,
    resolvedById: string,
  ) {
    const [foundItem, lostItem] = await Promise.all([
      this.prisma.foundItem.update({
        where: { id: foundItemId },
        data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById },
        include: { reportedBy: true },
      }),
      this.prisma.lostItem.update({
        where: { id: lostItemId },
        data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById },
        include: { reportedBy: true },
      }),
    ]);

    try {
      await this.bot.telegram.sendMessage(
        foundItem.reportedBy.telegramId.toString(),
        '✅ The lost item you found has been collected\\. Thank you\\! 🙏',
        { parse_mode: 'MarkdownV2' },
      );
    } catch (e) {}

    try {
      await this.bot.telegram.sendMessage(
        lostItem.reportedBy.telegramId.toString(),
        '✅ Your lost item has been marked as recovered\\. Great news\\! 🎉',
        { parse_mode: 'MarkdownV2' },
      );
    } catch (e) {}
  }
}
