import {
  type Conversation,
  createConversation,
} from '@grammyjs/conversations';
import type { BotContext } from '../bot.js';
import { createPost, sendPost, getSubscribers } from '../services/api.client.js';
import { formatPost, escapeHtml } from '../utils/format.js';
import {
  cancelKeyboard,
  accessKeyboard,
  postFinalActionsKeyboard,
} from '../utils/keyboard.js';
import type { PostAccess } from '../types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TITLE_MAX = 500;
const CANCEL_DATA = 'conversation:cancel';

// ─── Conversation ─────────────────────────────────────────────────────────────

/**
 * Multi-step conversation for creating a new post.
 *
 * Steps:
 *  1. Prompt for title (validates max length)
 *  2. Prompt for content (HTML accepted)
 *  3. Choose access: free | paid
 *  4. Show preview
 *  5. Choose: Send Now / Save Draft / Cancel
 */
async function createPostConversation(
  conversation: Conversation<BotContext>,
  ctx: BotContext,
): Promise<void> {
  const publicationId = ctx.session.publicationId;
  if (!publicationId) {
    await ctx.reply('❌ Публикация не найдена. Попробуйте /start.');
    return;
  }

  // ── Step 1: Title ──────────────────────────────────────────────────────────
  await ctx.reply(
    '📝 <b>Шаг 1/4 — Заголовок</b>\n\nВведите заголовок поста:',
    { parse_mode: 'HTML', reply_markup: cancelKeyboard() },
  );

  let title = '';
  while (true) {
    const titleCtx = await conversation.waitFor([':text', 'callback_query:data']);

    if (titleCtx.callbackQuery?.data === CANCEL_DATA) {
      await titleCtx.answerCallbackQuery();
      await titleCtx.reply('❌ Создание поста отменено.');
      return;
    }

    const raw = titleCtx.message?.text?.trim() ?? '';
    if (!raw) {
      await titleCtx.reply('Пожалуйста, введите текст заголовка.');
      continue;
    }
    if (raw.length > TITLE_MAX) {
      await titleCtx.reply(
        `Заголовок слишком длинный (${raw.length} символов). Максимум — ${TITLE_MAX}.`,
      );
      continue;
    }
    title = raw;
    break;
  }

  // ── Step 2: Content ────────────────────────────────────────────────────────
  await ctx.reply(
    '📝 <b>Шаг 2/4 — Содержимое</b>\n\nВведите текст поста. Поддерживается HTML-форматирование.\n\n' +
      '<i>Пример: &lt;b&gt;жирный&lt;/b&gt;, &lt;i&gt;курсив&lt;/i&gt;, &lt;a href="..."&gt;ссылка&lt;/a&gt;</i>',
    { parse_mode: 'HTML', reply_markup: cancelKeyboard() },
  );

  let contentHtml = '';
  while (true) {
    const contentCtx = await conversation.waitFor([':text', 'callback_query:data']);

    if (contentCtx.callbackQuery?.data === CANCEL_DATA) {
      await contentCtx.answerCallbackQuery();
      await contentCtx.reply('❌ Создание поста отменено.');
      return;
    }

    const raw = contentCtx.message?.text?.trim() ?? '';
    if (!raw) {
      await contentCtx.reply('Пожалуйста, введите содержимое поста.');
      continue;
    }
    contentHtml = raw;
    break;
  }

  // ── Step 3: Access ─────────────────────────────────────────────────────────
  await ctx.reply(
    '📝 <b>Шаг 3/4 — Доступ</b>\n\nКто может читать этот пост?',
    { parse_mode: 'HTML', reply_markup: accessKeyboard() },
  );

  let access: PostAccess = 'free';
  while (true) {
    const accessCtx = await conversation.waitFor('callback_query:data');
    const data = accessCtx.callbackQuery.data;

    if (data === CANCEL_DATA) {
      await accessCtx.answerCallbackQuery();
      await accessCtx.reply('❌ Создание поста отменено.');
      return;
    }

    if (data === 'access:free') {
      access = 'free';
      await accessCtx.answerCallbackQuery('✅ Бесплатный');
      break;
    }
    if (data === 'access:paid') {
      access = 'paid';
      await accessCtx.answerCallbackQuery('✅ Платный');
      break;
    }
  }

  // ── Step 4: Preview ────────────────────────────────────────────────────────
  // Build a temporary Post object for preview formatting
  const previewPost = {
    id: '',
    publication_id: publicationId,
    author_id: ctx.session.authorId ?? '',
    title,
    subtitle: null,
    content_html: contentHtml,
    slug: '',
    status: 'draft' as const,
    access,
    meta_description: null,
    sent_at: null,
    published_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await ctx.reply(
    `👁 <b>Шаг 4/4 — Предпросмотр</b>\n\n${formatPost(previewPost)}`,
    { parse_mode: 'HTML', reply_markup: postFinalActionsKeyboard() },
  );

  // ── Step 5: Action ─────────────────────────────────────────────────────────
  while (true) {
    const actionCtx = await conversation.waitFor('callback_query:data');
    const data = actionCtx.callbackQuery.data;

    if (data === 'create:cancel' || data === CANCEL_DATA) {
      await actionCtx.answerCallbackQuery();
      await actionCtx.reply('❌ Создание поста отменено.');
      return;
    }

    if (data === 'create:draft') {
      await actionCtx.answerCallbackQuery('💾 Сохраняю…');
      try {
        const draft = await createPost(publicationId, {
          title,
          content_html: contentHtml,
          access,
          status: 'draft',
        });
        await actionCtx.reply(
          `✅ Черновик сохранён!\n\nID: <code>${draft.id}</code>\n` +
            'Отправьте его позже через /drafts.',
          { parse_mode: 'HTML' },
        );
      } catch (err) {
        console.error('[create-post] save draft error', err);
        await actionCtx.reply('❌ Не удалось сохранить черновик. Попробуйте позже.');
      }
      return;
    }

    if (data === 'create:send') {
      await actionCtx.answerCallbackQuery('📤 Отправляю…');
      try {
        // First save as draft so we get an ID
        const post = await createPost(publicationId, {
          title,
          content_html: contentHtml,
          access,
          status: 'draft',
        });

        // Then immediately send
        await sendPost(post.id);

        // Get subscriber count for confirmation message
        const stats = await getSubscribers(publicationId).catch(() => null);
        const countMsg = stats
          ? ` ${stats.total_active.toLocaleString('ru-RU')} подписчикам`
          : '';

        await actionCtx.reply(
          `✅ Пост <b>${escapeHtml(title)}</b> поставлен в очередь отправки${countMsg}!\n\n` +
            '📬 Подписчики получат письмо в течение нескольких минут.',
          { parse_mode: 'HTML' },
        );
      } catch (err) {
        console.error('[create-post] send post error', err);
        await actionCtx.reply(
          '❌ Не удалось отправить пост. Попробуйте позже или сохраните как черновик.',
        );
      }
      return;
    }
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/** Conversation name used to register and enter the conversation. */
export const CREATE_POST_CONVERSATION = 'create-post';

/** grammy conversation plugin-ready conversation handler. */
export const createPostScene = createConversation(
  createPostConversation,
  CREATE_POST_CONVERSATION,
);
