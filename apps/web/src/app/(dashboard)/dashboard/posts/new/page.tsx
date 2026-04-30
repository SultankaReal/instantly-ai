'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getStoredToken } from '@/lib/auth';
import type { PostResponse } from '@inkflow/shared-types';

type FieldErrors = {
  title?: string;
  content_html?: string;
};

// Helper: get the author's first publication
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

export default function NewPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [access, setAccess] = useState<'free' | 'paid'>('free');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFieldErrors({});
    setServerError('');

    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = 'Title is required';
    if (!contentHtml.trim()) errors.content_html = 'Content is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const pubId = await getFirstPublicationId(token);
      if (!pubId) {
        setServerError('You need to create a publication first. Go to Settings.');
        setLoading(false);
        return;
      }

      const post = await apiClient.post<PostResponse>(
        `/api/publications/${pubId}/posts`,
        { title, subtitle: subtitle || undefined, content_html: contentHtml, access },
        { token },
      );
      router.push(`/dashboard/posts/${post.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          const mapped: FieldErrors = {};
          if (err.details.title) mapped.title = err.details.title[0];
          if (err.details.content_html) mapped.content_html = err.details.content_html[0];
          setFieldErrors(mapped);
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Failed to create post. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/dashboard/posts" className="text-sm text-gray-500 hover:text-gray-700">
          ← Posts
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New post</h1>
      </div>

      {serverError && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="label mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`input text-lg font-medium ${fieldErrors.title ? 'border-red-400' : ''}`}
            placeholder="Your post title"
            disabled={loading}
          />
          {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
        </div>

        {/* Subtitle */}
        <div>
          <label htmlFor="subtitle" className="label mb-1">
            Subtitle <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="subtitle"
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="input"
            placeholder="A short description of your post"
            disabled={loading}
          />
        </div>

        {/* Access */}
        <div>
          <label className="label mb-2">Access</label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="access"
                value="free"
                checked={access === 'free'}
                onChange={() => setAccess('free')}
                className="h-4 w-4 text-sky-600"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">Free — visible to all subscribers</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="access"
                value="paid"
                checked={access === 'paid'}
                onChange={() => setAccess('paid')}
                className="h-4 w-4 text-sky-600"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">Paid — only paid subscribers</span>
            </label>
          </div>
        </div>

        {/* Content */}
        <div>
          <label htmlFor="content" className="label mb-1">
            Content (HTML)
          </label>
          <textarea
            id="content"
            value={contentHtml}
            onChange={(e) => setContentHtml(e.target.value)}
            rows={20}
            className={`input resize-y font-mono text-sm leading-relaxed ${fieldErrors.content_html ? 'border-red-400' : ''}`}
            placeholder="<p>Your post content…</p>"
            disabled={loading}
          />
          {fieldErrors.content_html && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.content_html}</p>
          )}
          <p className="mt-1.5 text-xs text-gray-500">
            HTML is sanitised server-side. You can use headings, paragraphs, lists, and links.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 border-t border-gray-100 pt-6">
          <button type="submit" disabled={loading} className="btn-primary px-6 py-2.5">
            {loading ? 'Creating…' : 'Create post'}
          </button>
          <Link href="/dashboard/posts" className="btn-secondary px-6 py-2.5">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
