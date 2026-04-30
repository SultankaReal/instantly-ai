'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useState } from 'react'

const forgotSchema = z.object({
  email: z.string().email('Введите корректный email'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage(): React.JSX.Element {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotForm): Promise<void> => {
    setServerError(null)
    try {
      await api.auth.forgotPassword(data.email)
      setSent(true)
    } catch {
      setServerError('Произошла ошибка. Попробуйте ещё раз.')
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Письмо отправлено</h2>
          <p className="text-gray-600 text-sm mb-6">
            Мы отправили инструкции по сбросу пароля на вашу почту. Проверьте папку «Входящие» и «Спам».
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Вернуться к входу
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Сброс пароля</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Введите email и мы пришлём ссылку для сброса пароля
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors ${
                errors.email
                  ? 'border-red-300 focus:border-red-400 bg-red-50'
                  : 'border-gray-200 focus:border-blue-400 bg-white'
              }`}
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl text-sm transition-colors"
          >
            {isSubmitting ? 'Отправляем...' : 'Отправить ссылку'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Вспомнили пароль?{' '}
          <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
