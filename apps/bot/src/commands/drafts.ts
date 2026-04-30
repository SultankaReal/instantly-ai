import type { BotContext } from '../bot.js';
import { getPosts, sendPost, deletePost, getSubscribers } from '../services/api.client.js';
import { draftsListKeyboard, confirmSendKeyboard } from '../utils/keyboard.js';
import { escapeHtml } from '../utils/format.js';
import { Composer } from 'grammy';

// ─── /drafts command ──────────────────────────────────────────────────────────

export async function draftsCommand(ctx: BotContext): Promise<void> {
  const publicationId = ctx.session.publicationId;
  if (!publicationId) {
    await ctx.reply('❌ Публикация не найдена. Попробуйте /start.');
    return;
  }

  try {
    const drafts = await getPosts(publicationId, 'draft');

    if (drafts.length === 0) {
      await ctx.reply(
        '📭 Черновиков пока нет.\n\nИспользуйте /post чтобы создать новый пост.',
      );
      return;
    }

    await ctx.reply(
      `📋 <b>Черновики (${drafts.length})</b>\n\nВыберите пост для действий:`,
      { parse_mode: 'HTML', reply_markup: draftsListKeyboard(drafts) },
    );
  } catch (err) {
    console.error('[drafts] load error', err);
    await ctx.reply('❌ Не удалось загрузить черновики. Попробуйте позже.');
  }
}

// ─── Callback Query Handlers ──────────────────────────────────────────────────

/**
 * Composer that handles all callback_queries routed from the drafts UI.
 * Registered once in index.ts, not per-command.
 */
export const draftsCallbackComposer = new Composer<BotContext>();

// View a single draft (shows post details + actions)
draftsCallbackComposer.callbackQuery(/^post:view:(.+)$/, async (ctx) => {
  const postId = ctx.match[1];
  if (!postId) return;

  const publicationId = ctx.session.publicationId;
  if (!publicationId) {
    await ctx.answerCallbackQuery('Сессия истекла, отправьте /start.');
    return;
  }

  try {
    const drafts = await getPosts(publicationId, 'draft');
    const post = drafts.find((p) => p.id === postId);
    if (!post) {
      await ctx.answerCallbackQuery('Черновик не найден.');
      return;
    }

    const preview =
      `📄 <b>${escapeHtml(post.title)}</b>\n` +
      `Доступ: ${post.access === 'paid' ? '🔒 Платный' : '🆓 Бесплатный'}\n` +
      `Создан: ${new Date(post.created_at).toLocaleDateString('ru-RU')}`;

    await ctx.editMessageText(preview, {
      parse_mode: 'HTML',
      reply_markup: confirmSendKeyboard(postId),
    });
    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error('[drafts] view error', err);
    await ctx.answerCallbackQuery('❌ Ошибка загрузки поста.');
  }
});

// Ask for send confirmation
draftsCallbackComposer.callbackQuery(/^post:send:(.+)$/, async (ctx) => {
  const postId = ctx.match[1];
  if (!postId) return;

  await ctx.editMessageText(
    '⚠️ Подтвердите отправку поста всем активным подписчикам:',
    { reply_markup: confirmSendKeyboard(postId) },
  );
  await ctx.answerCallbackQuery();
});

// Confirmed send
draftsCallbackComposer.callbackQuery(/^post:confirm_send:(.+)$/, async (ctx) => {
  const postId = ctx.match[1];
  if (!postId) return;

  const publicationId = ctx.session.publicationId;
  await ctx.answerCallbackQuery('📤 Ставлю в очередь…');

  try {
    await sendPost(postId);

    const stats = publicationId
      ? await getSubscribers(publicationId).catch(() => null)
      : null;
    const countMsg = stats
      ? ` ${stats.total_active.toLocaleString('ru-RU')} подписчикам`
      : '';

    await ctx.editMessageText(
      `✅ Пост поставлен в очередь отправки${countMsg}!\n` +
        '📬 Подписчики получат письмо в течение нескольких минут.',
    );
  } catch (err) {
    console.error('[drafts] send error', err);
    await ctx.editMessageText('❌ Не удалось отправить пост. Попробуйте позже.');
  }
});

// Cancel (restore drafts list)
draftsCallbackComposer.callbackQuery(/^post:cancel:(.+)$/, async (ctx) => {
  const publicationId = ctx.session.publicationId;
  await ctx.answerCallbackQuery('Отменено');

  if (!publicationId) return;

  try {
    const drafts = await getPosts(publicationId, 'draft');
    await ctx.editMessageText(
      `📋 <b>Черновики (${drafts.length})</b>\n\nВыберите пост для действий:`,
      { parse_mode: 'HTML', reply_markup: draftsListKeyboard(drafts) },
    );
  } catch {
    await ctx.editMessageText('Черновики', {});
  }
});

// Delete confirmation + execution
draftsCallbackComposer.callbackQuery(/^post:delete:(.+)$/, async (ctx) => {
  const postId = ctx.match[1];
  if (!postId) return;

  const publicationId = ctx.session.publicationId;
  await ctx.answerCallbackQuery();

  try {
    await deletePost(postId);

    // Refresh the drafts list
    const drafts = publicationId
      ? await getPosts(publicationId, 'draft').catch(() => [])
      : [];

    if (drafts.length === 0) {
      await ctx.editMessageText(
        '🗑 Черновик удалён.\n\nЧерновиков больше нет. Используйте /post.',
      );
    } else {
      await ctx.editMessageText(
        `🗑 Черновик удалён.\n\n📋 <b>Черновики (${drafts.length})</b>`,
        { parse_mode: 'HTML', reply_markup: draftsListKeyboard(drafts) },
      );
    }
  } catch (err) {
    console.error('[drafts] delete error', err);
    await ctx.editMessageText('❌ Не удалось удалить черновик.');
  }
});
