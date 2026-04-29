'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { setTokens } from '@/lib/auth'
import { useState, Suspense } from 'react'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Введите имя (минимум 2 символа)'),
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Пароль должен быть минимум 8 символов'),
})

type RegisterForm = z.infer<typeof registerSchema>

function RegisterFormContent(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm): Promise<void> => {
    setServerError(null)
    try {
      const response = await api.auth.register(data) as { accessToken: string; refreshToken: string }
      setTokens(response.accessToken, response.refreshToken)
      router.push('/onboarding')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'register_failed'
      if (message === 'email_already_exists') {
        setServerError('Пользователь с таким email уже существует')
      } else {
        setServerError('Произошла ошибка при регистрации. Попробуйте ещё раз.')
      }
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Создать аккаунт</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {plan ? `Тарифный план: ${plan === 'start' ? 'Старт' : plan === 'pro' ? 'Про' : 'Агентство'} • ` : ''}
            7 дней бесплатно
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
              Имя
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Иван Иванов"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors ${
                errors.fullName
                  ? 'border-red-300 focus:border-red-400 bg-red-50'
                  : 'border-gray-200 focus:border-blue-400 bg-white'
              }`}
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="mt-1.5 text-xs text-red-500">{errors.fullName.message}</p>
            )}
          </div>

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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Минимум 8 символов"
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
            {isSubmitting ? 'Создаём аккаунт...' : 'Создать аккаунт'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Регистрируясь, вы соглашаетесь с{' '}
            <a href="#" className="text-blue-500 hover:underline">условиями использования</a>{' '}
            и{' '}
            <a href="#" className="text-blue-500 hover:underline">политикой конфиденциальности</a>
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="w-full max-w-md h-96 bg-white rounded-2xl border border-gray-200 animate-pulse" />}>
      <RegisterFormContent />
    </Suspense>
  )
}
