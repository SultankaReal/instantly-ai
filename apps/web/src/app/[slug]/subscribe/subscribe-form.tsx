'use client';

import { useState, type FormEvent } from 'react';
import { apiClient, ApiClientError } from '@/lib/api-client';

type Props = {
  publicationSlug: string;
  publicationId: string;
};

type FieldErrors = {
  email?: string;
  name?: string;
};

export default function SubscribeForm({ publicationSlug: _publicationSlug, publicationId }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFieldErrors({});
    setServerError('');

    const errors: FieldErrors = {};
    if (!email) errors.email = 'Email is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await apiClient.post(`/api/publications/${publicationId}/subscribers`, {
        email,
        name: name.trim() || undefined,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          const mapped: FieldErrors = {};
          if (err.details.email) mapped.email = err.details.email[0];
          if (err.details.name) mapped.name = err.details.name[0];
          setFieldErrors(mapped);
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="py-4 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Check your email!</h2>
        <p className="text-gray-600">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>.
          Click it to complete your subscription.
        </p>
        <p className="mt-4 text-sm text-gray-500">The link expires in 48 hours.</p>
      </div>
    );
  }

  return (
    <>
      {serverError && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="sub-name" className="label mb-1">
            Name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="sub-name"
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
          <label htmlFor="sub-email" className="label mb-1">
            Email address
          </label>
          <input
            id="sub-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`input ${fieldErrors.email ? 'border-red-400' : ''}`}
            placeholder="you@example.com"
            disabled={loading}
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Subscribing…
            </span>
          ) : (
            'Subscribe'
          )}
        </button>

        <p className="text-center text-xs text-gray-500">
          You&apos;ll receive a confirmation email. Unsubscribe anytime.
        </p>
      </form>
    </>
  );
}
