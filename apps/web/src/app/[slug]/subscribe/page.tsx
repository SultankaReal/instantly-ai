import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiClientError } from '@/lib/api-client';
import type { PublicationResponse } from '@inkflow/shared-types';
import SubscribeForm from './subscribe-form';

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pub = await getPublication(slug);
  if (!pub) return { title: 'Subscribe' };

  return {
    title: `Subscribe to ${pub.name}`,
    description: pub.description ?? `Get every new post from ${pub.name} in your inbox.`,
  };
}

export default async function SubscribePage({ params }: PageProps) {
  const { slug } = await params;
  const pub = await getPublication(slug);
  if (!pub) notFound();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href={`/${slug}`} className="text-sm text-sky-600 hover:underline">
            ← {pub.name}
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Subscribe to {pub.name}</h1>
          {pub.description && (
            <p className="mt-3 text-gray-600">{pub.description}</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <SubscribeForm publicationSlug={slug} publicationId={pub.id} />
        </div>

        {pub.pricing_monthly && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Free subscription available. Paid plan from ${(pub.pricing_monthly / 100).toFixed(0)}/mo.
          </p>
        )}
      </div>
    </div>
  );
}
