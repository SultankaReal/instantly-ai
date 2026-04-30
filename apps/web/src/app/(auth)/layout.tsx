'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAccessToken } from '@/lib/auth'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter()

  useEffect(() => {
    const token = getAccessToken()
    if (token) {
      router.replace('/dashboard')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="py-4 px-6">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">П</span>
          </div>
          <span className="font-semibold text-gray-900">Поток</span>
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  )
}
