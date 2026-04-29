import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Поток — холодные письма в Яндекс без спама',
  description:
    'Прогревайте домен, отправляйте холодные письма и получайте ответы с помощью AI. Flat pricing без % от дохода.',
}

const features = [
  {
    icon: '🔥',
    title: 'Автопрогрев домена',
    description:
      'Алгоритм имитирует реальную переписку, постепенно повышая репутацию вашего домена. Inbox Score растёт автоматически.',
  },
  {
    icon: '🤖',
    title: 'AI-ответы на автопилоте',
    description:
      'Система анализирует входящие письма и предлагает персонализированные ответы. Вы только одобряете — и не тратите время на черновики.',
  },
  {
    icon: '📬',
    title: 'Неограниченные аккаунты',
    description:
      'Подключайте столько email-аккаунтов, сколько нужно. Gmail, Яндекс, Mail.ru, корпоративные домены — всё через IMAP/SMTP.',
  },
  {
    icon: '💳',
    title: 'Flat pricing без сюрпризов',
    description:
      'Фиксированная ежемесячная оплата. Никаких % от числа отправленных писем или размера базы. Платите за возможности, не за рост.',
  },
]

const plans = [
  {
    name: 'Старт',
    price: '₽1 990',
    period: '/мес',
    description: 'Для старта и тестирования гипотез',
    features: [
      '3 email-аккаунта',
      '1 активная кампания',
      'Автопрогрев',
      'До 500 писем/день',
      'Базовая аналитика',
    ],
    cta: 'Попробовать бесплатно',
    ctaHref: '/register?plan=start',
    highlighted: false,
  },
  {
    name: 'Про',
    price: '₽4 990',
    period: '/мес',
    description: 'Для активных продаж и роста',
    features: [
      '15 email-аккаунтов',
      'Неограниченные кампании',
      'AI-ответы',
      'До 5 000 писем/день',
      'Единый инбокс',
      'Приоритетная поддержка',
    ],
    cta: 'Попробовать бесплатно',
    ctaHref: '/register?plan=pro',
    highlighted: true,
  },
  {
    name: 'Агентство',
    price: '₽9 990',
    period: '/мес',
    description: 'Для команд и агентств',
    features: [
      'Неограниченные аккаунты',
      'Неограниченные кампании',
      'AI-ответы + обучение',
      'До 20 000 писем/день',
      'White-label',
      'API-доступ',
      'Выделенный менеджер',
    ],
    cta: 'Связаться с нами',
    ctaHref: '/register?plan=agency',
    highlighted: false,
  },
]

export default function LandingPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">П</span>
              </div>
              <span className="font-semibold text-gray-900 text-lg">Поток</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                Возможности
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                Цены
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: '#0ea5e9' }}
              >
                Попробовать
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Новый способ холодных рассылок в России
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Холодные письма в Яндекс —{' '}
            <span className="text-blue-500">не в спам</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Прогревайте домен автоматически, отправляйте персонализированные последовательности и получайте
            AI-ответы за вас. Всё в одном инструменте по фиксированной цене.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-blue-500/25"
            >
              Попробовать 7 дней бесплатно
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
            >
              Посмотреть цены
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-500">Без кредитной карты. Отмена в любой момент.</p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 py-12 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '94%', label: 'Доставляемость в инбокс' },
              { value: '< 24ч', label: 'Время до первого ответа' },
              { value: '3×', label: 'Рост Reply Rate' },
              { value: '∞', label: 'Email-аккаунтов на плане Агентство' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Всё необходимое для холодного outreach
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Поток объединяет прогрев, рассылки и обработку ответов в одной платформе без лишних интеграций.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-8 rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-50 transition-all"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Прозрачные цены</h2>
            <p className="text-lg text-gray-600">
              Фиксированная ежемесячная оплата. Никаких % от писем или базы.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 flex flex-col ${
                  plan.highlighted
                    ? 'bg-blue-500 text-white shadow-2xl shadow-blue-500/30 scale-105'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="mb-6">
                  <div
                    className={`text-sm font-semibold mb-2 ${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}
                  >
                    {plan.highlighted && (
                      <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full mr-2">
                        Популярный
                      </span>
                    )}
                    {plan.name}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className={`text-sm ${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                      {plan.period}
                    </span>
                  </div>
                  <p className={`text-sm mt-2 ${plan.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                    {plan.description}
                  </p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <svg
                        className={`w-5 h-5 flex-shrink-0 ${plan.highlighted ? 'text-blue-100' : 'text-blue-500'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className={plan.highlighted ? 'text-white' : 'text-gray-700'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.ctaHref as '/register'}
                  className={`w-full text-center py-3 px-6 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-blue-500 hover:bg-blue-50'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
            Начните получать ответы уже сегодня
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            7 дней бесплатно. Подключите аккаунт, запустите прогрев и отправьте первую кампанию без риска.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-blue-500/25"
          >
            Попробовать 7 дней бесплатно
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">П</span>
            </div>
            <span className="text-gray-600 text-sm">Поток © 2025</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-700 transition-colors">
              Политика конфиденциальности
            </a>
            <a href="#" className="hover:text-gray-700 transition-colors">
              Условия использования
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
