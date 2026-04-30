import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const AI_MODEL = 'claude-sonnet-4-6';
const AI_RATE_LIMIT_KEY_PREFIX = 'ai:rate_limit:';
const AI_RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const AI_RATE_LIMIT_MAX_REQUESTS = 10;

const GenerateDraftSchema = z.object({
  topic: z
    .string({ required_error: 'Topic is required' })
    .min(3, 'Topic must be at least 3 characters')
    .max(500, 'Topic too long'),
  publicationId: z
    .string({ required_error: 'Publication ID is required' })
    .uuid('Invalid publication ID'),
  tone: z.enum(['professional', 'casual', 'storytelling']).default('professional'),
  targetLength: z.enum(['short', 'medium', 'long']).default('medium'),
  additionalContext: z.string().max(1000, 'Additional context too long').optional(),
});

type GenerateDraftRequest = z.infer<typeof GenerateDraftSchema>;

type GenerateDraftResponse = {
  title: string;
  content_html: string;
  meta_description: string;
  tokensUsed: number;
};

const LENGTH_GUIDANCE: Record<string, string> = {
  short: 'approximately 300-500 words',
  medium: 'approximately 800-1200 words',
  long: 'approximately 1500-2500 words',
};

const TONE_GUIDANCE: Record<string, string> = {
  professional: 'Use a professional, authoritative tone. Be informative and concise.',
  casual: 'Use a conversational, friendly tone. Write as if speaking to a friend.',
  storytelling: 'Use engaging narrative techniques. Open with a story or anecdote.',
};

function buildSystemPrompt(): string {
  return `You are an expert newsletter writer. Your role is to generate high-quality, engaging newsletter content for independent authors.

Guidelines:
- Always respond with a valid JSON object containing: title, content_html, and meta_description
- content_html must contain properly formatted HTML with semantic tags (h2, h3, p, ul, ol, blockquote, etc.)
- Never use h1 tags (the newsletter title is separate)
- meta_description must be 150-160 characters, compelling, and include the topic keyword
- Write content that adds genuine value to readers
- Include a clear call-to-action or takeaway at the end

Response format (strict JSON):
{
  "title": "Compelling newsletter title (max 60 chars)",
  "content_html": "<p>Full HTML content here...</p>",
  "meta_description": "SEO-optimized description (150-160 chars)"
}`;
}

function buildUserPrompt(params: GenerateDraftRequest): string {
  const lengthGuide = LENGTH_GUIDANCE[params.targetLength] ?? '800-1200 words';
  const toneGuide = TONE_GUIDANCE[params.tone] ?? TONE_GUIDANCE['professional']!;

  let prompt = `Write a newsletter post about: ${params.topic}\n\n`;
  prompt += `Length: ${lengthGuide}\n`;
  prompt += `Tone: ${toneGuide}\n`;

  if (params.additionalContext) {
    prompt += `\nAdditional context: ${params.additionalContext}\n`;
  }

  prompt += '\nRespond with only the JSON object. Do not include any other text.';
  return prompt;
}

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/ai/generate-draft — auth required, rate limited 10/hr per author
  app.post(
    '/api/ai/generate-draft',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['topic', 'publicationId'],
          properties: {
            topic: { type: 'string', minLength: 3, maxLength: 500 },
            publicationId: { type: 'string', format: 'uuid' },
            tone: { type: 'string', enum: ['professional', 'casual', 'storytelling'] },
            targetLength: { type: 'string', enum: ['short', 'medium', 'long'] },
            additionalContext: { type: 'string', maxLength: 1000 },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: GenerateDraftResponse }> => {
      const authorId = request.user.sub;
      const body = GenerateDraftSchema.parse(request.body);

      // ── Rate limiting: 10 requests per hour per author ──────────────────
      const rateLimitKey = `${AI_RATE_LIMIT_KEY_PREFIX}${authorId}`;
      const currentCount = await app.redis.incr(rateLimitKey);

      if (currentCount === 1) {
        // First request in this window — set expiry
        await app.redis.expire(rateLimitKey, AI_RATE_LIMIT_WINDOW_SECONDS);
      }

      if (currentCount > AI_RATE_LIMIT_MAX_REQUESTS) {
        const ttl = await app.redis.ttl(rateLimitKey);
        return reply.status(429).send({
          success: false,
          error: {
            code: 'AI_RATE_LIMIT_EXCEEDED',
            message: `AI generation limit (${AI_RATE_LIMIT_MAX_REQUESTS}/hr) exceeded. Try again in ${Math.ceil(ttl / 60)} minutes.`,
          },
        });
      }

      // ── Verify publication ownership ─────────────────────────────────────
      const publication = await app.prisma.publication.findUnique({
        where: { id: body.publicationId },
        select: { id: true, author_id: true },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PUBLICATION_NOT_FOUND', message: 'Publication not found' },
        });
      }

      if (publication.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this publication' },
        });
      }

      const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
      if (!anthropicApiKey) {
        app.log.error('ANTHROPIC_API_KEY not configured');
        return reply.status(503).send({
          success: false,
          error: { code: 'AI_UNAVAILABLE', message: 'AI service is currently unavailable' },
        });
      }

      const client = new Anthropic({ apiKey: anthropicApiKey });

      let aiResponse: Anthropic.Message;
      try {
        aiResponse = await client.messages.create({
          model: AI_MODEL,
          max_tokens: 4096,
          system: buildSystemPrompt(),
          messages: [
            {
              role: 'user',
              content: buildUserPrompt(body),
            },
          ],
        });
      } catch (err) {
        app.log.error({ err }, 'Anthropic API error');

        // Decrement the rate limit counter since the request failed
        await app.redis.decr(rateLimitKey);

        return reply.status(503).send({
          success: false,
          error: { code: 'AI_SERVICE_ERROR', message: 'AI generation failed. Please try again.' },
        });
      }

      const tokensUsed = aiResponse.usage.input_tokens + aiResponse.usage.output_tokens;

      const firstContent = aiResponse.content[0];
      if (!firstContent || firstContent.type !== 'text') {
        app.log.error({ aiResponse }, 'Unexpected AI response format');
        return reply.status(500).send({
          success: false,
          error: { code: 'AI_RESPONSE_ERROR', message: 'Unexpected response from AI service' },
        });
      }

      let parsed: { title: string; content_html: string; meta_description: string };
      try {
        parsed = JSON.parse(firstContent.text) as typeof parsed;
      } catch {
        app.log.error({ responseText: firstContent.text }, 'Failed to parse AI response as JSON');
        return reply.status(500).send({
          success: false,
          error: { code: 'AI_PARSE_ERROR', message: 'AI returned malformed response' },
        });
      }

      // Validate the parsed response has required fields
      if (!parsed.title || !parsed.content_html || !parsed.meta_description) {
        return reply.status(500).send({
          success: false,
          error: { code: 'AI_INCOMPLETE_RESPONSE', message: 'AI response missing required fields' },
        });
      }

      // Log AI usage for billing/monitoring
      await app.prisma.aILog.create({
        data: {
          author_id: authorId,
          publication_id: body.publicationId,
          topic: body.topic,
          tokens_used: tokensUsed,
        },
      });

      return reply.send({
        success: true,
        data: {
          title: parsed.title,
          content_html: parsed.content_html,
          meta_description: parsed.meta_description,
          tokensUsed,
        },
      });
    },
  );
}
