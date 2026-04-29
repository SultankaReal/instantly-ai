import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Поток — холодные письма в Яндекс без спама',
  description:
    'SaaS-платформа для автоматизации холодных email-рассылок с прогревом, AI-ответами и неограниченным числом аккаунтов. Flat pricing, без % с дохода.',
  keywords: ['холодные письма', 'cold email', 'email outreach', 'прогрев домена', 'Яндекс почта'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.JSX.Element {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
