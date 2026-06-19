import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("workbench git dock layout", () => {
  it("keeps Git in the wide bottom dock instead of the narrow inspector", () => {
    const layout = readFileSync(join(process.cwd(), "src/renderer/workbench/WorkbenchLayout.tsx"), "utf8")
    const styles = readFileSync(join(process.cwd(), "src/renderer/globals.css"), "utf8")

    expect(layout).toContain("rightPanel && rightPanel !== 'git'")
    expect(layout).toContain("rightPanel === 'git'")
    expect(layout).toContain("WorkbenchBottomDock")
    expect(styles).toContain(".wb-bottom-dock")
    expect(styles).toContain("left: calc(var(--wb-sidebar-width, 312px) + 12px)")
    expect(styles).toContain(".wb-bottom-dock .wb-git-workflow")
  })

  it("keeps new floating workbench surfaces on theme tokens", () => {
    const styles = readFileSync(join(process.cwd(), "src/renderer/globals.css"), "utf8")

    expect(styles).toContain(':root[data-theme="dark"] .wb-workspace-popover')
    expect(styles).toContain(':root[data-theme="dark"] .wb-git-branch-popover')
    expect(styles).not.toContain('.wb-context-capacity-trigger')
    expect(styles).not.toMatch(/var\(--line\)/)
    expect(styles).not.toMatch(/var\(--bg-2\)/)
  })
})
