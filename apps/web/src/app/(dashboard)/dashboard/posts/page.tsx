'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getStoredToken } from '@/lib/auth';
import type { PostListResponse, PostStatus } from '@inkflow/shared-types';

function StatusBadge({ status }: { status: PostStatus }) {
  const classes: Record<PostStatus, string> = {
    draft: 'badge-draft',
    scheduled: 'badge-scheduled',
    sent: 'badge-sent',
    published: 'badge-published',
  };
  return <span className={classes[status]}>{status}</span>;
}

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// For MVP: derive publicationId from the first post returned.
// In a real session, a publication switcher would be added.
async function getPublicationId(token: string): Promise<string | null> {
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

export default function PostsPage() {
  const [posts, setPosts] = useState<PostListResponse['posts']>([]);
  const [total, setTotal] = useState(0);
  const [publicationId, setPublicationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load(): Promise<void> {
      const token = getStoredToken();
      if (!token) return;

      try {
        const pubId = await getPublicationId(token);
        setPublicationId(pubId);

        if (!pubId) {
          setLoading(false);
          return;
        }

        const data = await apiClient.get<PostListResponse>(
          `/api/publications/${pubId}/posts?limit=20&page=1`,
          { token },
        );
        setPosts(data.posts);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load posts.');
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
          {!loading && <p className="mt-1 text-sm text-gray-500">{total} total</p>}
        </div>
        {publicationId && (
          <Link
            href="/dashboard/posts/new"
            className="btn-primary"
          >
            + New post
          </Link>
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
          <p className="mb-4 text-gray-600">You don&apos;t have a publication yet.</p>
          <Link href="/dashboard/settings" className="btn-primary">
            Create publication
          </Link>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && publicationId && posts.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="mb-4 text-gray-600">No posts yet. Write your first one!</p>
          <Link href="/dashboard/posts/new" className="btn-primary">
            Write a post
          </Link>
        </div>
      )}

      {/* Posts table */}
      {!loading && !error && posts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Title</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-left font-medium">Access</th>
                <th className="px-6 py-3 text-left font-medium">Date</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/posts/${post.id}`}
                      className="font-medium text-gray-900 hover:text-sky-600"
                    >
                      {post.title}
                    </Link>
                    {post.subtitle && (
                      <p className="mt-0.5 truncate max-w-xs text-xs text-gray-500">
                        {post.subtitle}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={post.access === 'paid' ? 'text-amber-600' : 'text-gray-500'}>
                      {post.access}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatDate(post.published_at ?? post.scheduled_at ?? post.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/posts/${post.id}`}
                      className="text-sky-600 hover:text-sky-500 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
