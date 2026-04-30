import type { BotContext } from '../bot.js';
import { getPublication, getSubscribers } from '../services/api.client.js';
import { mainMenuKeyboard } from '../utils/keyboard.js';
import { escapeHtml } from '../utils/format.js';

// ─── /start ───────────────────────────────────────────────────────────────────

export async function startCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id?.toString();

  // If the user is not yet authenticated the requireAuth middleware will have
  // already replied before this handler runs, so we only reach here for
  // authenticated authors.
  const publicationId = ctx.session.publicationId;
  if (!publicationId || !telegramId) {
    // Unauthenticated first-time greeting
    const webUrl = process.env['WEB_URL'] ?? 'https://app.inkflow.io';
    await ctx.reply(
      '👋 Добро пожаловать в <b>Inkflow</b>!\n\n' +
        'Inkflow — платформа для авторских рассылок без комиссии.\n\n' +
        'Чтобы начать:\n' +
        `1. Зарегистрируйтесь на <a href="${webUrl}/register">inkflow.io</a>\n` +
        '2. Создайте публикацию\n' +
        '3. Привяжите Telegram в настройках профиля\n' +
        '4. Вернитесь сюда и отправьте /start\n\n' +
        `🔗 <a href="${webUrl}/register">Начать бесплатно →</a>`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
    );
    return;
  }

  try {
    // Load publication details and subscriber stats in parallel
    const [publication, stats] = await Promise.all([
      getPublication(publicationId),
      getSubscribers(publicationId).catch(() => null),
    ]);

    const pubName = escapeHtml(publication.name);
    const subCount = stats
      ? `👥 Подписчиков: <b>${stats.total_active.toLocaleString('ru-RU')}</b>`
      : '';

    await ctx.reply(
      `👋 С возвращением!\n\n` +
        `📰 Публикация: <b>${pubName}</b>\n` +
        (subCount ? `${subCount}\n` : '') +
        `\nВыберите действие:`,
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() },
    );
  } catch (err) {
    console.error('[start] error loading publication', err);
    await ctx.reply(
      '❌ Не удалось загрузить данные публикации. Попробуйте позже.',
    );
  }
}
