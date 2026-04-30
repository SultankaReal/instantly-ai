import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type ConfirmationEmailProps = {
  /** Display name of the newsletter/publication */
  publicationName: string;
  /** Full confirmation URL (includes token) */
  confirmationUrl: string;
  /** Author's display name */
  authorName: string;
};

export const ConfirmationEmail = ({
  publicationName,
  confirmationUrl,
  authorName,
}: ConfirmationEmailProps): React.ReactElement => {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Confirm your subscription to {publicationName}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={headerText}>{publicationName}</Text>
          </Section>

          {/* Main content */}
          <Section style={content}>
            <Heading style={h1}>One last step!</Heading>
            <Text style={paragraph}>
              Hi there! You&apos;re almost subscribed to <strong>{publicationName}</strong> by{' '}
              {authorName}.
            </Text>
            <Text style={paragraph}>
              Please click the button below to confirm your email address and activate your
              subscription.
            </Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={confirmationUrl}>
                Confirm subscription
              </Button>
            </Section>

            <Text style={paragraph}>
              Or copy and paste this link into your browser:
            </Text>
            <Text style={link}>{confirmationUrl}</Text>

            <Hr style={hr} />

            {/* Expiry notice */}
            <Text style={footer}>
              This link expires in <strong>48 hours</strong>. If you did not sign up for{' '}
              {publicationName}, you can safely ignore this email — you will not be subscribed.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Sent by <strong>{authorName}</strong> via{' '}
              <a href="https://inkflow.io" style={inkflowLink}>
                Inkflow
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

ConfirmationEmail.PreviewProps = {
  publicationName: 'The Weekly Dispatch',
  confirmationUrl: 'https://inkflow.io/confirm?token=abc123',
  authorName: 'Jane Doe',
} satisfies ConfirmationEmailProps;

export default ConfirmationEmail;

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
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const buttonContainer: React.CSSProperties = {
  textAlign: 'center',
  margin: '32px 0',
};

const button: React.CSSProperties = {
  backgroundColor: '#6366f1',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '14px 32px',
  display: 'inline-block',
};

const link: React.CSSProperties = {
  color: '#6366f1',
  fontSize: '13px',
  wordBreak: 'break-all',
  margin: '0 0 24px',
};

const hr: React.CSSProperties = {
  borderColor: '#e8e8e8',
  margin: '24px 0',
};

const footer: React.CSSProperties = {
  color: '#888888',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: 0,
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
