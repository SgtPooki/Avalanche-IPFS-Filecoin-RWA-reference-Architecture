import { useEffect, useState } from 'react'

type ReadState<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'failed'; message: string }

export function useRead<T>(load: (() => Promise<T>) | null) {
  const [result, setResult] = useState<ReadState<T>>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setResult({ state: 'loading' })
    if (load != null) void load().then(
      (value) => { if (active) setResult({ state: 'ready', value }) },
      (cause: unknown) => { if (active) setResult({ state: 'failed', message: String(cause) }) }
    )
    return () => { active = false }
  }, [load, attempt])
  return { result, refresh: () => setAttempt((value) => value + 1) }
}
