'use client';

import { useEffect, useState, useCallback, useRef, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getStoredToken } from '@/lib/auth';
import type { PostResponse } from '@inkflow/shared-types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  ) as T;
}

export default function PostEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params.id;

  const [post, setPost] = useState<PostResponse | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [access, setAccess] = useState<'free' | 'paid'>('free');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  // Load post
  useEffect(() => {
    async function loadPost(): Promise<void> {
      const token = getStoredToken();
      if (!token) {
        router.push('/login');
        return;
      }
      try {
        const data = await apiClient.get<PostResponse>(`/api/posts/${postId}`, { token });
        setPost(data);
        setTitle(data.title);
        setSubtitle(data.subtitle ?? '');
        setContentHtml(data.content_html);
        setAccess(data.access);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setLoadError(err.message);
        } else {
          setLoadError('Failed to load post.');
        }
      } finally {
        setLoading(false);
      }
    }
    void loadPost();
  }, [postId, router]);

  // Autosave implementation
  async function savePost(patch: {
    title?: string;
    subtitle?: string;
    content_html?: string;
    access?: 'free' | 'paid';
  }): Promise<void> {
    const token = getStoredToken();
    if (!token) return;

    setSaveStatus('saving');
    try {
      await apiClient.patch(`/api/posts/${postId}`, patch, { token });
      setSaveStatus('saved');
      setLastSavedAt(new Date());
    } catch {
      setSaveStatus('error');
    }
  }

  // Debounced autosave — triggers 30s after last change
  const debouncedSave = useDebouncedCallback(savePost, 30_000);

  function handleTitleChange(value: string): void {
    setTitle(value);
    setSaveStatus('idle');
    debouncedSave({ title: value, subtitle, content_html: contentHtml, access });
  }

  function handleSubtitleChange(value: string): void {
    setSubtitle(value);
    setSaveStatus('idle');
    debouncedSave({ title, subtitle: value, content_html: contentHtml, access });
  }

  function handleContentChange(value: string): void {
    setContentHtml(value);
    setSaveStatus('idle');
    debouncedSave({ title, subtitle, content_html: value, access });
  }

  function handleAccessChange(value: 'free' | 'paid'): void {
    setAccess(value);
    setSaveStatus('idle');
    debouncedSave({ title, subtitle, content_html: contentHtml, access: value });
  }

  // Manual save
  async function handleManualSave(e: FormEvent): Promise<void> {
    e.preventDefault();
    await savePost({ title, subtitle, content_html: contentHtml, access });
  }

  // Send now
  async function handleSend(): Promise<void> {
    if (!confirm('Send this post to all subscribers now?')) return;
    setSendError('');
    setSending(true);
    const token = getStoredToken();
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      await apiClient.post(`/api/posts/${postId}/send`, {}, { token });
      router.push('/dashboard/posts');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSendError(err.message);
      } else {
        setSendError('Failed to send post. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }

  function formatSavedTime(date: Date): string {
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.round(seconds / 60)}m ago`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
        <Link href="/dashboard/posts" className="mt-4 inline-block text-sm text-sky-600 hover:underline">
          ← Back to posts
        </Link>
      </div>
    );
  }

  const isSent = post?.status === 'sent';

  return (
    <div className="mx-auto max-w-3xl p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/posts" className="text-sm text-gray-500 hover:text-gray-700">
            ← Posts
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Edit post</h1>
          {post && (
            <span
              className={`badge ${
                post.status === 'draft'
                  ? 'badge-draft'
                  : post.status === 'scheduled'
                    ? 'badge-scheduled'
                    : post.status === 'sent'
                      ? 'badge-sent'
                      : 'badge-published'
              }`}
            >
              {post.status}
            </span>
          )}
        </div>

        {/* Save indicator */}
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="text-xs text-gray-400">Saving…</span>
          )}
          {saveStatus === 'saved' && lastSavedAt && (
            <span className="text-xs text-green-600">
              Saved {formatSavedTime(lastSavedAt)}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600">Save failed</span>
          )}
        </div>
      </div>

      {sendError && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          {sendError}
        </div>
      )}

      {isSent && (
        <div className="mb-6 rounded-lg bg-sky-50 p-4 text-sm text-sky-700">
          This post has already been sent. You can still edit and save, but it won&apos;t be resent.
        </div>
      )}

      <form onSubmit={handleManualSave} noValidate className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="edit-title" className="label mb-1">
            Title
          </label>
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="input text-lg font-medium"
            placeholder="Post title"
            disabled={false}
          />
        </div>

        {/* Subtitle */}
        <div>
          <label htmlFor="edit-subtitle" className="label mb-1">
            Subtitle <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="edit-subtitle"
            type="text"
            value={subtitle}
            onChange={(e) => handleSubtitleChange(e.target.value)}
            className="input"
            placeholder="Short description"
          />
        </div>

        {/* Access */}
        <div>
          <label className="label mb-2">Access</label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="edit-access"
                value="free"
                checked={access === 'free'}
                onChange={() => handleAccessChange('free')}
                className="h-4 w-4 text-sky-600"
              />
              <span className="text-sm text-gray-700">Free</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="edit-access"
                value="paid"
                checked={access === 'paid'}
                onChange={() => handleAccessChange('paid')}
                className="h-4 w-4 text-sky-600"
              />
              <span className="text-sm text-gray-700">Paid</span>
            </label>
          </div>
        </div>

        {/* Content */}
        <div>
          <label htmlFor="edit-content" className="label mb-1">
            Content (HTML)
          </label>
          <textarea
            id="edit-content"
            value={contentHtml}
            onChange={(e) => handleContentChange(e.target.value)}
            rows={24}
            className="input resize-y font-mono text-sm leading-relaxed"
            placeholder="<p>Your post content…</p>"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Autosaves 30 seconds after your last change.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-6">
          <button type="submit" className="btn-primary px-5 py-2">
            Save now
          </button>

          {!isSent && (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send now'}
            </button>
          )}

          <Link href="/dashboard/posts" className="btn-secondary px-5 py-2">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
