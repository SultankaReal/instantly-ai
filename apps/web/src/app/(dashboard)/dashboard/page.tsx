'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { getStoredToken } from '@/lib/auth'

type Publication = {
  id: string
  name: string
  slug: string
  description: string | null
  subscriberCount: number
}

type PostSummary = {
  id: string
  title: string
  status: string
  created_at: string
}

type Stats = {
  publication: Publication | null
  totalPosts: number
  totalSubscribers: number
  recentPosts: PostSummary[]
}

function StatCard({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="block rounded-xl border border-gray-200 bg-white p-6 hover:border-sky-300 hover:shadow-sm transition-all">
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </Link>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ publication: null, totalPosts: 0, totalSubscribers: 0, recentPosts: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = getStoredToken()
      if (!token) return

      try {
        const pubData = await apiClient.get<{ publications: Publication[] }>('/api/publications', { token })
        const pub = pubData.publications[0] ?? null

        if (!pub) {
          setLoading(false)
          return
        }

        const [postsData, subsData] = await Promise.all([
          apiClient.get<{ posts: PostSummary[]; total: number }>(`/api/publications/${pub.id}/posts?limit=5&page=1`, { token }),
          apiClient.get<{ subscribers: unknown[]; total: number }>(`/api/publications/${pub.id}/subscribers?limit=1&page=1`, { token }),
        ])

        setStats({
          publication: pub,
          totalPosts: postsData.total,
          totalSubscribers: subsData.total,
          recentPosts: postsData.posts,
        })
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    )
  }

  if (!stats.publication) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Inkflow</h1>
        <p className="text-gray-500 mb-8">You need a publication to get started.</p>
        <Link href="/dashboard/settings" className="btn-primary">
          Create your publication →
        </Link>
      </div>
    )
  }

  const { publication, totalPosts, totalSubscribers, recentPosts } = stats

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{publication.name}</h1>
        <p className="mt-1 text-sm text-gray-500">inkflow.io/{publication.slug}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-10 sm:grid-cols-3">
        <StatCard label="Subscribers" value={totalSubscribers} href="/dashboard/subscribers" />
        <StatCard label="Posts" value={totalPosts} href="/dashboard/posts" />
        <StatCard label="Analytics" value="→" href="/dashboard/analytics" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Recent posts</h2>
          <Link href="/dashboard/posts/new" className="btn-primary text-xs px-3 py-1.5">
            + New post
          </Link>
        </div>

        {recentPosts.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No posts yet. Write your first one!</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentPosts.map((post) => (
              <li key={post.id} className="flex items-center justify-between py-3">
                <Link href={`/dashboard/posts/${post.id}`} className="text-sm font-medium text-gray-900 hover:text-sky-600 truncate max-w-xs">
                  {post.title}
                </Link>
                <span className={`ml-4 text-xs px-2 py-0.5 rounded-full ${
                  post.status === 'sent' ? 'bg-green-100 text-green-700' :
                  post.status === 'published' ? 'bg-sky-100 text-sky-700' :
                  post.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{post.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
