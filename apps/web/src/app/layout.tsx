import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Inkflow',
    template: '%s | Inkflow',
  },
  description:
    'Inkflow — the newsletter platform with 0% commission, native SEO, and AI writing tools. Keep 100% of your revenue.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://inkflow.io'),
  openGraph: {
    type: 'website',
    siteName: 'Inkflow',
    title: 'Inkflow — Newsletter Platform with 0% Commission',
    description:
      'Inkflow — the newsletter platform with 0% commission, native SEO, and AI writing tools.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inkflow — Newsletter Platform with 0% Commission',
    description:
      'Inkflow — the newsletter platform with 0% commission, native SEO, and AI writing tools.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white antialiased">
          <Providers>{children}</Providers>
        </body>
    </html>
  );
}
