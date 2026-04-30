import type { BotContext } from '../bot.js';
import { getAnalytics } from '../services/api.client.js';
import { formatAnalytics } from '../utils/format.js';

// ─── /analytics ───────────────────────────────────────────────────────────────

export async function analyticsCommand(ctx: BotContext): Promise<void> {
  const publicationId = ctx.session.publicationId;
  if (!publicationId) {
    await ctx.reply('❌ Публикация не найдена. Попробуйте /start.');
    return;
  }

  try {
    const analytics = await getAnalytics(publicationId);
    const message = formatAnalytics(analytics);
    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[analytics] load error', err);
    await ctx.reply('❌ Не удалось загрузить аналитику. Попробуйте позже.');
  }
}
