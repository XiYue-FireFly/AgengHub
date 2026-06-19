import React from 'react'
import { readAppearanceLocal } from '../appearance'
import { renderMarkdown } from './markdown-renderer'

export function MarkdownBlock({ content, emptyText, workspaceRoot }: { content: string; emptyText?: string; workspaceRoot?: string | null }) {
  const source = content.trim()
  const html = renderMarkdown(source || (emptyText ?? ''))
  const [fileMenu, setFileMenu] = React.useState<{
    x: number
    y: number
    path: string
    line?: number
    label: string
  } | null>(null)

  React.useEffect(() => {
    if (!fileMenu) return
    const close = () => setFileMenu(null)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [fileMenu])

  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement | null)?.closest?.('a[data-file-path]') as HTMLAnchorElement | null
    if (!link) return
    event.preventDefault()
    const rawPath = link.dataset.filePath || ''
    const line = link.dataset.line ? Number(link.dataset.line) : undefined
    openFileReference(rawPath, line)
  }
  const onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement | null)?.closest?.('a[data-file-path]') as HTMLAnchorElement | null
    if (!link) return
    event.preventDefault()
    event.stopPropagation()
    setFileMenu({
      x: Math.min(event.clientX, Math.max(12, window.innerWidth - 286)),
      y: Math.min(event.clientY, Math.max(12, window.innerHeight - 310)),
      path: link.dataset.filePath || '',
      line: link.dataset.line ? Number(link.dataset.line) : undefined,
      label: link.textContent?.trim() || link.dataset.filePath || ''
    })
  }
  const openFileReference = (rawPath: string, line?: number, target = readAppearanceLocal().defaultOpenTarget) => {
    const path = resolveMarkdownPath(rawPath, workspaceRoot)
    window.electronAPI.app.openPath({ path, target, line, workspaceRoot: workspaceRoot || undefined }).then(result => {
      if (!result.ok && result.error) console.warn('[AgentHub] open path failed:', result.error)
    }).catch(error => console.warn('[AgentHub] open path failed:', error))
  }
  const copyResolvedPath = async (rawPath: string) => {
    const path = resolveMarkdownPath(rawPath, workspaceRoot)
    const result = await window.electronAPI.app.resolvePath({ path, workspaceRoot: workspaceRoot || undefined }).catch((error: any) => ({ ok: false, path, error: error?.message || String(error) }))
    if (result.ok) await navigator.clipboard?.writeText(result.path)
    else await navigator.clipboard?.writeText(path)
  }
  const copyFileContent = async (rawPath: string) => {
    const path = resolveMarkdownPath(rawPath, workspaceRoot)
    const result = await window.electronAPI.app.readTextFile({ path, workspaceRoot: workspaceRoot || undefined }).catch((error: any) => ({ ok: false as const, path, content: '', error: error?.message || String(error) }))
    if (result.ok) await navigator.clipboard?.writeText(result.content || '')
    else console.warn('[AgentHub] read file failed:', result.error)
  }
  return (
    <>
      <div className="wb-markdown" onClick={onClick} onContextMenu={onContextMenu} dangerouslySetInnerHTML={{ __html: html }} />
      {fileMenu && (
        <div
          className="wb-file-context-menu"
          style={{ left: fileMenu.x, top: fileMenu.y }}
          onPointerDown={event => event.stopPropagation()}
          role="menu"
        >
          <div className="wb-file-context-title">
            <span>{fileMenu.label}</span>
            <small>{targetLabel(readAppearanceLocal().defaultOpenTarget)}</small>
          </div>
          <button type="button" onClick={() => { openFileReference(fileMenu.path, fileMenu.line); setFileMenu(null) }}>
            在默认目标中打开
          </button>
          <div className="wb-file-context-subtitle">打开方式</div>
          <button type="button" onClick={() => { openFileReference(fileMenu.path, fileMenu.line, 'antigravity'); setFileMenu(null) }}>Antigravity</button>
          <button type="button" onClick={() => { openFileReference(fileMenu.path, fileMenu.line, 'explorer'); setFileMenu(null) }}>文件管理器定位</button>
          <button type="button" onClick={() => { openFileReference(fileMenu.path, fileMenu.line, 'system'); setFileMenu(null) }}>系统默认</button>
          <div className="wb-file-context-sep" />
          <button type="button" onClick={() => { copyResolvedPath(fileMenu.path).finally(() => setFileMenu(null)) }}>复制路径</button>
          <button type="button" onClick={() => { copyFileContent(fileMenu.path).finally(() => setFileMenu(null)) }}>复制文件内容</button>
        </div>
      )}
    </>
  )
}

function resolveMarkdownPath(path: string, workspaceRoot?: string | null): string {
  if (/^[a-z]:[\\/]/i.test(path) || path.startsWith('/') || path.startsWith('\\\\')) return path
  if (!/[\\/]/.test(path) && !path.startsWith('.')) return path
  if (!workspaceRoot) return path
  return `${workspaceRoot.replace(/[\\/]+$/, '')}\\${path.replace(/^\.?[\\/]/, '')}`
}

function targetLabel(target: 'antigravity' | 'explorer' | 'system'): string {
  if (target === 'antigravity') return '默认：Antigravity'
  if (target === 'system') return '默认：系统'
  return '默认：文件管理器'
}
