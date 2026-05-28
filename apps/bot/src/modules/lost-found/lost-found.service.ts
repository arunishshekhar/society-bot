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
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Yes, this is mine', callback_data: `lf_confirm_${foundItem.id}_${lostReport.id}` },
                { text: '❌ Not mine', callback_data: `lf_reject_${foundItem.id}_${lostReport.id}` },
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
    return this.prisma.lostItem.create({
      data: {
        reportedById,
        originalDescription: session.originalDescription!,
        aiDescription: session.aiDescription!,
      },
    });
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
