import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("workbench titlebar menu layering", () => {
  it("keeps desktop menus above normal workbench panels", () => {
    const css = readFileSync(join(process.cwd(), "src/renderer/globals.css"), "utf8")

    expect(css).toMatch(/\.wb-titlebar\s*\{[\s\S]*?z-index:\s*5200/)
    expect(css).toMatch(/\.wb-titlebar\s*\{[\s\S]*?overflow:\s*visible/)
    expect(css).toMatch(/\.wb-menu-wrap\s*\{[\s\S]*?z-index:\s*5210/)
    expect(css).toMatch(/\.wb-menu-wrap\s*\{[\s\S]*?overflow:\s*visible/)
    expect(css).toMatch(/\.wb-menu-dropdown\s*\{[\s\S]*?z-index:\s*5220/)
  })
})
