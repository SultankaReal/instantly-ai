'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient, ApiClientError } from '@/lib/api-client'

type UnsubscribeState = 'loading' | 'success' | 'error' | 'invalid'

function UnsubscribeContent(): React.JSX.Element {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const pubId = searchParams.get('pubId')
  const isValid = token && pubId
  const [state, setState] = useState<UnsubscribeState>(isValid ? 'loading' : 'invalid')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    if (!token || !pubId) {
      setState('invalid')
      return
    }

    const doUnsubscribe = async (): Promise<void> => {
      try {
        await apiClient.get(
          `/api/subscribers/unsubscribe?token=${encodeURIComponent(token)}&pubId=${encodeURIComponent(pubId)}`,
        )
        setState('success')
      } catch (err) {
        if (err instanceof ApiClientError && (err.status === 400 || err.status === 404)) {
          setState('invalid')
        } else {
          setState('error')
          setErrorMessage('Произошла ошибка. Попробуйте позже или напишите нам.')
        }
      }
    }

    void doUnsubscribe()
  }, [token, pubId])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
        {state === 'loading' && (
          <>
            <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Обрабатываем запрос...</h1>
            <p className="text-gray-500 text-sm">Пожалуйста, подождите</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Вы успешно отписались
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              Ваш адрес удалён из списка рассылки. Вы больше не будете получать письма.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              На главную
            </Link>
          </>
        )}

        {state === 'invalid' && (
          <>
            <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Ссылка недействительна
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              Ссылка устарела или уже была использована. Нажмите «Отписаться» в письме ещё раз.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              На главную
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Произошла ошибка</h1>
            <p className="text-gray-500 text-sm mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              Попробовать снова
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  )
}
