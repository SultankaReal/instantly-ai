'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth'
import { api } from '@/lib/api'
import { useState } from 'react'

type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'error'

type Campaign = {
  id: string
  name: string
  status: CampaignStatus
  sentCount: number
  replyCount: number
  openRate: number
  replyRate: number
  createdAt: string
}

type CampaignsResponse = { data: Campaign[] }

const statusConfig: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'bg-gray-50 text-gray-600' },
  active: { label: 'Активна', className: 'bg-green-50 text-green-700' },
  paused: { label: 'Пауза', className: 'bg-yellow-50 text-yellow-700' },
  completed: { label: 'Завершена', className: 'bg-blue-50 text-blue-700' },
  error: { label: 'Ошибка', className: 'bg-red-50 text-red-700' },
}

export default function CampaignsPage(): React.JSX.Element {
  const token = getAccessToken() ?? ''
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.campaigns.list(token) as Promise<CampaignsResponse>,
    enabled: !!token,
  })

  const startCampaign = useMutation({
    mutationFn: (id: string) => api.campaigns.start(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  })

  const pauseCampaign = useMutation({
    mutationFn: (id: string) => api.campaigns.pause(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  })

  const campaigns: Campaign[] = data?.data ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Кампании</h1>
          <p className="text-gray-500 text-sm mt-1">
            {campaigns.length > 0 ? `${campaigns.length} кампаний` : 'Создайте первую кампанию'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать кампанию
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && campaigns.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 border-dashed p-16 text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет кампаний</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            Создайте первую кампанию: загрузите список лидов, напишите последовательность и запустите.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать кампанию
          </button>
        </div>
      )}

      {!isLoading && campaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Кампания
                </th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Статус
                </th>
                <th className="text-right text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Отправлено
                </th>
                <th className="text-right text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Открытий
                </th>
                <th className="text-right text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Ответов
                </th>
                <th className="text-right text-xs font-medium text-gray-500 px-6 py-4 uppercase tracking-wide">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const statusCfg = statusConfig[campaign.status]
                return (
                  <tr
                    key={campaign.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(campaign.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.className}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{campaign.sentCount.toLocaleString('ru-RU')}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{campaign.openRate.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{campaign.replyRate.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {campaign.status === 'active' ? (
                          <button
                            onClick={() => pauseCampaign.mutate(campaign.id)}
                            disabled={pauseCampaign.isPending}
                            className="text-xs font-medium text-yellow-600 hover:text-yellow-700 border border-yellow-200 hover:border-yellow-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Пауза
                          </button>
                        ) : campaign.status === 'paused' || campaign.status === 'draft' ? (
                          <button
                            onClick={() => startCampaign.mutate(campaign.id)}
                            disabled={startCampaign.isPending}
                            className="text-xs font-medium text-green-600 hover:text-green-700 border border-green-200 hover:border-green-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Запустить
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Новая кампания</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Название кампании</label>
                <input
                  type="text"
                  placeholder="Outreach Q1 2025"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 text-sm outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button className="flex-1 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
