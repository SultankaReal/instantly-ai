'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAccessToken, getRefreshToken, clearTokens, isAuthenticated, setTokens } from '@/lib/auth'
import { api } from '@/lib/api'

type AuthState = {
  isLoggedIn: boolean
  token: string | null
  isLoading: boolean
}

type AuthResponse = {
  accessToken: string
  refreshToken: string
}

export function useAuth(): AuthState & {
  logout: () => Promise<void>
  refresh: () => Promise<boolean>
} {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    token: null,
    isLoading: true,
  })

  useEffect(() => {
    const token = getAccessToken()
    setState({
      isLoggedIn: !!token,
      token,
      isLoading: false,
    })
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    const token = getAccessToken()
    const refreshToken = getRefreshToken()
    if (token && refreshToken) {
      try {
        await api.auth.logout(token, refreshToken)
      } catch {
        // Continue with local logout on failure
      }
    }
    clearTokens()
    setState({ isLoggedIn: false, token: null, isLoading: false })
  }, [])

  const refresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return false
    try {
      const res = await api.auth.refresh(refreshToken) as AuthResponse
      setTokens(res.accessToken, res.refreshToken)
      setState({ isLoggedIn: true, token: res.accessToken, isLoading: false })
      return true
    } catch {
      clearTokens()
      setState({ isLoggedIn: false, token: null, isLoading: false })
      return false
    }
  }, [])

  // Expose isAuthenticated as a utility check
  void isAuthenticated

  return {
    ...state,
    logout,
    refresh,
  }
}
