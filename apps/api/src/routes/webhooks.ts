import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import crypto from 'crypto';

type PostmarkOpenEvent = {
  RecordType: 'Open';
  MessageID: string;
  ReceivedAt: string;
  UserAgent?: string;
};

type PostmarkClickEvent = {
  RecordType: 'Click';
  MessageID: string;
  ReceivedAt: string;
  OriginalLink: string;
  UserAgent?: string;
};

type PostmarkBounceEvent = {
  RecordType: 'Bounce';
  MessageID: string;
  BouncedAt: string;
  Type: string;
  Email: string;
};

type PostmarkDeliveryEvent = {
  RecordType: 'Delivery';
  MessageID: string;
  DeliveredAt: string;
};

type PostmarkSpamComplaintEvent = {
  RecordType: 'SpamComplaint';
  MessageID: string;
  BouncedAt: string;
  Email: string;
};

type PostmarkEvent =
  | PostmarkOpenEvent
  | PostmarkClickEvent
  | PostmarkBounceEvent
  | PostmarkDeliveryEvent
  | PostmarkSpamComplaintEvent;

function getStripe(): Stripe {
  const secretKey = process.env['STRIPE_SECRET_KEY'];
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' });
}

function verifyPostmarkSignature(payload: string, signature: string, token: string): boolean {
  const expected = crypto
    .createHmac('sha256', token)
    .update(payload)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Register raw body parser for Stripe webhooks — must be done before route registration
  // Stripe requires the raw Buffer to verify the signature.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    function (_req, body, done) {
      done(null, body);
    },
  );

  // POST /api/webhooks/stripe
  app.post(
    '/api/webhooks/stripe',
    {
      schema: {
        description: 'Stripe webhook endpoint',
        tags: ['webhooks'],
      },
    },
    async (request, reply): Promise<{ received: boolean }> => {
      const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
      if (!webhookSecret) {
        app.log.error('STRIPE_WEBHOOK_SECRET not configured');
        return reply.status(500).send({ received: false });
      }

      const sig = request.headers['stripe-signature'] as string | undefined;
      if (!sig) {
        app.log.warn('Stripe webhook missing signature header');
        return reply.status(400).send({ received: false });
      }

      const rawBody = request.body as Buffer;
      const stripe = getStripe();

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err) {
        app.log.warn({ err }, 'Stripe webhook signature verification failed');
        return reply.status(400).send({ received: false });
      }

      app.log.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutCompleted(app, session);
            break;
          }
          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            await handlePaymentFailed(app, invoice);
            break;
          }
          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionDeleted(app, subscription);
            break;
          }
          default:
            app.log.info({ eventType: event.type }, 'Stripe webhook event ignored');
        }
      } catch (err) {
        app.log.error({ err, eventType: event.type }, 'Error processing Stripe webhook event');
        // Return 200 to prevent Stripe from retrying — log the error for alerting
        return reply.status(200).send({ received: true });
      }

      return reply.status(200).send({ received: true });
    },
  );

  // POST /api/webhooks/postmark
  app.post(
    '/api/webhooks/postmark',
    {
      schema: {
        description: 'Postmark webhook endpoint for email events',
        tags: ['webhooks'],
      },
    },
    async (request, reply): Promise<{ received: boolean }> => {
      const postmarkToken = process.env['POSTMARK_WEBHOOK_SECRET'];
      if (!postmarkToken) {
        app.log.error('POSTMARK_WEBHOOK_SECRET not configured');
        return reply.status(500).send({ received: false });
      }

      const signature = request.headers['x-postmark-signature'] as string | undefined;

      // Verify signature if provided — always enforce in production
      if (process.env['NODE_ENV'] === 'production') {
        if (!signature) {
          app.log.warn('Postmark webhook missing signature header');
          return reply.status(401).send({ received: false });
        }

        const rawBody = request.body as Buffer;
        const isValid = verifyPostmarkSignature(rawBody.toString('utf8'), signature, postmarkToken);

        if (!isValid) {
          app.log.warn('Postmark webhook signature verification failed');
          return reply.status(401).send({ received: false });
        }
      }

      const rawBody = request.body as Buffer;
      let eventData: PostmarkEvent;

      try {
        eventData = JSON.parse(rawBody.toString('utf8')) as PostmarkEvent;
      } catch (err) {
        app.log.warn({ err }, 'Failed to parse Postmark webhook body');
        return reply.status(400).send({ received: false });
      }

      app.log.info({ recordType: eventData.RecordType }, 'Postmark webhook received');

      try {
        await processPostmarkEvent(app, eventData);
      } catch (err) {
        app.log.error({ err, recordType: eventData.RecordType }, 'Error processing Postmark webhook');
        // Return 200 to prevent Postmark from retrying
        return reply.status(200).send({ received: true });
      }

      return reply.status(200).send({ received: true });
    },
  );
}

// ── Stripe event handlers ──────────────────────────────────────────────────

async function handleCheckoutCompleted(
  app: FastifyInstance,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const publicationId = session.metadata?.['publication_id'];
  const subscriberEmail = session.metadata?.['subscriber_email'];
  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  const stripeSubscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null;

  if (!publicationId || !subscriberEmail) {
    app.log.warn({ sessionId: session.id }, 'Checkout session missing metadata');
    return;
  }

  // Upgrade or create subscriber to paid tier
  await app.prisma.subscriber.upsert({
    where: {
      publication_id_email: {
        publication_id: publicationId,
        email: subscriberEmail,
      },
    },
    update: {
      status: 'active',
      tier: 'paid',
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      confirmed_at: new Date(),
      confirmation_token: null,
      confirmation_token_expires_at: null,
    },
    create: {
      publication_id: publicationId,
      email: subscriberEmail,
      status: 'active',
      tier: 'paid',
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      confirmed_at: new Date(),
    },
  });

  app.log.info(
    { publicationId, subscriberEmail, stripeSubscriptionId },
    'Subscriber upgraded to paid tier',
  );
}

