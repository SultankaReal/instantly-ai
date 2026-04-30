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
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type PostNotificationEmailProps = {
  /** Title of the newly published post */
  postTitle: string;
  /** Full URL to the post on the publication's site */
  postUrl: string;
  /** Display name of the newsletter/publication */
  publicationName: string;
  /** Plain-text excerpt (~200 chars) shown as a teaser */
  excerpt: string;
  /** Author's display name */
  authorName: string;
  /**
   * 1×1 pixel tracking URL provided by Postmark.
   * Rendered as a hidden <img> at the bottom of the email.
   * Must be present for open-rate tracking to function.
   */
  trackingPixelUrl: string;
  /** One-click unsubscribe link for this subscriber */
  unsubscribeUrl: string;
};

export const PostNotificationEmail = ({
  postTitle,
  postUrl,
  publicationName,
  excerpt,
  authorName,
  trackingPixelUrl,
  unsubscribeUrl,
}: PostNotificationEmailProps): React.ReactElement => {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      {/* Preheader / preview text */}
      <Preview>
        {publicationName}: {excerpt.slice(0, 120)}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header bar */}
          <Section style={header}>
            <Text style={headerPub}>{publicationName}</Text>
            <Text style={headerBy}>by {authorName}</Text>
          </Section>

          {/* Post content */}
          <Section style={content}>
            <Heading style={h1}>{postTitle}</Heading>

            {/* Excerpt */}
            <Text style={excerptStyle}>{excerpt}</Text>

            {/* Read CTA */}
            <Section style={buttonContainer}>
              <Button style={button} href={postUrl}>
                Read the full post →
              </Button>
            </Section>

            <Hr style={hr} />

            {/* Reply prompt */}
            <Text style={replyNote}>
              Reply to this email — {authorName} reads every message.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              You&apos;re subscribed to{' '}
              <Link href={postUrl} style={footerLink}>
                {publicationName}
              </Link>
              .{' '}
              <Link href={unsubscribeUrl} style={unsubLink}>
                Unsubscribe
              </Link>
            </Text>
            <Text style={footerPowered}>
              Delivered via{' '}
              <Link href="https://inkflow.io" style={footerLink}>
                Inkflow
              </Link>
            </Text>
          </Section>

          {/* Postmark open-tracking pixel — must be last visible element */}
          {trackingPixelUrl !== '' && (
            <Img
              src={trackingPixelUrl}
              width={1}
              height={1}
              alt=""
              style={{ display: 'block', width: '1px', height: '1px', border: 0 }}
            />
          )}
        </Container>
      </Body>
    </Html>
  );
};

PostNotificationEmail.PreviewProps = {
  postTitle: 'Why the creator economy is shifting again',
  postUrl: 'https://example.inkflow.io/posts/creator-economy-shift',
  publicationName: 'The Weekly Dispatch',
  excerpt:
    'For years, platforms took a growing cut. But the math has changed. In this post we break down the new economics of owning your audience outright and what that means for independent writers.',
  authorName: 'Jane Doe',
  trackingPixelUrl: 'https://api.postmarkapp.com/track/open/example-message-id',
  unsubscribeUrl: 'https://example.inkflow.io/unsubscribe?token=abc123',
} satisfies PostNotificationEmailProps;

export default PostNotificationEmail;

// ─── Styles ───────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: '600px',
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

const headerPub: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0 0 2px',
  lineHeight: '1.2',
};

const headerBy: React.CSSProperties = {
  color: '#a5b4fc',
  fontSize: '13px',
  margin: 0,
};

const content: React.CSSProperties = {
  padding: '40px 40px 24px',
};

const h1: React.CSSProperties = {
  color: '#1a1a2e',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 20px',
};

const excerptStyle: React.CSSProperties = {
  color: '#555555',
  fontSize: '16px',
  lineHeight: '1.7',
  margin: '0 0 32px',
  borderLeft: '3px solid #e0e7ff',
  paddingLeft: '16px',
};

const buttonContainer: React.CSSProperties = {
  margin: '0 0 32px',
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

const replyNote: React.CSSProperties = {
  color: '#888888',
  fontSize: '14px',
  fontStyle: 'italic',
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
  margin: '0 0 4px',
  textAlign: 'center',
};

const footerPowered: React.CSSProperties = {
  color: '#cccccc',
  fontSize: '11px',
  margin: 0,
  textAlign: 'center',
};

const footerLink: React.CSSProperties = {
  color: '#6366f1',
  textDecoration: 'none',
};

const unsubLink: React.CSSProperties = {
  color: '#aaaaaa',
  textDecoration: 'underline',
};
