import 'dotenv/config';
import { session } from '@grammyjs/session';
import { conversations } from '@grammyjs/conversations';

import { createBot, type SessionData } from './bot.js';
import { requireAuth } from './middleware/auth.js';
import { startCommand } from './commands/start.js';
import { helpCommand } from './commands/help.js';
import { draftsCommand, draftsCallbackComposer } from './commands/drafts.js';
import { subscribersCommand } from './commands/subscribers.js';
import { analyticsCommand } from './commands/analytics.js';
import { importCommand, importDocumentHandler } from './commands/import.js';
import { settingsCommand } from './commands/settings.js';
import {
  createPostScene,
  CREATE_POST_CONVERSATION,
} from './scenes/create-post.scene.js';
import type { BotContext } from './bot.js';
import { mainMenuKeyboard } from './utils/keyboard.js';

// ─── Environment ──────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env['BOT_TOKEN'];
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is not set');
}

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const WEBHOOK_URL = process.env['TELEGRAM_WEBHOOK_URL'];

// ─── Bot Setup ────────────────────────────────────────────────────────────────

const bot = createBot(BOT_TOKEN);

// 1. Session — in-memory storage (swap to Redis adapter for multi-instance)
bot.use(
  session<SessionData, BotContext>({
    initial: (): SessionData => ({}),
  }),
);

// 2. Conversations middleware (must come after session)
bot.use(conversations());

// 3. Register the create-post conversation
bot.use(createPostScene);

// 4. Callback queries from drafts UI (registered before requireAuth so
//    answerCallbackQuery still fires even on session timeout)
bot.use(draftsCallbackComposer);

// ─── Public Commands (no auth required) ──────────────────────────────────────

bot.command('start', async (ctx) => {
  // Attempt auth but don't block — startCommand handles the unauthenticated case
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) {
    await ctx.reply('Не удалось определить ваш Telegram аккаунт.');
    return;
  }
  // Call requireAuth inline so we can fall through to startCommand either way
  await requireAuth(ctx, async () => startCommand(ctx));
});

bot.command('help', helpCommand);

// ─── Authenticated Commands ───────────────────────────────────────────────────

// All remaining commands require the author to be linked
const authed = bot.use(requireAuth);

authed.command('post', async (ctx) => {
  await ctx.conversation.enter(CREATE_POST_CONVERSATION);
});

authed.command('drafts', draftsCommand);

authed.command('send', async (ctx) => {
  // /send <postId>
  const postId = ctx.match?.trim();
  if (!postId) {
    await ctx.reply(
      'Укажите ID черновика: /send <code>postId</code>\n\nСписок черновиков: /drafts',
      { parse_mode: 'HTML' },
    );
    return;
  }
  // Reuse the drafts flow: show confirmation keyboard
  await ctx.reply('⚠️ Подтвердите отправку поста:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Да, отправить', callback_data: `post:confirm_send:${postId}` },
          { text: '❌ Отмена', callback_data: `post:cancel:${postId}` },
        ],
      ],
    },
  });
});

authed.command('subscribers', subscribersCommand);
authed.command('analytics', analyticsCommand);
authed.command('import', importCommand);
authed.command('settings', settingsCommand);

// ─── Document Handler (for /import ZIP upload) ────────────────────────────────

authed.on('message:document', importDocumentHandler);

// ─── Main Menu Callback Routing ───────────────────────────────────────────────

authed.callbackQuery('menu:post', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter(CREATE_POST_CONVERSATION);
});

authed.callbackQuery('menu:drafts', async (ctx) => {
  await ctx.answerCallbackQuery();
  await draftsCommand(ctx);
});

authed.callbackQuery('menu:subscribers', async (ctx) => {
  await ctx.answerCallbackQuery();
  await subscribersCommand(ctx);
});

authed.callbackQuery('menu:analytics', async (ctx) => {
  await ctx.answerCallbackQuery();
  await analyticsCommand(ctx);
});

authed.callbackQuery('menu:settings', async (ctx) => {
  await ctx.answerCallbackQuery();
  await settingsCommand(ctx);
});

authed.callbackQuery('menu:help', async (ctx) => {
  await ctx.answerCallbackQuery();
  await helpCommand(ctx);
});

// ─── Error Handler ────────────────────────────────────────────────────────────

bot.catch((err) => {
  console.error('[bot] unhandled error', err.error, {
    update: err.ctx.update,
  });
  // Attempt to notify the user — fire and forget
  err.ctx
    .reply('❌ Произошла внутренняя ошибка. Мы уже разбираемся. Попробуйте позже.')
    .catch(() => void 0);
});

// ─── Launch ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (NODE_ENV === 'production' && WEBHOOK_URL) {
    // Production: use webhooks (requires a public HTTPS endpoint)
    await bot.api.setWebhook(WEBHOOK_URL, {
      allowed_updates: ['message', 'callback_query'],
    });
    console.log(`[bot] Webhook set to ${WEBHOOK_URL}`);

    // Use Fastify or a minimal HTTP server to receive updates.
    // grammy's built-in webhook handler handles the rest.
    const { createServer } = await import('http');
    const port = Number(process.env['PORT'] ?? 3002);

    const server = createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/webhook') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as unknown;
        await bot.handleUpdate(body as Parameters<typeof bot.handleUpdate>[0]);
        res.writeHead(200).end('OK');
      } else {
        res.writeHead(404).end('Not Found');
      }
    });

    server.listen(port, () => {
      console.log(`[bot] Webhook server listening on port ${port}`);
    });
  } else {
    // Development: use long polling
    console.log('[bot] Starting in polling mode (development)');
    await bot.api.deleteWebhook();
    await bot.start({
      onStart: (info) => console.log(`[bot] Running as @${info.username}`),
      allowed_updates: ['message', 'callback_query'],
    });
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.once('SIGTERM', () => {
  console.log('[bot] SIGTERM received, shutting down');
  bot.stop();
  process.exit(0);
});

process.once('SIGINT', () => {
  console.log('[bot] SIGINT received, shutting down');
  bot.stop();
  process.exit(0);
});

main().catch((err) => {
  console.error('[bot] Fatal startup error', err);
  process.exit(1);
});
