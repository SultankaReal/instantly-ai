import type { Metadata } from 'next';
import Link from 'next/link';
import { apiClient, ApiClientError } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'Confirm subscription',
  description: 'Confirm your newsletter subscription.',
};

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

type ConfirmResult =
  | { success: true; publicationSlug?: string }
  | { success: false; message: string };

async function confirmSubscription(token: string): Promise<ConfirmResult> {
  try {
    await apiClient.get(`/api/subscribers/confirm?token=${encodeURIComponent(token)}`);
    return { success: true };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'An unexpected error occurred.' };
  }
}

export default async function ConfirmPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mx-auto">
            <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Invalid link</h1>
          <p className="text-gray-600">
            The confirmation link is missing a token. Please use the link from your email.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-sky-600 hover:underline">
            Back to homepage
          </Link>
        </div>
      </div>
    );
  }

  const result = await confirmSubscription(token);

  if (!result.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mx-auto">
            <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Confirmation failed</h1>
          <p className="text-gray-600">{result.message}</p>
          <p className="mt-4 text-sm text-gray-500">
            The link may have expired. Try subscribing again to receive a new confirmation email.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-sky-600 hover:underline">
            Back to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Subscription confirmed!</h1>
        <p className="text-gray-600">
          You&apos;re now subscribed. You&apos;ll receive new posts directly in your inbox.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-sky-600 hover:underline">
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
