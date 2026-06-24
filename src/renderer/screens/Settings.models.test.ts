import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

describe("Settings model route center UI", () => {
  const source = readFileSync(resolve(__dirname, "Settings.tsx"), "utf8")
  const css = readFileSync(resolve(__dirname, "../globals.css"), "utf8")
  const appearance = readFileSync(resolve(__dirname, "../appearance.ts"), "utf8")

  it("uses the global model route IPC instead of provider-only model flattening", () => {
    expect(source).toContain("window.electronAPI.models.list()")
    expect(source).toContain("window.electronAPI.models.updateRoute")
    expect(source).toContain("window.electronAPI.models.test")
    expect(source).toContain("window.electronAPI.models.exportCodexCatalog")
  })

  it("contains Mac and Windows preview UI classes", () => {
    expect(source).toContain("wb-ui-style-preview-grid")
    expect(source).toContain("Mac Preview")
    expect(source).toContain("Windows Preview")
    expect(css).toContain('[data-ui-style="mac"]')
    expect(css).toContain('[data-ui-style="win"]')
    expect(appearance).toContain("root.dataset.uiStyle = preferences.uiStyle")
    expect(appearance).toContain("root.setAttribute('data-uistyle', preferences.uiStyle)")
    expect(css).toContain(".wb-model-route-item")
    expect(source).not.toContain('className="wb-model-route-row')
  })
})
