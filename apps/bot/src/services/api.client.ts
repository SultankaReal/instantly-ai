import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Author,
  Publication,
  Post,
  CreatePostDto,
  SubscriberStats,
  PostAnalytics,
} from '../types.js';

// ─── Typed Error ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

function buildClient(): AxiosInstance {
  const baseURL = process.env['API_URL'] ?? 'http://api:3000';
  const client = axios.create({ baseURL, timeout: 15_000 });

  // Response interceptor: normalise errors into ApiError
  client.interceptors.response.use(
    (res) => res,
    (err: unknown) => {
      if (err instanceof AxiosError && err.response) {
        const status = err.response.status;
        const message =
          (err.response.data as { message?: string } | undefined)?.message ??
          err.message;
        throw new ApiError(status, message);
      }
      throw err;
    },
  );

  return client;
}

const http = buildClient();

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * Looks up an author by their Telegram user ID.
 * Returns null when the Telegram account is not linked to any author.
 */
export async function getAuthorByTelegramId(
  telegramId: string,
): Promise<Author | null> {
  try {
    const res = await http.get<Author>('/api/telegram/author', {
      params: { telegramId },
    });
    return res.data;
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    console.error('[api] getAuthorByTelegramId error', err);
    throw err;
  }
}

/** Fetches full publication data for the given publication ID. */
export async function getPublication(
  publicationId: string,
): Promise<Publication> {
  const res = await http.get<Publication>(`/api/publications/${publicationId}`);
  return res.data;
}

/**
 * Fetches the first publication belonging to the given author.
 * Used by auth middleware on the first login — the API returns the author's
 * primary publication at GET /api/authors/:authorId/publication.
 */
export async function getPublicationByAuthor(
  authorId: string,
): Promise<Publication> {
  const res = await http.get<Publication>(
    `/api/authors/${authorId}/publication`,
  );
  return res.data;
}

/** Creates a new post (draft or published) within a publication. */
export async function createPost(
  publicationId: string,
  data: CreatePostDto,
): Promise<Post> {
  const res = await http.post<Post>(
    `/api/publications/${publicationId}/posts`,
    data,
  );
  return res.data;
}

/**
 * Returns posts for a publication, optionally filtered by status.
 * e.g. getPosts(pubId, 'draft')
 */
export async function getPosts(
  publicationId: string,
  status?: string,
): Promise<Post[]> {
  const res = await http.get<Post[]>(
    `/api/publications/${publicationId}/posts`,
    { params: status ? { status } : undefined },
  );
  return res.data;
}

/**
 * Triggers the send-post flow: enqueues BullMQ jobs for all active subscribers.
 * The post must be in 'draft' status; the API will move it to 'sent'.
 */
export async function sendPost(postId: string): Promise<void> {
  await http.post(`/api/posts/${postId}/send`);
}

/** Permanently deletes a post by ID. Only works for drafts. */
export async function deletePost(postId: string): Promise<void> {
  await http.delete(`/api/posts/${postId}`);
}

/** Returns aggregated subscriber statistics for a publication. */
export async function getSubscribers(
  publicationId: string,
): Promise<SubscriberStats> {
  const res = await http.get<SubscriberStats>(
    `/api/publications/${publicationId}/subscribers/stats`,
  );
  return res.data;
}

/** Returns analytics for the last N posts (default: 5, controlled by API). */
export async function getAnalytics(
  publicationId: string,
): Promise<PostAnalytics[]> {
  const res = await http.get<PostAnalytics[]>(
    `/api/publications/${publicationId}/analytics`,
    { params: { limit: 5 } },
  );
  return res.data;
}

/**
 * Kicks off a Substack CSV/ZIP import job.
 * fileUrl is the Telegram CDN URL; the API downloads it directly.
 */
export async function startImport(
  publicationId: string,
  fileUrl: string,
): Promise<{ jobId: string }> {
  const res = await http.post<{ jobId: string }>(
    `/api/publications/${publicationId}/import`,
    { fileUrl },
  );
  return res.data;
}
