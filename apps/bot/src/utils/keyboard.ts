import { InlineKeyboard } from 'grammy';
import type { Post } from '../types.js';
import { truncate } from './format.js';

// ─── Main Menu ────────────────────────────────────────────────────────────────

/** Root navigation keyboard shown after /start. */
export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✍️ Новый пост', 'menu:post')
    .text('📋 Черновики', 'menu:drafts')
    .row()
    .text('👥 Подписчики', 'menu:subscribers')
    .text('📊 Аналитика', 'menu:analytics')
    .row()
    .text('⚙️ Настройки', 'menu:settings')
    .text('❓ Помощь', 'menu:help');
}

// ─── Post Actions ─────────────────────────────────────────────────────────────

/** Actions for a single post shown in the drafts list. */
export function postActionsKeyboard(postId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('📤 Отправить сейчас', `post:send:${postId}`)
    .row()
    .text('✏️ Редактировать', `post:edit:${postId}`)
    .text('🗑 Удалить', `post:delete:${postId}`);
}

// ─── Drafts List ──────────────────────────────────────────────────────────────

/**
 * Builds an inline keyboard listing all drafts.
 * Each row: truncated title (callback: post:view:{id}) + "📤" send button + "🗑" delete button.
 */
export function draftsListKeyboard(posts: Post[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const post of posts) {
    const label = truncate(post.title, 32);
    kb.text(label, `post:view:${post.id}`)
      .text('📤', `post:send:${post.id}`)
      .text('🗑', `post:delete:${post.id}`)
      .row();
  }
  return kb;
}

// ─── Confirm Send ─────────────────────────────────────────────────────────────

/** Confirmation dialog before actually sending a post. */
export function confirmSendKeyboard(postId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Да, отправить', `post:confirm_send:${postId}`)
    .text('❌ Отмена', `post:cancel:${postId}`);
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

/** Simple single-button cancel keyboard (used inside conversations). */
export function cancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('❌ Отмена', 'conversation:cancel');
}

// ─── Post Access ──────────────────────────────────────────────────────────────

/** Keyboard for selecting post access level during creation. */
export function accessKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🆓 Бесплатный', 'access:free')
    .text('🔒 Платный', 'access:paid');
}

// ─── Post Final Actions ───────────────────────────────────────────────────────

/** Final action choices shown after post preview in creation conversation. */
export function postFinalActionsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📤 Отправить сейчас', 'create:send')
    .row()
    .text('💾 Сохранить черновик', 'create:draft')
    .row()
    .text('❌ Отмена', 'create:cancel');
}
