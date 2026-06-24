import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("missing IPC skills handlers", () => {
  const source = readFileSync(join(__dirname, "../missing-ipc.ts"), "utf8")

  it("uses static imports for bundled main-process modules", () => {
    expect(source).not.toMatch(/require\(['"]\.\.\//)
  })

  it("uses real SkillManager APIs for local skill loading", () => {
    expect(source).toContain("getSkillManager().list()")
    expect(source).toContain("getSkillManager().scanLocal({ refresh: true })")
    expect(source).toContain("BUILTIN_SKILLS")
    expect(source).not.toContain("listSkills()")
    expect(source).not.toContain("listBuiltinSkills()")
    expect(source).not.toContain("refreshLocal()")
  })

  it("does not silently convert skill IPC failures into empty success states", () => {
    const skillsBlock = source.slice(
      source.indexOf("// --- Skills ---"),
      source.indexOf("// --- Agentic ---")
    )
    expect(skillsBlock).not.toContain("catch { return [] }")
    expect(skillsBlock).not.toContain("catch { return null }")
    expect(skillsBlock).not.toContain("catch { return false }")
  })

  it("does not silently convert agentic and approval IPC failures into no-op states", () => {
    const agenticBlock = source.slice(
      source.indexOf("// --- Agentic ---"),
      source.indexOf("// --- App ---")
    )
    expect(agenticBlock).not.toContain("catch { return [] }")
    expect(agenticBlock).not.toContain("catch { return 'all' }")
    expect(agenticBlock).not.toContain("catch { }")
  })
})
