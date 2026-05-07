'use client'
import { useState, useEffect } from 'react'

interface SubscriptionStatus {
  isActive: boolean
  platform: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  loading: boolean
  error: string | null
}

export function useGooglePlaySubscription(userId?: string): SubscriptionStatus {
  const [state, setState] = useState<SubscriptionStatus>({
    isActive: false,
    platform: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!userId) {
      setState((s) => ({ ...s, loading: false }))
      return
    }

    fetch('/api/subscription/status')
      .then((r) => r.json())
      .then((data) => {
        setState({
          isActive: data.status === 'active',
          platform: data.platform,
          currentPeriodEnd: data.currentPeriodEnd,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
          loading: false,
          error: null,
        })
      })
      .catch((err) => {
        setState((s) => ({ ...s, loading: false, error: err.message }))
      })
  }, [userId])

  return state
}
