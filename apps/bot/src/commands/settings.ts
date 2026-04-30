import type { BotContext } from '../bot.js';
import { getPublication } from '../services/api.client.js';
import { escapeHtml } from '../utils/format.js';

// ─── /settings ────────────────────────────────────────────────────────────────

/** Formats a price in cents to a human-readable string (e.g. 500 → "$5/мес"). */
function formatPrice(cents: number | null, period: string): string {
  if (!cents) return '—';
  const amount = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return `$${amount}/${period}`;
}

export async function settingsCommand(ctx: BotContext): Promise<void> {
  const publicationId = ctx.session.publicationId;
  if (!publicationId) {
    await ctx.reply('❌ Публикация не найдена. Попробуйте /start.');
    return;
  }

  try {
    const pub = await getPublication(publicationId);

    const webUrl = process.env['WEB_URL'] ?? 'https://app.inkflow.io';
    const settingsUrl = `${webUrl}/publications/${pub.slug}/settings`;

    const domain = pub.custom_domain
      ? `🌐 Домен: <code>${escapeHtml(pub.custom_domain)}</code>\n`
      : '';

    const description = pub.description
      ? `📝 Описание: ${escapeHtml(pub.description)}\n`
      : '';

    const pricing =
      pub.pricing_monthly || pub.pricing_annual
        ? `\n💳 <b>Платные подписки</b>\n` +
          `  Ежемесячно: ${formatPrice(pub.pricing_monthly, 'мес')}\n` +
          `  Ежегодно: ${formatPrice(pub.pricing_annual, 'год')}\n`
        : '\n💳 Платные подписки: <i>не настроены</i>\n';

    const createdAt = new Date(pub.created_at).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    await ctx.reply(
      `⚙️ <b>Настройки публикации</b>\n\n` +
        `📰 Название: <b>${escapeHtml(pub.name)}</b>\n` +
        `🔗 Slug: <code>${escapeHtml(pub.slug)}</code>\n` +
        domain +
        description +
        pricing +
        `\n📅 Создана: ${createdAt}\n\n` +
        `Для расширенных настроек перейдите на сайт:\n` +
        `🔧 <a href="${settingsUrl}">Открыть настройки →</a>`,
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
    );
  } catch (err) {
    console.error('[settings] load error', err);
    await ctx.reply(
      '❌ Не удалось загрузить настройки публикации. Попробуйте позже.',
    );
  }
}
