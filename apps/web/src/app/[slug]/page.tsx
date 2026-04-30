import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiClientError } from '@/lib/api-client';
import type { PublicationResponse, PostListResponse } from '@inkflow/shared-types';

type PageProps = {
  params: Promise<{ slug: string }>;
};

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

async function getPosts(publicationId: string): Promise<PostListResponse | null> {
  try {
    return await apiClient.get<PostListResponse>(
      `/api/publications/${publicationId}/posts?limit=10&page=1`,
      { revalidate: 300 },
    );
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pub = await getPublication(slug);
  if (!pub) return { title: 'Publication not found' };

  return {
    title: pub.name,
    description: pub.description ?? `Subscribe to ${pub.name} on Inkflow`,
    openGraph: {
      title: pub.name,
      description: pub.description ?? `Subscribe to ${pub.name} on Inkflow`,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: pub.name,
      description: pub.description ?? `Subscribe to ${pub.name} on Inkflow`,
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

export default async function PublicationPage({ params }: PageProps) {
  const { slug } = await params;
  const pub = await getPublication(slug);
  if (!pub) notFound();

  const postsData = await getPosts(pub.id);
  const posts = postsData?.posts ?? [];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <Link href="/" className="mb-6 block text-sm text-sky-600 hover:underline">
            ← Inkflow
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">{pub.name}</h1>
          {pub.description && (
            <p className="mt-3 text-lg leading-relaxed text-gray-600">{pub.description}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href={`/${slug}/subscribe`}
              className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              Subscribe
            </Link>
            {pub.pricing_monthly && (
              <span className="text-sm text-gray-500">
                Paid subscription available from ${(pub.pricing_monthly / 100).toFixed(0)}/mo
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Posts list */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        {posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500">No posts published yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            <h2 className="text-xl font-semibold text-gray-900">Recent posts</h2>
            {posts.map((post) => (
              <article
                key={post.id}
                className="border-b border-gray-100 pb-8 last:border-0 last:pb-0"
              >
                <Link
                  href={`/${slug}/posts/${post.slug}`}
                  className="group block"
                >
                  <h3 className="mb-2 text-xl font-semibold text-gray-900 group-hover:text-sky-600 transition-colors">
                    {post.title}
                  </h3>
                  {post.subtitle && (
                    <p className="mb-3 text-gray-600">{post.subtitle}</p>
                  )}
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <time dateTime={post.published_at?.toString() ?? post.created_at.toString()}>
                      {formatDate(post.published_at ?? post.created_at)}
                    </time>
                    {post.access === 'paid' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Paid
                      </span>
                    )}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Subscribe CTA */}
      <section className="bg-sky-50 py-16">
        <div className="mx-auto max-w-xl px-6 text-center">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            Subscribe to {pub.name}
          </h2>
          <p className="mb-6 text-gray-600">
            Get every new post delivered directly to your inbox.
          </p>
          <Link
            href={`/${slug}/subscribe`}
            className="inline-flex rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700"
          >
            Subscribe now
          </Link>
        </div>
      </section>
    </div>
  );
}
