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

export type UnsubscribeConfirmationEmailProps = {
  /** Display name of the newsletter/publication */
  publicationName: string;
  /** URL to re-subscribe (can be the publication's subscribe page) */
  resubscribeUrl: string;
};

export const UnsubscribeConfirmationEmail = ({
  publicationName,
  resubscribeUrl,
}: UnsubscribeConfirmationEmailProps): React.ReactElement => {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You have been unsubscribed from {publicationName}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={headerText}>{publicationName}</Text>
          </Section>

          {/* Main content */}
          <Section style={content}>
            <Heading style={h1}>You&apos;re unsubscribed</Heading>

            <Text style={paragraph}>
              You have been successfully removed from the <strong>{publicationName}</strong>{' '}
              mailing list. You will not receive any further emails from this publication.
            </Text>

            <Text style={paragraph}>
              We&apos;re sorry to see you go. If you unsubscribed by mistake or change your mind
              you can rejoin at any time.
            </Text>

            {/* Re-subscribe CTA */}
            <Section style={buttonContainer}>
              <Button style={button} href={resubscribeUrl}>
                Re-subscribe
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={note}>
              If you continue to receive emails after unsubscribing, please reply to this message
              or contact us at{' '}
              <Link href="mailto:support@inkflow.io" style={supportLink}>
                support@inkflow.io
              </Link>
              .
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Delivered via{' '}
              <Link href="https://inkflow.io" style={inkflowLink}>
                Inkflow
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

UnsubscribeConfirmationEmail.PreviewProps = {
  publicationName: 'The Weekly Dispatch',
  resubscribeUrl: 'https://example.inkflow.io/subscribe',
} satisfies UnsubscribeConfirmationEmailProps;

export default UnsubscribeConfirmationEmail;

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

const content: React.CSSProperties = {
  padding: '40px 40px 24px',
};

const h1: React.CSSProperties = {
  color: '#1a1a2e',
  fontSize: '26px',
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

const buttonContainer: React.CSSProperties = {
  margin: '28px 0',
};

const button: React.CSSProperties = {
  backgroundColor: '#6366f1',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 28px',
  display: 'inline-block',
};

const hr: React.CSSProperties = {
  borderColor: '#e8e8e8',
  margin: '24px 0',
};

const note: React.CSSProperties = {
  color: '#888888',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: 0,
};

const supportLink: React.CSSProperties = {
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
