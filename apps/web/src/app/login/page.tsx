'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { setStoredToken, setStoredRefreshToken, setStoredUser } from '@/lib/auth';
import type { AuthResponse } from '@inkflow/shared-types';

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFieldErrors({});
    setServerError('');

    // Client-side validation
    const errors: FieldErrors = {};
    if (!email) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.post<AuthResponse>('/api/auth/login', { email, password });
      setStoredToken(data.accessToken);
      setStoredRefreshToken(data.refreshToken);
      setStoredUser(data.user);
      router.push('/dashboard/posts');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          const mapped: FieldErrors = {};
          if (err.details.email) mapped.email = err.details.email[0];
          if (err.details.password) mapped.password = err.details.password[0];
          setFieldErrors(mapped);
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold text-sky-600">
            Inkflow
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">Sign in to your account</h1>
          <p className="mt-2 text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-sky-600 hover:text-sky-500">
              Sign up free
            </Link>
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {serverError && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="label mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`input ${fieldErrors.email ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                placeholder="you@example.com"
                disabled={loading}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`input ${fieldErrors.password ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                placeholder="••••••••"
                disabled={loading}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
