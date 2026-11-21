// ─── useReportResource ─────────────────────────────────────────
// Small cached resource hook for the Reports workspace. It keeps one
// in-flight promise per key, guards stale responses, and gives every tab a
// consistent { data, loading, error, retry } contract without changing the
// data layer or introducing another query library.

import { useCallback, useEffect, useRef, useState } from 'react'

const cache = new Map()

export function clearReportCache(prefix) {
  if (!prefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

const toError = (reason) => (
  reason instanceof Error
    ? reason
    : new Error(typeof reason === 'string' ? reason : 'Could not load this report.')
)

export default function useReportResource(key, loader, { refreshKey = 0, enabled = true } = {}) {
  const cacheKey = `${key}::${refreshKey}`
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const [attempt, setAttempt] = useState(0)
  const cached = cache.get(cacheKey)
  const [state, setState] = useState(() => ({
    key: cacheKey,
    data: cached?.status === 'success' ? cached.value : undefined,
    loading: enabled && cached?.status !== 'success',
    error: null,
  }))

  const view = state.key === cacheKey
    ? state
    : {
        key: cacheKey,
        data: cached?.status === 'success' ? cached.value : undefined,
        loading: enabled && cached?.status !== 'success',
        error: null,
      }

  useEffect(() => {
    if (!enabled) return undefined

    let live = true
    const hit = cache.get(cacheKey)
    if (hit?.status === 'success') {
      setState({ key: cacheKey, data: hit.value, loading: false, error: null })
      return () => { live = false }
    }

    setState({ key: cacheKey, data: undefined, loading: true, error: null })

    let record = hit?.status === 'pending' ? hit : null
    if (!record) {
      const run = loaderRef.current
      record = { status: 'pending', promise: null }
      record.promise = Promise.resolve()
        .then(() => run())
        .then((value) => {
          cache.set(cacheKey, { status: 'success', value, promise: null })
          return value
        })
        .catch((reason) => {
          const error = toError(reason)
          cache.delete(cacheKey)
          throw error
        })
      cache.set(cacheKey, record)
    }

    record.promise.then(
      (value) => { if (live) setState({ key: cacheKey, data: value, loading: false, error: null }) },
      (error) => { if (live) setState({ key: cacheKey, data: undefined, loading: false, error }) },
    )

    return () => { live = false }
  }, [cacheKey, enabled, attempt])

  const retry = useCallback(() => {
    cache.delete(cacheKey)
    setAttempt(value => value + 1)
  }, [cacheKey])

  return {
    data: view.data,
    loading: view.loading,
    error: view.error,
    retry,
  }
}
