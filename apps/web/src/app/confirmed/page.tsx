import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Subscription confirmed',
  description: 'Your newsletter subscription is now active.',
};

export default function ConfirmedPage() {
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
