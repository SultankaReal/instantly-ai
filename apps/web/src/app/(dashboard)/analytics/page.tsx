'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getStoredToken } from '@/lib/auth';
import type { PostAnalyticsResponse, PostListResponse } from '@inkflow/shared-types';

type PostSummary = PostListResponse['posts'][number];

type PostWithAnalytics = {
  post: PostSummary;
  analytics: PostAnalyticsResponse | null;
  loading: boolean;
  error: string;
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
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

export default function AnalyticsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PostWithAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load(): Promise<void> {
      const token = getStoredToken();
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const pubId = await getFirstPublicationId(token);
        if (!pubId) {
          setLoading(false);
          return;
        }

        // Load only sent posts
        const postsData = await apiClient.get<PostListResponse>(
          `/api/publications/${pubId}/posts?limit=20&page=1&status=sent`,
          { token },
        );

        const sentPosts = postsData.posts.filter((p) => p.status === 'sent');

        // Initialize rows immediately so UI renders
        const initialRows: PostWithAnalytics[] = sentPosts.map((p) => ({
          post: p,
          analytics: null,
          loading: true,
          error: '',
        }));
        setRows(initialRows);
        setLoading(false);

        // Fetch analytics for each post in parallel
        await Promise.all(
          sentPosts.map(async (post, i) => {
            try {
              const analytics = await apiClient.get<PostAnalyticsResponse>(
                `/api/posts/${post.id}/analytics`,
                { token },
              );
              setRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, analytics, loading: false } : r,
                ),
              );
            } catch (err) {
              const msg = err instanceof ApiClientError ? err.message : 'Failed to load';
              setRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, loading: false, error: msg } : r,
                ),
              );
            }
          }),
        );
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load analytics.');
        }
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Performance metrics for your sent posts</p>
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

      {/* No sent posts */}
      {!loading && !error && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-600">
            No sent posts yet. Analytics will appear here once you send a post.
          </p>
        </div>
      )}

      {/* Analytics cards */}
      {!loading && !error && rows.length > 0 && (
        <div className="space-y-8">
          {rows.map(({ post, analytics, loading: rowLoading, error: rowError }) => (
            <div key={post.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">{post.title}</h2>

              {rowLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
                  Loading analytics…
                </div>
              )}

              {rowError && (
                <p className="text-sm text-red-600">{rowError}</p>
              )}

              {analytics && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Total recipients"
                    value={analytics.totalRecipients.toLocaleString()}
                  />
                  <StatCard
                    label="Open rate"
                    value={`${analytics.openRate.toFixed(1)}%`}
                    sub={`${analytics.uniqueOpens} unique opens`}
                  />
                  <StatCard
                    label="Click rate"
                    value={`${analytics.clickRate.toFixed(1)}%`}
                    sub={`${analytics.uniqueClicks} unique clicks`}
                  />
                  <StatCard
                    label="Delivered"
                    value={analytics.delivered.toLocaleString()}
                    sub={
                      analytics.bounced > 0
                        ? `${analytics.bounced} bounced`
                        : 'No bounces'
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
