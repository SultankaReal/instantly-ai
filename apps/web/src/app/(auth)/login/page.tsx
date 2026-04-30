'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { setTokens } from '@/lib/auth'
import { useState } from 'react'

const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage(): React.JSX.Element {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm): Promise<void> => {
    setServerError(null)
    try {
      const response = await api.auth.login(data) as { success: boolean; data: { accessToken: string; refreshToken: string } }
      setTokens(response.data.accessToken, response.data.refreshToken)
      router.push('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'login_failed'
      if (message.includes('INVALID_CREDENTIALS') || message.includes('invalid_credentials')) {
        setServerError('Неверный email или пароль')
      } else {
        setServerError('Произошла ошибка. Попробуйте ещё раз.')
      }
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Войти в Поток</h1>
          <p className="text-gray-500 mt-1 text-sm">Введите ваши данные для входа</p>
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <Link href="/forgot-password" className="text-xs text-blue-500 hover:text-blue-600 transition-colors">
                Забыли пароль?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors ${
                errors.password
                  ? 'border-red-300 focus:border-red-400 bg-red-50'
                  : 'border-gray-200 focus:border-blue-400 bg-white'
              }`}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>
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
            {isSubmitting ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Нет аккаунта?{' '}
          <Link href="/register" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}
