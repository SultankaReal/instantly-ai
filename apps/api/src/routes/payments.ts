import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import type { CheckoutSessionResponse, SubscriptionStatusResponse } from '@inkflow/shared-types';

function getStripe(): Stripe {
  const secretKey = process.env['STRIPE_SECRET_KEY'];
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
}

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/publications/:pubId/checkout — create a Stripe Checkout session
  app.post(
    '/api/publications/:pubId/checkout',
    {
      preHandler: [app.optionalAuthenticate],
      schema: {
        params: {
          type: 'object',
          required: ['pubId'],
          properties: { pubId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['email', 'interval'],
          properties: {
            email: { type: 'string', format: 'email' },
            interval: { type: 'string', enum: ['monthly', 'annual'] },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: CheckoutSessionResponse }> => {
      const { pubId } = request.params as { pubId: string };
      const body = request.body as { email: string; interval: 'monthly' | 'annual' };

      const publication = await app.prisma.publication.findUnique({
        where: { id: pubId },
        select: {
          id: true,
          name: true,
          slug: true,
          pricing_monthly: true,
          pricing_annual: true,
          stripe_account_id: true,
        },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PUBLICATION_NOT_FOUND', message: 'Publication not found' },
        });
      }

      const priceAmount =
        body.interval === 'annual' ? publication.pricing_annual : publication.pricing_monthly;

      if (!priceAmount) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PRICING_NOT_CONFIGURED',
            message: `${body.interval} pricing is not configured for this publication`,
          },
        });
      }

      const stripe = getStripe();
      const appUrl = process.env['APP_URL'] ?? 'http://localhost:3001';

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: body.email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${publication.name} — ${body.interval === 'annual' ? 'Annual' : 'Monthly'} subscription`,
              },
              unit_amount: priceAmount,
              recurring: {
                interval: body.interval === 'annual' ? 'year' : 'month',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          publication_id: pubId,
          subscriber_email: body.email,
          interval: body.interval,
        },
        success_url: `${appUrl}/publications/${publication.slug}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/publications/${publication.slug}/subscribe?cancelled=1`,
        subscription_data: {
          metadata: {
            publication_id: pubId,
            subscriber_email: body.email,
          },
        },
      });

      if (!session.url) {
        app.log.error({ sessionId: session.id }, 'Stripe checkout session missing URL');
        return reply.status(500).send({
          success: false,
          error: { code: 'CHECKOUT_ERROR', message: 'Failed to create checkout session' },
        });
      }

      return reply.send({
        success: true,
        data: {
          checkoutUrl: session.url,
          sessionId: session.id,
        },
      });
    },
  );

  // GET /api/publications/:pubId/subscription-status — auth required
  app.get(
    '/api/publications/:pubId/subscription-status',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['pubId'],
          properties: { pubId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: SubscriptionStatusResponse }> => {
      const userEmail = request.user.email;
      const { pubId } = request.params as { pubId: string };

      const publication = await app.prisma.publication.findUnique({
        where: { id: pubId },
        select: { id: true },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PUBLICATION_NOT_FOUND', message: 'Publication not found' },
        });
      }

      const subscriber = await app.prisma.subscriber.findFirst({
        where: {
          publication_id: pubId,
          email: userEmail,
        },
        select: {
          tier: true,
          status: true,
          stripe_subscription_id: true,
        },
      });

      if (!subscriber || subscriber.status !== 'active') {
        return reply.send({
          success: true,
          data: {
            active: false,
            tier: 'free',
            stripeSubscriptionId: null,
            currentPeriodEnd: null,
          },
        });
      }

      let currentPeriodEnd: string | null = null;

      if (subscriber.stripe_subscription_id && subscriber.tier === 'paid') {
        try {
          const stripe = getStripe();
          const stripeSubscription = await stripe.subscriptions.retrieve(
            subscriber.stripe_subscription_id,
          );
          currentPeriodEnd = new Date(
            stripeSubscription.current_period_end * 1000,
          ).toISOString();
        } catch (err) {
          app.log.warn({ err }, 'Failed to fetch Stripe subscription details');
        }
      }

      return reply.send({
        success: true,
        data: {
          active: subscriber.status === 'active',
          tier: subscriber.tier,
          stripeSubscriptionId: subscriber.stripe_subscription_id,
          currentPeriodEnd,
        },
      });
    },
  );
}
