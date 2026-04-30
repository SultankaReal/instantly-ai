import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type DunningEmailProps = {
  /** Display name of the subscriber */
  subscriberName: string | null;
  /** Display name of the newsletter/publication */
  publicationName: string;
  /**
   * Amount owed in cents (e.g. 500 = $5.00).
   * Rendered as a formatted currency string.
   */
  amount: number;
  /** Stripe-hosted link to update payment method and retry */
  retryUrl: string;
  /** Stripe billing portal URL to cancel the subscription */
  cancelUrl: string;
};

/** Format cents to a display string like "$5.00" */
function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export const DunningEmail = ({
  subscriberName,
  publicationName,
  amount,
  retryUrl,
  cancelUrl,
}: DunningEmailProps): React.ReactElement => {
  const greeting = subscriberName ? `Hi ${subscriberName},` : 'Hi there,';
  const formattedAmount = formatAmount(amount);

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Action required: payment failed for {publicationName}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={headerText}>{publicationName}</Text>
          </Section>

          {/* Alert banner */}
          <Section style={alertBanner}>
            <Text style={alertText}>Payment failed</Text>
          </Section>

          {/* Main content */}
          <Section style={content}>
            <Heading style={h1}>We couldn&apos;t process your payment</Heading>

            <Text style={paragraph}>{greeting}</Text>
            <Text style={paragraph}>
              Your payment of <strong>{formattedAmount}</strong> for your subscription to{' '}
              <strong>{publicationName}</strong> was declined. To keep reading without interruption,
              please update your payment details.
            </Text>

            {/* Primary CTA */}
            <Section style={buttonContainer}>
              <Button style={primaryButton} href={retryUrl}>
                Update payment method
              </Button>
            </Section>

            <Hr style={hr} />

            {/* What happens next */}
            <Text style={subheading}>What happens next?</Text>
            <Text style={paragraph}>
              We&apos;ll retry your payment automatically. If the payment continues to fail your
              access to paid content on <strong>{publicationName}</strong> will be paused until the
              balance is settled.
            </Text>

            {/* Cancel option */}
            <Text style={cancelNote}>
              If you&apos;d like to cancel your subscription instead, you can do so at any time via
              your{' '}
              <Link href={cancelUrl} style={cancelLink}>
                billing portal
              </Link>
              .
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              This is an automated billing email from{' '}
              <Link href="https://inkflow.io" style={inkflowLink}>
                Inkflow
              </Link>{' '}
              on behalf of <strong>{publicationName}</strong>.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

DunningEmail.PreviewProps = {
  subscriberName: 'Alex',
  publicationName: 'The Weekly Dispatch',
  amount: 900,
  retryUrl: 'https://billing.stripe.com/session/example-retry',
  cancelUrl: 'https://billing.stripe.com/session/example-portal',
} satisfies DunningEmailProps;

export default DunningEmail;

// ─── Styles ───────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '40px auto',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
};

const header: React.CSSProperties = {
  backgroundColor: '#1a1a2e',
  padding: '24px 40px',
};

const headerText: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  margin: 0,
  lineHeight: '1',
};

const alertBanner: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  borderBottom: '1px solid #fecaca',
  padding: '12px 40px',
};

const alertText: React.CSSProperties = {
  color: '#b91c1c',
  fontSize: '13px',
  fontWeight: '600',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const content: React.CSSProperties = {
  padding: '36px 40px 24px',
};

const h1: React.CSSProperties = {
  color: '#1a1a2e',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 20px',
  lineHeight: '1.3',
};

const paragraph: React.CSSProperties = {
  color: '#444444',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const subheading: React.CSSProperties = {
  color: '#1a1a2e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px',
};

const buttonContainer: React.CSSProperties = {
  margin: '28px 0',
};

const primaryButton: React.CSSProperties = {
  backgroundColor: '#ef4444',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '13px 28px',
  display: 'inline-block',
};

const hr: React.CSSProperties = {
  borderColor: '#e8e8e8',
  margin: '24px 0',
};

const cancelNote: React.CSSProperties = {
  color: '#888888',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '16px 0 0',
};

const cancelLink: React.CSSProperties = {
  color: '#6366f1',
  textDecoration: 'underline',
};

const footerSection: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  padding: '20px 40px',
  borderTop: '1px solid #e8e8e8',
};

const footerText: React.CSSProperties = {
  color: '#aaaaaa',
  fontSize: '12px',
  margin: 0,
  textAlign: 'center',
};

const inkflowLink: React.CSSProperties = {
  color: '#6366f1',
  textDecoration: 'none',
};
