'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth'
import { api } from '@/lib/api'
import { useState } from 'react'

type Plan = 'start' | 'pro' | 'agency'
type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'

type Subscription = {
  plan: Plan
  status: SubscriptionStatus
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEnd?: string
}

type SubscriptionResponse = { data: Subscription | null }

const planNames: Record<Plan, string> = {
  start: 'Старт',
  pro: 'Про',
  agency: 'Агентство',
}

const planPrices: Record<Plan, string> = {
  start: '₽1 990',
  pro: '₽4 990',
  agency: '₽9 990',
}

const statusConfig: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: 'Активна', className: 'bg-green-50 text-green-700' },
  trialing: { label: 'Пробный период', className: 'bg-blue-50 text-blue-700' },
  past_due: { label: 'Просрочен платёж', className: 'bg-red-50 text-red-700' },
  canceled: { label: 'Отменена', className: 'bg-gray-50 text-gray-500' },
  incomplete: { label: 'Не завершена', className: 'bg-yellow-50 text-yellow-700' },
}

const PLANS: { id: Plan; name: string; price: string; features: string[] }[] = [
  {
    id: 'start',
    name: 'Старт',
    price: '₽1 990/мес',
    features: ['3 email-аккаунта', '1 кампания', 'Прогрев', '500 писем/день'],
  },
  {
    id: 'pro',
    name: 'Про',
    price: '₽4 990/мес',
    features: ['15 аккаунтов', 'Неограниченные кампании', 'AI-ответы', '5 000 писем/день'],
  },
  {
    id: 'agency',
    name: 'Агентство',
    price: '₽9 990/мес',
    features: ['∞ аккаунтов', '∞ кампаний', 'AI + обучение', '20 000 писем/день'],
  },
]

export default function BillingPage(): React.JSX.Element {
  const token = getAccessToken() ?? ''
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')

  const { data, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.billing.subscription(token) as Promise<SubscriptionResponse>,
    enabled: !!token,
  })

  const checkout = useMutation({
    mutationFn: ({ plan }: { plan: Plan }) =>
      api.billing.checkout(token, plan, period) as Promise<{ url: string }>,
    onSuccess: (res) => {
      window.location.href = res.url
    },
  })

  const cancelSubscription = useMutation({
    mutationFn: () => api.billing.cancel(token),
  })

  const subscription = data?.data

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Тарифный план</h1>
        <p className="text-gray-500 text-sm mt-1">Управляйте подпиской и оплатой</p>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="h-32 bg-white rounded-xl border border-gray-100 animate-pulse" />
          <div className="h-64 bg-white rounded-xl border border-gray-100 animate-pulse" />
        </div>
      )}

      {!isLoading && subscription && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Текущий план: {planNames[subscription.plan]}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {planPrices[subscription.plan]}/мес
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                statusConfig[subscription.status].className
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {statusConfig[subscription.status].label}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {subscription.cancelAtPeriodEnd ? (
                <span className="text-red-500">
                  Подписка отменена. Доступ до{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('ru-RU')}
                </span>
              ) : (
                <>
                  Следующее списание:{' '}
                  <span className="text-gray-700 font-medium">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('ru-RU')}
                  </span>
                </>
              )}
            </div>
            {!subscription.cancelAtPeriodEnd && (
              <button
                onClick={() => {
                  if (confirm('Вы уверены, что хотите отменить подписку?')) {
                    cancelSubscription.mutate()
                  }
                }}
                disabled={cancelSubscription.isPending}
                className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
              >
                {cancelSubscription.isPending ? 'Отмена...' : 'Отменить подписку'}
              </button>
            )}
          </div>
        </div>
      )}

      {!isLoading && !subscription && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-700">
          У вас нет активной подписки. Выберите план ниже чтобы начать.
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Изменить план</h2>
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'monthly'
                ? 'bg-blue-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Ежемесячно
          </button>
          <button
            onClick={() => setPeriod('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'annual'
                ? 'bg-blue-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Ежегодно
            <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">-20%</span>
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = subscription?.plan === plan.id
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border p-6 flex flex-col ${
                  isCurrent ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-xs bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full">
                      Текущий
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-4">{plan.price}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg
                        className="w-4 h-4 text-blue-500 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => checkout.mutate({ plan: plan.id })}
                  disabled={isCurrent || checkout.isPending}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  } disabled:opacity-50`}
                >
                  {isCurrent ? 'Текущий план' : checkout.isPending ? 'Переход...' : 'Выбрать'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
