import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("IPC registration hub", () => {
  const source = readFileSync(join(__dirname, "../index.ts"), "utf8")

  it("registers missing IPC handlers exactly once", () => {
    const calls = source.match(/\bregisterMissingIpc\(/g) || []
    expect(calls).toHaveLength(1)
  })
})
