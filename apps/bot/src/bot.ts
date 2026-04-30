import { Bot, Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import type { Author, Publication } from './types.js';

// ─── Session Data ─────────────────────────────────────────────────────────────

/**
 * Per-user session data stored in memory (or pluggable storage).
 * authorId / publicationId are populated by requireAuth middleware after the
 * first successful API lookup so subsequent commands skip the round-trip.
 */
export type SessionData = {
  authorId?: string;
  publicationId?: string;
  /** Scratch space used by conversations to carry state between steps */
  conversationData?: Record<string, unknown>;
};

// ─── Context Augmentation ─────────────────────────────────────────────────────

/**
 * Custom context type that every handler receives.
 * SessionFlavor<SessionData>   — adds ctx.session
 * ConversationFlavor           — adds ctx.conversation
 */
export type BotContext = Context &
  SessionFlavor<SessionData> &
  ConversationFlavor & {
    /** Populated by requireAuth after a successful author lookup */
    author?: Author;
    /** Populated by requireAuth alongside author */
    publication?: Publication;
  };

// ─── Bot Factory ──────────────────────────────────────────────────────────────

/**
 * Creates and returns the configured Bot instance.
 * Called once in index.ts; the same instance is reused by all command modules.
 */
export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);
  return bot;
}
