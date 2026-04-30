import type { BotContext } from '../bot.js';

// ─── /help ────────────────────────────────────────────────────────────────────

const HELP_TEXT = `
📖 <b>Команды Inkflow Bot</b>

<b>Основные</b>
/start — главное меню и состояние публикации
/help — эта справка

<b>Контент</b>
/post — создать новый пост (пошаговый мастер)
/drafts — список черновиков с кнопками отправки и удаления
/send &lt;id&gt; — отправить конкретный черновик по ID

<b>Статистика</b>
/subscribers — количество и прирост подписчиков
/analytics — открываемость и кликабельность последних 5 постов

<b>Управление</b>
/import — импортировать подписчиков из Substack (ZIP-файл)
/settings — настройки публикации (название, slug, тарифы)

<b>Советы</b>
• Посты поддерживают HTML-форматирование
• Платный контент доступен только платным подписчикам
• Импорт из Substack: экспортируйте CSV в личном кабинете Substack, отправьте ZIP сюда
`.trim();

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP_TEXT, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}
