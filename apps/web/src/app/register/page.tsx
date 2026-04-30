'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { setStoredToken, setStoredRefreshToken, setStoredUser } from '@/lib/auth';
import type { AuthResponse } from '@inkflow/shared-types';

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFieldErrors({});
    setServerError('');

    // Client-side validation
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = 'Name is required';
    if (!email) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.post<AuthResponse>('/api/auth/register', {
        name,
        email,
        password,
        confirmPassword,
      });
      setStoredToken(data.accessToken);
      setStoredRefreshToken(data.refreshToken);
      setStoredUser(data.user);
      router.push('/dashboard/posts');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          const mapped: FieldErrors = {};
          if (err.details.name) mapped.name = err.details.name[0];
          if (err.details.email) mapped.email = err.details.email[0];
          if (err.details.password) mapped.password = err.details.password[0];
          if (err.details.confirmPassword) mapped.confirmPassword = err.details.confirmPassword[0];
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
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">Create your account</h1>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-sky-600 hover:text-sky-500">
              Sign in
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
              <label htmlFor="name" className="label mb-1">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`input ${fieldErrors.name ? 'border-red-400' : ''}`}
                placeholder="Jane Smith"
                disabled={loading}
              />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
            </div>

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
                className={`input ${fieldErrors.email ? 'border-red-400' : ''}`}
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`input ${fieldErrors.password ? 'border-red-400' : ''}`}
                placeholder="Min. 8 characters"
                disabled={loading}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label mb-1">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`input ${fieldErrors.confirmPassword ? 'border-red-400' : ''}`}
                placeholder="••••••••"
                disabled={loading}
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
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
                  Creating account…
                </span>
              ) : (
                'Create account'
              )}
            </button>

            <p className="text-center text-xs text-gray-500">
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