async function handlePaymentFailed(
  app: FastifyInstance,
  invoice: Stripe.Invoice,
): Promise<void> {
  const stripeCustomerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;

  if (!stripeCustomerId) {
    app.log.warn({ invoiceId: invoice.id }, 'Invoice missing customer ID');
    return;
  }

  // Mark subscriber as past_due
  await app.prisma.subscriber.updateMany({
    where: { stripe_customer_id: stripeCustomerId, status: 'active' },
    data: { tier: 'past_due' },
  });

  app.log.info({ stripeCustomerId }, 'Subscriber marked as past_due due to payment failure');
}

async function handleSubscriptionDeleted(
  app: FastifyInstance,
  subscription: Stripe.Subscription,
): Promise<void> {
  const stripeSubscriptionId = subscription.id;

  await app.prisma.subscriber.updateMany({
    where: { stripe_subscription_id: stripeSubscriptionId },
    data: {
      tier: 'free',
      status: 'unsubscribed',
      unsubscribed_at: new Date(),
      stripe_subscription_id: null,
    },
  });

  app.log.info({ stripeSubscriptionId }, 'Subscriber downgraded due to subscription deletion');
}

// ── Postmark event handler ─────────────────────────────────────────────────

async function processPostmarkEvent(
  app: FastifyInstance,
  event: PostmarkEvent,
): Promise<void> {
  switch (event.RecordType) {
    case 'Open': {
      const emailSend = await app.prisma.emailSend.findFirst({
        where: { postmark_message_id: event.MessageID },
        select: { id: true },
      });
      if (!emailSend) {
        app.log.warn({ messageId: event.MessageID }, 'Postmark Open: no EmailSend found');
        return;
      }
      await app.prisma.emailEvent.create({
        data: {
          email_send_id: emailSend.id,
          event_type: 'open',
          user_agent: event.UserAgent ?? null,
          occurred_at: new Date(event.ReceivedAt),
        },
      });
      break;
    }
    case 'Click': {
      const emailSend = await app.prisma.emailSend.findFirst({
        where: { postmark_message_id: event.MessageID },
        select: { id: true },
      });
      if (!emailSend) {
        app.log.warn({ messageId: event.MessageID }, 'Postmark Click: no EmailSend found');
        return;
      }
      await app.prisma.emailEvent.create({
        data: {
          email_send_id: emailSend.id,
          event_type: 'click',
          link_url: event.OriginalLink,
          user_agent: event.UserAgent ?? null,
          occurred_at: new Date(event.ReceivedAt),
        },
      });
      break;
    }
    case 'Bounce': {
      const emailSend = await app.prisma.emailSend.findFirst({
        where: { postmark_message_id: event.MessageID },
        select: { id: true, subscriber_id: true },
      });
      if (!emailSend) {
        app.log.warn({ messageId: event.MessageID }, 'Postmark Bounce: no EmailSend found');
        return;
      }

      await app.prisma.$transaction([
        app.prisma.emailSend.update({
          where: { id: emailSend.id },
          data: { status: 'bounced', failed_at: new Date(event.BouncedAt) },
        }),
        app.prisma.emailEvent.create({
          data: {
            email_send_id: emailSend.id,
            event_type: 'bounce',
            occurred_at: new Date(event.BouncedAt),
          },
        }),
        // Mark subscriber as bounced to stop future sends
        app.prisma.subscriber.update({
          where: { id: emailSend.subscriber_id },
          data: { status: 'bounced' },
        }),
      ]);
      break;
    }
    case 'Delivery': {
      const emailSend = await app.prisma.emailSend.findFirst({
        where: { postmark_message_id: event.MessageID },
        select: { id: true },
      });
      if (!emailSend) {
        app.log.warn({ messageId: event.MessageID }, 'Postmark Delivery: no EmailSend found');
        return;
      }
      await app.prisma.emailSend.update({
        where: { id: emailSend.id },
        data: {
          status: 'delivered',
          delivered_at: new Date(event.DeliveredAt),
        },
      });
      break;
    }
    case 'SpamComplaint': {
      const emailSend = await app.prisma.emailSend.findFirst({
        where: { postmark_message_id: event.MessageID },
        select: { id: true, subscriber_id: true },
      });
      if (!emailSend) {
        app.log.warn({ messageId: event.MessageID }, 'Postmark SpamComplaint: no EmailSend found');
        return;
      }

      await app.prisma.$transaction([
        app.prisma.emailEvent.create({
          data: {
            email_send_id: emailSend.id,
            event_type: 'spam_complaint',
            occurred_at: new Date(event.BouncedAt),
          },
        }),
        app.prisma.subscriber.update({
          where: { id: emailSend.subscriber_id },
          data: {
            status: 'spam',
            unsubscribed_at: new Date(),
          },
        }),
      ]);
      break;
    }
    default:
      app.log.info({ recordType: (event as { RecordType: string }).RecordType }, 'Postmark event ignored');
  }
}
