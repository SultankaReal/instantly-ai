import type { BotContext } from '../bot.js';
import { startImport } from '../services/api.client.js';

// ─── /import ──────────────────────────────────────────────────────────────────

/**
 * Sends the import instructions message.
 * The actual file handling is done by the document listener registered below.
 */
export async function importCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    '📦 <b>Импорт из Substack</b>\n\n' +
      'Как экспортировать данные из Substack:\n' +
      '1. Откройте Substack → Settings → Exports\n' +
      '2. Нажмите «Create new export»\n' +
      '3. Дождитесь письма со ссылкой\n' +
      '4. Скачайте ZIP-файл и отправьте его сюда\n\n' +
      '<i>Импортируются только подписчики (email + имя). Посты не импортируются.</i>\n\n' +
      '⬇️ Отправьте ZIP-файл прямо в этот чат.',
    { parse_mode: 'HTML' },
  );

  // Set a flag in session so the document handler knows we're expecting a ZIP
  ctx.session.conversationData = {
    ...ctx.session.conversationData,
    awaitingImportFile: true,
  };
}

// ─── Document Handler ─────────────────────────────────────────────────────────

/**
 * Handles document messages when the user is in import mode.
 * Checks MIME type / file extension for ZIP, then kicks off the import job.
 */
export async function importDocumentHandler(ctx: BotContext): Promise<void> {
  const isAwaiting = ctx.session.conversationData?.['awaitingImportFile'];
  if (!isAwaiting) return; // Not in import mode — ignore

  const publicationId = ctx.session.publicationId;
  if (!publicationId) {
    await ctx.reply('❌ Публикация не найдена. Попробуйте /start.');
    return;
  }

  const doc = ctx.message?.document;
  if (!doc) return;

  // Validate: must be a ZIP file
  const isZip =
    doc.mime_type === 'application/zip' ||
    doc.mime_type === 'application/x-zip-compressed' ||
    doc.file_name?.toLowerCase().endsWith('.zip');

  if (!isZip) {
    await ctx.reply(
      '⚠️ Ожидается ZIP-файл. Вы отправили файл другого формата.\n\n' +
        'Пожалуйста, отправьте ZIP-архив из Substack.',
    );
    return;
  }

  // Resolve Telegram file URL so the API can download it
  const telegramBotToken = process.env['BOT_TOKEN'] ?? '';
  const fileInfo = await ctx.api.getFile(doc.file_id);

  if (!fileInfo.file_path) {
    await ctx.reply('❌ Не удалось получить ссылку на файл. Попробуйте снова.');
    return;
  }

  const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.file_path}`;

  // Clear the awaiting flag
  ctx.session.conversationData = {
    ...ctx.session.conversationData,
    awaitingImportFile: false,
  };

  const processingMsg = await ctx.reply(
    '⏳ Файл получен, начинаю импорт…',
  );

  try {
    const { jobId } = await startImport(publicationId, fileUrl);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      processingMsg.message_id,
      `✅ <b>Импорт запущен!</b>\n\n` +
        `ID задачи: <code>${jobId}</code>\n\n` +
        'Вы получите уведомление, когда импорт завершится. ' +
        'Проверьте количество подписчиков через /subscribers.',
      { parse_mode: 'HTML' },
    );
  } catch (err) {
    console.error('[import] startImport error', err);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      processingMsg.message_id,
      '❌ Не удалось запустить импорт. Убедитесь, что файл корректный, и попробуйте снова.',
    );
  }
}
