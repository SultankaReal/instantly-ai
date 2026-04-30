'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getStoredToken } from '@/lib/auth';
import type { PublicationResponse } from '@inkflow/shared-types';

type FieldErrors = {
  name?: string;
  slug?: string;
  description?: string;
  pricing_monthly?: string;
  pricing_annual?: string;
};

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

async function getFirstPublication(token: string): Promise<PublicationResponse | null> {
  try {
    const data = await apiClient.get<{ publications: PublicationResponse[] }>(
      '/api/publications',
      { token },
    );
    return data.publications[0] ?? null;
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const [pub, setPub] = useState<PublicationResponse | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [pricingMonthly, setPricingMonthly] = useState('');
  const [pricingAnnual, setPricingAnnual] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load(): Promise<void> {
      const token = getStoredToken();
      if (!token) {
        router.push('/login');
        return;
      }
      const publication = await getFirstPublication(token);
      if (publication) {
        setPub(publication);
        setName(publication.name);
        setSlug(publication.slug);
        setDescription(publication.description ?? '');
        setPricingMonthly(
          publication.pricing_monthly ? String(publication.pricing_monthly / 100) : '',
        );
        setPricingAnnual(
          publication.pricing_annual ? String(publication.pricing_annual / 100) : '',
        );
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFieldErrors({});
    setServerError('');
    setSaved(false);

    const token = getStoredToken();
    if (!token) {
      router.push('/login');
      return;
    }

    if (!pub) return;

    // Build patch payload
    const patch: Record<string, unknown> = {
      name,
      slug,
      description: description || undefined,
    };

    if (pricingMonthly) {
      const cents = Math.round(parseFloat(pricingMonthly) * 100);
      if (isNaN(cents) || cents < 100) {
        setFieldErrors({ pricing_monthly: 'Minimum price is $1.00' });
        return;
      }
      patch.pricing_monthly = cents;
    }

    if (pricingAnnual) {
      const cents = Math.round(parseFloat(pricingAnnual) * 100);
      if (isNaN(cents) || cents < 100) {
        setFieldErrors({ pricing_annual: 'Minimum price is $1.00' });
        return;
      }
      patch.pricing_annual = cents;
    }

    setSaving(true);
    try {
      const updated = await apiClient.patch<PublicationResponse>(
        `/api/publications/${pub.id}`,
        patch,
        { token },
      );
      setPub(updated);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          const mapped: FieldErrors = {};
          if (err.details.name) mapped.name = err.details.name[0];
          if (err.details.slug) mapped.slug = err.details.slug[0];
          if (err.details.description) mapped.description = err.details.description[0];
          if (err.details.pricing_monthly) mapped.pricing_monthly = err.details.pricing_monthly[0];
          if (err.details.pricing_annual) mapped.pricing_annual = err.details.pricing_annual[0];
          setFieldErrors(mapped);
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Failed to save settings. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Publication settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your publication details and subscription pricing.
        </p>
      </div>

      {!pub && (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="mb-2 text-gray-600">You don&apos;t have a publication yet.</p>
          <p className="text-sm text-gray-500">
            Contact support or check the API to create one.
          </p>
        </div>
      )}

      {pub && (
        <>
          {serverError && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
              {serverError}
            </div>
          )}

          {saved && (
            <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-700">
              Settings saved successfully.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="card">
              <h2 className="mb-5 text-base font-semibold text-gray-900">Basic info</h2>
              <div className="space-y-5">
                <Field
                  id="pub-name"
                  label="Publication name"
                  error={fieldErrors.name}
                >
                  <input
                    id="pub-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`input ${fieldErrors.name ? 'border-red-400' : ''}`}
                    placeholder="My Newsletter"
                    disabled={saving}
                  />
                </Field>

                <Field
                  id="pub-slug"
                  label="Slug"
                  hint={`Public URL: inkflow.io/${slug || 'your-slug'}`}
                  error={fieldErrors.slug}
                >
                  <input
                    id="pub-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    className={`input font-mono ${fieldErrors.slug ? 'border-red-400' : ''}`}
                    placeholder="my-newsletter"
                    disabled={saving}
                  />
                </Field>

                <Field
                  id="pub-description"
                  label="Description"
                  hint="Shown on your public publication page (max 500 chars)"
                  error={fieldErrors.description}
                >
                  <textarea
                    id="pub-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className={`input resize-none ${fieldErrors.description ? 'border-red-400' : ''}`}
                    placeholder="A brief description of what you write about"
                    disabled={saving}
                    maxLength={500}
                  />
                </Field>
              </div>
            </div>

            <div className="card">
              <h2 className="mb-1 text-base font-semibold text-gray-900">Paid subscriptions</h2>
              <p className="mb-5 text-sm text-gray-500">
                Leave blank to disable paid subscriptions. Prices in USD.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="pricing-monthly"
                  label="Monthly price ($)"
                  hint="e.g. 9 for $9/mo"
                  error={fieldErrors.pricing_monthly}
                >
                  <input
                    id="pricing-monthly"
                    type="number"
                    min="1"
                    step="0.01"
                    value={pricingMonthly}
                    onChange={(e) => setPricingMonthly(e.target.value)}
                    className={`input ${fieldErrors.pricing_monthly ? 'border-red-400' : ''}`}
                    placeholder="9.00"
                    disabled={saving}
                  />
                </Field>

                <Field
                  id="pricing-annual"
                  label="Annual price ($)"
                  hint="e.g. 79 for $79/yr"
                  error={fieldErrors.pricing_annual}
                >
                  <input
                    id="pricing-annual"
                    type="number"
                    min="1"
                    step="0.01"
                    value={pricingAnnual}
                    onChange={(e) => setPricingAnnual(e.target.value)}
                    className={`input ${fieldErrors.pricing_annual ? 'border-red-400' : ''}`}
                    placeholder="79.00"
                    disabled={saving}
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5">
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {saved && !saving && (
                <span className="text-sm text-green-600">Saved</span>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
}
