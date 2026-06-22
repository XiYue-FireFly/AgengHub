/**
 * styledConfirm: DOM-based confirmation dialog.
 * Returns true on confirm, false on cancel.
 */

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export function styledConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'wb-confirm-overlay'

    const container = document.createElement('div')
    container.className = 'wb-confirm-container'
    container.setAttribute('role', 'dialog')
    container.setAttribute('aria-modal', 'true')

    if (opts.title) {
      const titleEl = document.createElement('div')
      titleEl.className = 'wb-confirm-title'
      const titleStrong = document.createElement('strong')
      titleStrong.textContent = opts.title
      titleEl.appendChild(titleStrong)
      container.appendChild(titleEl)
    }

    const msgEl = document.createElement('div')
    msgEl.className = 'wb-confirm-message'
    msgEl.textContent = opts.message
    container.appendChild(msgEl)

    const btnRow = document.createElement('div')
    btnRow.className = 'wb-confirm-actions'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'ah-btn sm'
    cancelBtn.textContent = opts.cancelLabel || '取消'
    cancelBtn.onclick = () => { cleanup(); resolve(false) }

    const confirmBtn = document.createElement('button')
    confirmBtn.className = `ah-btn sm ${opts.danger ? 'danger' : 'primary'}`
    confirmBtn.textContent = opts.confirmLabel || '确认'
    confirmBtn.onclick = () => { cleanup(); resolve(true) }

    btnRow.appendChild(cancelBtn)
    btnRow.appendChild(confirmBtn)
    container.appendChild(btnRow)
    overlay.appendChild(container)
    document.body.appendChild(overlay)
    cancelBtn.focus()

    function cleanup() {
      document.removeEventListener('keydown', onKeyDown)
      overlay.remove()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { cleanup(); resolve(false) }
      if (e.key === 'Enter') { cleanup(); resolve(true) }
    }

    document.addEventListener('keydown', onKeyDown)
    overlay.onclick = (e) => { if (e.target === overlay) { cleanup(); resolve(false) } }
  })
}
