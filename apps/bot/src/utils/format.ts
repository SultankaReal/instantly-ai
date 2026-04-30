import type { Post, PostAnalytics, SubscriberStats } from '../types.js';

// ─── Primitive Helpers ────────────────────────────────────────────────────────

/** Strips all HTML tags, returning plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Truncates text to maxLen characters, appending ellipsis if needed. */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

// ─── Domain Formatters ────────────────────────────────────────────────────────

/**
 * Formats a post for inline preview in Telegram.
 * Shows title + the first 500 characters of plain-text content.
 */
export function formatPost(post: Post): string {
  const access = post.access === 'paid' ? '🔒 Платный' : '🆓 Бесплатный';
  const plain = stripHtml(post.content_html);
  const preview = truncate(plain, 500);
  return (
    `📄 <b>${escapeHtml(post.title)}</b>\n` +
    `${access}\n\n` +
    `${escapeHtml(preview)}\n\n` +
    `<i>Символов: ${plain.length.toLocaleString('ru-RU')}</i>`
  );
}

/**
 * Formats the analytics list as a readable Telegram message.
 * One block per post, sorted by most recent first (API already does this).
 */
export function formatAnalytics(analytics: PostAnalytics[]): string {
  if (analytics.length === 0) {
    return '📊 Пока нет данных по рассылкам.';
  }

  const lines: string[] = ['📊 <b>Аналитика последних постов</b>\n'];

  for (const item of analytics) {
    const openPct = (item.open_rate * 100).toFixed(1);
    const clickPct = (item.click_rate * 100).toFixed(1);
    const sentDate = item.sent_at
      ? new Date(item.sent_at).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        })
      : '—';

    lines.push(
      `<b>${escapeHtml(truncate(item.title, 45))}</b>\n` +
        `  📬 Отправлено: ${item.sent_count.toLocaleString('ru-RU')}\n` +
        `  👁 Открытий: ${item.unique_opens.toLocaleString('ru-RU')} (${openPct}%)\n` +
        `  🔗 Кликов: ${item.unique_clicks.toLocaleString('ru-RU')} (${clickPct}%)\n` +
        `  📅 Дата: ${sentDate}`,
    );
  }

  return lines.join('\n\n');
}

/**
 * Formats subscriber stats as a concise Telegram message.
 */
export function formatSubscriberStats(stats: SubscriberStats): string {
  return (
    `👥 <b>Подписчики</b>\n\n` +
    `Всего активных: <b>${stats.total_active.toLocaleString('ru-RU')}</b>\n` +
    `  🆓 Бесплатных: ${stats.total_free.toLocaleString('ru-RU')}\n` +
    `  💳 Платных: ${stats.total_paid.toLocaleString('ru-RU')}\n\n` +
    `За последнюю неделю:\n` +
    `  ✅ Новых: +${stats.new_this_week}\n` +
    `  ❌ Отписок: -${stats.unsubscribed_this_week}`
  );
}

// ─── Telegram HTML escaping ───────────────────────────────────────────────────

/** Escapes characters that have special meaning in Telegram HTML parse mode. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
