'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth'
import { api } from '@/lib/api'
import { useState } from 'react'

type AccountStatus = 'connected' | 'warming' | 'paused' | 'error'
type DnsStatus = { spf: boolean; dkim: boolean; dmarc: boolean }

type EmailAccount = {
  id: string
  email: string
  status: AccountStatus
  inboxScore: number
  dns: DnsStatus
  dailySendLimit: number
  warmupEnabled: boolean
}

type AccountsResponse = { data: EmailAccount[] }

const statusConfig: Record<AccountStatus, { label: string; className: string }> = {
  connected: { label: 'Подключён', className: 'bg-green-50 text-green-700' },
  warming: { label: 'Прогрев', className: 'bg-blue-50 text-blue-700' },
  paused: { label: 'Пауза', className: 'bg-yellow-50 text-yellow-700' },
  error: { label: 'Ошибка', className: 'bg-red-50 text-red-700' },
}

function ScoreBadge({ score }: { score: number }): React.JSX.Element {
  const color =
    score >= 85
      ? 'text-green-700 bg-green-50'
      : score >= 70
        ? 'text-yellow-700 bg-yellow-50'
        : 'text-red-700 bg-red-50'
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {score}
    </span>
  )
}

function DnsChecks({ dns }: { dns: DnsStatus }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {(['spf', 'dkim', 'dmarc'] as const).map((key) => (
        <span
          key={key}
          title={`${key.toUpperCase()}: ${dns[key] ? 'ОК' : 'Не настроен'}`}
          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
            dns[key] ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400 line-through'
          }`}
        >
          {key.toUpperCase()}
        </span>
      ))}
    </div>
  )
}

export default function AccountsPage(): React.JSX.Element {
  const token = getAccessToken() ?? ''
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(token) as Promise<AccountsResponse>,
    enabled: !!token,
  })

  const startWarmup = useMutation({
    mutationFn: (id: string) => api.accounts.startWarmup(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const stopWarmup = useMutation({
    mutationFn: (id: string) => api.accounts.stopWarmup(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const accounts: EmailAccount[] = data?.data ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email-аккаунты</h1>
          <p className="text-gray-500 text-sm mt-1">
            {accounts.length > 0 ? `${accounts.length} аккаунтов подключено` : 'Добавьте первый аккаунт'}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Добавить аккаунт
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && accounts.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 border-dashed p-16 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет подключённых аккаунтов</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            Подключите email-аккаунт через IMAP/SMTP для отправки холодных писем и прогрева домена.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Добавить первый аккаунт
          </button>
        </div>
      )}

      {!isLoading && accounts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Аккаунт
                </th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Статус
                </th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Inbox Score
                </th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  DNS
                </th>
                <th className="text-right text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const statusCfg = statusConfig[account.status]
                return (
                  <tr key={account.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 text-sm font-medium">
                          {account.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{account.email}</div>
                          <div className="text-xs text-gray-400">
                            До {account.dailySendLimit} писем/день
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.className}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ScoreBadge score={account.inboxScore} />
                    </td>
                    <td className="px-6 py-4">
                      <DnsChecks dns={account.dns} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {account.warmupEnabled ? (
                        <button
                          onClick={() => stopWarmup.mutate(account.id)}
                          disabled={stopWarmup.isPending}
                          className="text-xs font-medium text-yellow-600 hover:text-yellow-700 border border-yellow-200 hover:border-yellow-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Стоп прогрев
                        </button>
                      ) : (
                        <button
                          onClick={() => startWarmup.mutate(account.id)}
                          disabled={startWarmup.isPending}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Запустить прогрев
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Добавить email-аккаунт</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль / App Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 text-sm outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">IMAP-сервер</label>
                  <input
                    type="text"
                    placeholder="imap.yandex.ru"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP-сервер</label>
                  <input
                    type="text"
                    placeholder="smtp.yandex.ru"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 text-sm outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button className="flex-1 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors">
                Подключить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
