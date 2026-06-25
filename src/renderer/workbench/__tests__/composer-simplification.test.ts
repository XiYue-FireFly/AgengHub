import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('ComposerBar simplification', () => {
  it('removes quick cards and collapses hint buttons into one passive hint', () => {
    const source = readFileSync(join(process.cwd(), 'src/renderer/workbench/ComposerBar.tsx'), 'utf8')

    expect(source).not.toContain('wb-composer-quick-cards')
    expect(source).not.toContain('wb-command-open-hint')
    expect(source).toContain("Type / for commands, @ for context")
    expect(source).toContain("className=\"wb-composer-key-hint\"")
  })
})
