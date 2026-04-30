import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiClientError } from '@/lib/api-client';
import type { PostResponse, TruncatedPostResponse, PublicationResponse } from '@inkflow/shared-types';

type PageProps = {
  params: Promise<{ slug: string; postSlug: string }>;
};

type PostContent = PostResponse | TruncatedPostResponse;

function isTruncated(post: PostContent): post is TruncatedPostResponse {
  return 'truncated' in post && post.truncated === true;
}

async function getPublication(slug: string): Promise<PublicationResponse | null> {
  try {
    return await apiClient.get<PublicationResponse>(`/api/publications/${slug}`, {
      revalidate: 300,
    });
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) return null;
    throw err;
  }
}

async function getPost(publicationId: string, postSlug: string): Promise<PostContent | null> {
  try {
    return await apiClient.get<PostContent>(
      `/api/publications/${publicationId}/posts/${postSlug}`,
      { revalidate: 300 },
    );
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const pub = await getPublication(slug);
  if (!pub) return { title: 'Post not found' };

  const post = await getPost(pub.id, postSlug);
  if (!post) return { title: 'Post not found' };

  // Title ≤60 chars
  const title = post.title.length > 57 ? `${post.title.slice(0, 57)}…` : post.title;
  // Description ≤160 chars
  const description = post.meta_description
    ? post.meta_description
    : post.subtitle
      ? post.subtitle.slice(0, 160)
      : `Read "${post.title}" on ${pub.name}`;

  const canonicalUrl =
    post.canonical_url ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://inkflow.io'}/${slug}/posts/${postSlug}`;

  const publishedAt = post.published_at
    ? new Date(post.published_at).toISOString()
    : new Date(post.created_at).toISOString();

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: publishedAt,
      siteName: pub.name,
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    other: {
      // Article structured data hint for crawlers
      'article:author': pub.name,
      'article:published_time': publishedAt,
    },
  };
}

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function PostPage({ params }: PageProps) {
  const { slug, postSlug } = await params;

  const pub = await getPublication(slug);
  if (!pub) notFound();

  const post = await getPost(pub.id, postSlug);
  if (!post) notFound();

  const truncated = isTruncated(post);
  const publishedAt = post.published_at ?? post.created_at;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <Link href={`/${slug}`} className="text-sm text-sky-600 hover:underline">
            ← {pub.name}
          </Link>
        </div>
      </header>

      {/* Article */}
      <article className="mx-auto max-w-3xl px-6 py-12">
        {/* Meta */}
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {post.access === 'paid' && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Paid
              </span>
            )}
            <time
              className="text-sm text-gray-500"
              dateTime={new Date(publishedAt).toISOString()}
            >
              {formatDate(publishedAt)}
            </time>
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-gray-900">
            {post.title}
          </h1>
          {post.subtitle && (
            <p className="text-xl leading-relaxed text-gray-600">{post.subtitle}</p>
          )}
        </div>

        {/* Content */}
        <div
          className="prose prose-gray max-w-none prose-headings:font-semibold prose-a:text-sky-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />

        {/* Paywall */}
        {truncated && (
          <div className="mt-12 rounded-2xl border border-sky-100 bg-sky-50 p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-gray-900">
              This is a preview. Subscribe to read the full post.
            </p>
            <p className="mb-6 text-gray-600">
              Get unlimited access to all paid content on {pub.name}.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={`/${slug}/subscribe`}
                className="rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700"
              >
                Subscribe to read more
              </Link>
              {post.access === 'paid' && pub.pricing_monthly && (
                <span className="text-sm text-gray-500">
                  From ${(pub.pricing_monthly / 100).toFixed(0)}/mo
                </span>
              )}
            </div>
          </div>
        )}
      </article>

      {/* Footer CTA */}
      {!truncated && (
        <section className="border-t border-gray-100 bg-gray-50 py-16">
          <div className="mx-auto max-w-xl px-6 text-center">
            <p className="mb-2 font-semibold text-gray-900">Enjoyed this post?</p>
            <p className="mb-6 text-gray-600">Subscribe to {pub.name} for more.</p>
            <Link
              href={`/${slug}/subscribe`}
              className="inline-flex rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700"
            >
              Subscribe now
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
