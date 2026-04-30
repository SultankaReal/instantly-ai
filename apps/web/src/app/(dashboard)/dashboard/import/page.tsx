'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getStoredToken } from '@/lib/auth';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_POLLS = 300; // 300 × 2 s = 10 minutes
const POLL_INTERVAL_MS = 2_000;

type JobState = 'idle' | 'queued' | 'active' | 'completed' | 'failed';

type ImportResult = {
  imported: number;
  failed: number;
  errors: string[];
};

type StatusData = {
  jobId: string;
  state: string;
  progress: number;
  result: ImportResult | null;
  reason: string | null;
};

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

export default function ImportPage() {
  const router = useRouter();

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [sendWelcome, setSendWelcome] = useState(false);

  // Operation state
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Publication
  const [publicationId, setPublicationId] = useState<string | null>(null);
  const [loadingPub, setLoadingPub] = useState(true);
  const [pubError, setPubError] = useState('');

  // Polling ref to allow cleanup
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load publication on mount
  useEffect(() => {
    async function loadPublication(): Promise<void> {
      const token = getStoredToken();
      if (!token) {
        router.push('/login');
        return;
      }
      try {
        const pubId = await getFirstPublicationId(token);
        if (!pubId) {
          setPubError('No publication found. Please create a publication first.');
        } else {
          setPublicationId(pubId);
        }
      } catch (err) {
        if (err instanceof ApiClientError) {
          setPubError(err.message);
        } else {
          setPubError('Failed to load publication.');
        }
      } finally {
        setLoadingPub(false);
      }
    }
    void loadPublication();
  }, [router]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const selected = e.target.files?.[0] ?? null;
    setErrorMsg('');
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setErrorMsg('File must be smaller than 50 MB.');
      setFile(null);
      e.target.value = '';
      return;
    }
    setFile(selected);
  }

  async function pollStatus(pubId: string, jId: string, pollCount: number): Promise<void> {
    if (pollCount >= MAX_POLLS) {
      setReason('Import is taking longer than expected. Please refresh the page to check status.');
      setJobState('failed');
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const data = await apiClient.get<StatusData>(
        `/api/publications/${pubId}/import/${jId}/status`,
        { token },
      );

      const state = data.state as JobState;
      setProgress(data.progress ?? 0);
      setJobState(state);

      if (state === 'completed') {
        setResult(data.result);
        return;
      }

      if (state === 'failed') {
        setReason(data.reason ?? 'Import failed.');
        return;
      }

      // Still running — schedule next poll
      pollingRef.current = setTimeout(() => {
        void pollStatus(pubId, jId, pollCount + 1);
      }, POLL_INTERVAL_MS);
    } catch (err) {
      // Network hiccup — retry
      pollingRef.current = setTimeout(() => {
        void pollStatus(pubId, jId, pollCount + 1);
      }, POLL_INTERVAL_MS);
      // Swallow to keep polling; err is ignored intentionally
      void err;
    }
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!file || !publicationId) return;

    setUploading(true);
    setErrorMsg('');

    const token = getStoredToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('sendWelcome', String(sendWelcome));

    try {
      const baseUrl =
        typeof window !== 'undefined'
          ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000')
          : 'http://localhost:3000';

      const response = await fetch(
        `${baseUrl}/api/publications/${publicationId}/import/substack`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        },
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await response.json();

      if (!response.ok || !json.success) {
        const code: string = json?.error?.code ?? 'UNKNOWN';
        const msg: string = json?.error?.message ?? 'Upload failed.';
        if (response.status === 413 || code === 'FILE_TOO_LARGE') {
          setErrorMsg('File is too large. Maximum size is 50 MB.');
        } else if (code === 'INVALID_FILE_TYPE') {
          setErrorMsg('Invalid file type. Please upload a ZIP file exported from Substack.');
        } else {
          setErrorMsg(msg);
        }
        return;
      }

      const newJobId: string = json.data.jobId as string;
      setJobId(newJobId);
      setJobState('queued');
      setProgress(0);

      // Start polling after a short initial delay
      pollingRef.current = setTimeout(() => {
        void pollStatus(publicationId, newJobId, 0);
      }, POLL_INTERVAL_MS);
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleReset(): void {
    if (pollingRef.current) clearTimeout(pollingRef.current);
    setFile(null);
    setSendWelcome(false);
    setUploading(false);
    setJobId(null);
    setJobState('idle');
    setProgress(0);
    setResult(null);
    setReason(null);
    setErrorMsg('');
  }

  // --- Render loading state ---
  if (loadingPub) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  // --- Render pub error ---
  if (pubError) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{pubError}</div>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-sky-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import from Substack</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload your Substack export ZIP to import subscribers into your publication.
        </p>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          {errorMsg}
        </div>
      )}

      {/* ── IDLE: upload form ── */}
      {jobState === 'idle' && (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* File picker */}
          <div>
            <label htmlFor="import-file" className="label mb-1">
              Substack export file
            </label>
            <input
              id="import-file"
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="input cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-sky-700 hover:file:bg-sky-100"
            />
            <p className="mt-1 text-xs text-gray-400">ZIP file only, maximum 50 MB.</p>
          </div>

          {/* Send welcome checkbox */}
          <div className="flex items-center gap-3">
            <input
              id="send-welcome"
              type="checkbox"
              checked={sendWelcome}
              onChange={(e) => setSendWelcome(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="send-welcome" className="text-sm text-gray-700">
              Send a welcome email to imported subscribers
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-gray-100 pt-6">
            <button
              type="submit"
              disabled={!file || uploading}
              className="btn-primary px-5 py-2 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Start import'}
            </button>
            <Link href="/dashboard/subscribers" className="btn-secondary px-5 py-2">
              Cancel
            </Link>
          </div>
        </form>
      )}

      {/* ── QUEUED / ACTIVE: progress bar ── */}
      {(jobState === 'queued' || jobState === 'active') && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">
            {jobState === 'queued' ? 'Your import is queued…' : 'Importing your subscribers…'}
          </p>

          {/* Progress bar */}
          <div className="overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-2.5 rounded-full bg-sky-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-xs text-gray-400">{progress}% complete</p>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
            <span>This may take a few minutes for large lists.</span>
          </div>

          {jobId && (
            <p className="text-xs text-gray-400">Job ID: {jobId}</p>
          )}
        </div>
      )}

      {/* ── COMPLETED: summary ── */}
      {jobState === 'completed' && result && (
        <div className="space-y-6">
          <div className="rounded-xl border border-green-200 bg-green-50 p-6">
            <h2 className="mb-4 text-base font-semibold text-green-800">Import complete</h2>
            <dl className="space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-green-700">Imported</dt>
                <dd className="text-sm font-semibold text-green-900">{result.imported}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-green-700">Skipped / invalid</dt>
                <dd className="text-sm font-semibold text-green-900">{result.failed}</dd>
              </div>
            </dl>
          </div>

          {/* First error rows */}
          {result.errors.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-700">
                Invalid rows (first {result.errors.length})
              </p>
              <ul className="space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-yellow-800">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary px-5 py-2"
          >
            Import another
          </button>
        </div>
      )}

      {/* ── FAILED: error + retry ── */}
      {jobState === 'failed' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h2 className="mb-2 text-base font-semibold text-red-800">Import failed</h2>
            <p className="text-sm text-red-700">{reason ?? 'An unexpected error occurred.'}</p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="btn-primary px-5 py-2"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
