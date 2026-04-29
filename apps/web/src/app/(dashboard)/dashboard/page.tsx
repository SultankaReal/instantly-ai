'use client'

import { useQuery } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth'
import { api } from '@/lib/api'

type AccountsResponse = { data: unknown[] }
type CampaignsResponse = { data: unknown[] }
type InboxResponse = { data: unknown[]; unread: number }

function StatCard({
  title,
  value,
  subtitle,
  color = 'blue',
}: {
  title: string
  value: string | number
  subtitle?: string
  color?: 'blue' | 'green' | 'yellow' | 'purple'
}): React.JSX.Element {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4 ${colorMap[color]}`}>
        <div className="w-4 h-4 rounded-full bg-current opacity-60" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-700 mt-1">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  )
}

export default function DashboardPage(): React.JSX.Element {
  const token = getAccessToken() ?? ''

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(token) as Promise<AccountsResponse>,
    enabled: !!token,
  })

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.campaigns.list(token) as Promise<CampaignsResponse>,
    enabled: !!token,
  })

  const { data: inbox } = useQuery({
    queryKey: ['inbox', 1],
    queryFn: () => api.inbox.list(token, 1) as Promise<InboxResponse>,
    enabled: !!token,
  })

  const accountCount = accounts?.data?.length ?? 0
  const campaignCount = campaigns?.data?.length ?? 0
  const unreadCount = inbox?.unread ?? 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Обзор</h1>
        <p className="text-gray-500 text-sm mt-1">Сводка по вашим аккаунтам и кампаниям</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Email-аккаунтов"
          value={accountCount}
          subtitle="подключено"
          color="blue"
        />
        <StatCard
          title="Активных кампаний"
          value={campaignCount}
          subtitle="в работе"
          color="green"
        />
        <StatCard
          title="Непрочитанных"
          value={unreadCount}
          subtitle="в инбоксе"
          color="yellow"
        />
        <StatCard
          title="Inbox Score"
          value="—"
          subtitle="нет данных"
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Быстрые действия</h2>
          <div className="space-y-3">
            {[
              { label: 'Добавить email-аккаунт', href: '/accounts', icon: '📬' },
              { label: 'Создать кампанию', href: '/campaigns', icon: '🚀' },
              { label: 'Проверить инбокс', href: '/inbox', icon: '📥' },
            ].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors group"
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                  {action.label}
                </span>
                <svg
                  className="w-4 h-4 text-gray-400 group-hover:text-blue-500 ml-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Статус системы</h2>
          <div className="space-y-3">
            {[
              { label: 'Прогрев домена', status: 'Активен', ok: true },
              { label: 'Email-доставка', status: 'Работает', ok: true },
              { label: 'AI-ответы', status: 'Ожидание', ok: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{item.label}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    item.ok ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
