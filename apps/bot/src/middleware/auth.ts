import type { NextFunction } from 'grammy';
import type { BotContext } from '../bot.js';
import { getAuthorByTelegramId, getPublicationByAuthor } from '../services/api.client.js';

// ─── requireAuth ─────────────────────────────────────────────────────────────

/**
 * Middleware that verifies the Telegram user is a registered Inkflow author.
 *
 * Flow:
 *  1. If session already has authorId/publicationId → fast-path, populate ctx and continue.
 *  2. Otherwise call GET /api/telegram/author?telegramId={userId}.
 *  3. Found → save to session, set ctx.author / ctx.publication, continue.
 *  4. Not found → send registration prompt and halt the middleware chain.
 */
export async function requireAuth(
  ctx: BotContext,
  next: NextFunction,
): Promise<void> {
  const telegramId = ctx.from?.id?.toString();

  if (!telegramId) {
    await ctx.reply('Не удалось определить ваш Telegram аккаунт.');
    return;
  }

  // Fast-path: already authenticated in this session
  if (ctx.session.authorId && ctx.session.publicationId) {
    // ctx.author / ctx.publication would need a DB hit to reconstruct objects;
    // for simplicity we pass minimal info from session. Commands that need the
    // full Publication object call the API directly.
    await next();
    return;
  }

  // Slow-path: first call — hit the API
  try {
    const author = await getAuthorByTelegramId(telegramId);

    if (!author) {
      const webUrl =
        process.env['WEB_URL'] ?? 'https://app.inkflow.io';
      await ctx.reply(
        '👋 Привет! Ваш Telegram аккаунт ещё не привязан к Inkflow.\n\n' +
          'Чтобы начать работу:\n' +
          `1. Зарегистрируйтесь на <a href="${webUrl}/register">inkflow.io</a>\n` +
          '2. В настройках профиля привяжите Telegram\n' +
          '3. Вернитесь сюда и отправьте /start\n\n' +
          `🔗 <a href="${webUrl}/register">Зарегистрироваться</a>`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
      );
      return;
    }

    // Fetch the author's publication to get publicationId
    const publication = await getPublicationByAuthor(author.id).catch(async () => {
      // Author exists but has no publication yet
      await ctx.reply(
        '⚠️ Ваш аккаунт найден, но у вас ещё нет публикации.\n' +
          `Создайте её на <a href="${process.env['WEB_URL'] ?? 'https://app.inkflow.io'}/publications/new">сайте</a>.`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
      );
      return null;
    });

    if (!publication) return;

    // Persist to session so next requests skip the API call
    ctx.session.authorId = author.id;
    ctx.session.publicationId = publication.id;

    // Attach to context for this request
    ctx.author = author;
    ctx.publication = publication;

    await next();
  } catch (err) {
    console.error('[auth] requireAuth error', err);
    await ctx.reply(
      '❌ Не удалось проверить авторизацию. Попробуйте позже.',
    );
  }
}
