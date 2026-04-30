'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getStoredToken } from '@/lib/auth';
import type { SubscriberListResponse, SubscriberResponse, SubscriberStatus, SubscriberTier } from '@inkflow/shared-types';

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: SubscriberStatus }) {
  const styles: Record<SubscriberStatus, string> = {
    active: 'bg-green-100 text-green-700',
    pending_confirmation: 'bg-yellow-100 text-yellow-700',
    unsubscribed: 'bg-gray-100 text-gray-600',
    bounced: 'bg-red-100 text-red-600',
    spam: 'bg-red-100 text-red-700',
  };
  const labels: Record<SubscriberStatus, string> = {
    active: 'Active',
    pending_confirmation: 'Pending',
    unsubscribed: 'Unsubscribed',
    bounced: 'Bounced',
    spam: 'Spam',
  };
  return (
    <span className={`badge ${styles[status]}`}>{labels[status]}</span>
  );
}

function TierBadge({ tier }: { tier: SubscriberTier }) {
  const styles: Record<SubscriberTier, string> = {
    free: 'bg-gray-100 text-gray-600',
    paid: 'bg-sky-100 text-sky-700',
    trial: 'bg-purple-100 text-purple-700',
    past_due: 'bg-orange-100 text-orange-700',
  };
  return <span className={`badge ${styles[tier]}`}>{tier}</span>;
}

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function getFirstPublicationId(token: string): Promise<string | null> {
  try {
    const data = await apiClient.get<{ publications: Array<{ id: string }> }>(
      '/api/publications',
      { token },
    );
    return data.publications[0]?.id ?? null;
  } catch {
    return null;
  }
}

export default function SubscribersPage() {
  const router = useRouter();
  const [subscribers, setSubscribers] = useState<SubscriberResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publicationId, setPublicationId] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      const token = getStoredToken();
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const pubId = await getFirstPublicationId(token);
        setPublicationId(pubId);

        if (!pubId) {
          setLoading(false);
          return;
        }

        const data = await apiClient.get<SubscriberListResponse>(
          `/api/publications/${pubId}/subscribers?limit=${PAGE_SIZE}&page=${page}`,
          { token },
        );
        setSubscribers(data.subscribers);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load subscribers.');
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [page, router]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
        {!loading && (
          <p className="mt-1 text-sm text-gray-500">
            {total} total subscriber{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* No publication */}
      {!loading && !error && !publicationId && (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-600">No publication found.</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && publicationId && subscribers.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-600">No subscribers yet.</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && subscribers.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Email</th>
                  <th className="px-6 py-3 text-left font-medium">Name</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Tier</th>
                  <th className="px-6 py-3 text-left font-medium">Subscribed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{sub.email}</td>
                    <td className="px-6 py-4 text-gray-600">{sub.name ?? '—'}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-6 py-4">
                      <TierBadge tier={sub.tier} />
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(sub.subscribed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
