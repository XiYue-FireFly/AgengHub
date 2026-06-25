import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('workbench thread switching layout', () => {
  it('renders the chat surface from the pending visible thread during async switching', () => {
    const source = readFileSync(join(process.cwd(), 'src/renderer/workbench/WorkbenchLayout.tsx'), 'utf8')

    expect(source).toContain('const visibleThreadId = pendingActiveThreadId ?? activeThreadId')
    expect(source).toContain('snapshot.threads.find(t => t.id === visibleThreadId)')
    expect(source).toContain('const activeEvents = useMemo(')
    expect(source).toContain('visibleThreadId === activeThreadId ? events : events.filter(event => event.threadId === visibleThreadId)')
    expect(source).not.toContain('events={events}')
  })

  it('does not let background runtime events replace the visible thread', () => {
    const source = readFileSync(join(process.cwd(), 'src/renderer/workbench/WorkbenchLayout.tsx'), 'utf8')

    expect(source).toContain('const [selectedThreadId, setSelectedThreadIdState]')
    expect(source).toContain('const selectedThreadIdRef = useRef<string | null>(null)')
    expect(source).toContain("const LAST_THREAD_STORE_KEY = 'agenthub.workbench.lastThread.v1'")
    expect(source).toContain('const setSelectedThreadId = useCallback')
    expect(source).toContain('localStorage.setItem(LAST_THREAD_STORE_KEY, threadId)')
    expect(source).toContain('const activeThreadId = selectedThreadStillVisible ? selectedThreadId : null')
    expect(source).toContain('persistedStillVisible')
    expect(source).toContain('snap.threads[0]?.id ?? null')
    expect(source).toContain('setSnapshot({ ...snap, activeThreadId: nextVisibleThreadId })')
    expect(source).toContain('const loadedEvents = await window.electronAPI.runtime.eventsSince(nextVisibleThreadId, 0)')
    expect(source).toContain('const isVisibleThreadEvent = event.threadId === selectedThreadIdRef.current')
    expect(source).toContain('preserveSelectedSnapshot(next, prev)')
    expect(source).toContain('setSelectedThreadId(selected)')
    expect(source).toContain('const loadWorkbenchGenRef = useRef(0)')
    expect(source).toContain('const gen = ++loadWorkbenchGenRef.current')
    expect(source).toContain('loadWorkbenchGenRef.current += 1')
  })
})
