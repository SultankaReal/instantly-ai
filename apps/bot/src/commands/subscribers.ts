import type { BotContext } from '../bot.js';
import { getSubscribers } from '../services/api.client.js';
import { formatSubscriberStats } from '../utils/format.js';

// ─── /subscribers ─────────────────────────────────────────────────────────────

export async function subscribersCommand(ctx: BotContext): Promise<void> {
  const publicationId = ctx.session.publicationId;
  if (!publicationId) {
    await ctx.reply('❌ Публикация не найдена. Попробуйте /start.');
    return;
  }

  try {
    const stats = await getSubscribers(publicationId);
    await ctx.reply(formatSubscriberStats(stats), { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[subscribers] load error', err);
    await ctx.reply('❌ Не удалось загрузить статистику подписчиков. Попробуйте позже.');
  }
}
