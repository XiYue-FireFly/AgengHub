import { describe, expect, it } from 'vitest'
import {
  validateEditResult,
  applyInlineEdit,
  buildInlineEditPrompt
} from '../inline-edit'

describe('inline-edit', () => {
  it('验证有效编辑结果', () => {
    const result = validateEditResult(
      'const x = 1',
      'let x = 1'
    )
    expect(result.valid).toBe(true)
    expect(result.warnings).toBeDefined()
  })

  it('应用内联编辑成功', () => {
    const result = applyInlineEdit(
      'line1\nline2\nline3',
      2, 2,
      'LINE2'
    )
    expect(result.ok).toBe(true)
    expect(result.content).toBe('line1\nLINE2\nline3')
  })

  it('应用编辑失败 - 行号超出范围', () => {
    const result = applyInlineEdit(
      'line1\nline2',
      10, 20,
      'new'
    )
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('构建内联编辑提示词', () => {
    const prompt = buildInlineEditPrompt({
      range: {
        filePath: 'src/main.ts',
        startLine: 1,
        endLine: 5,
        selectedText: 'const x = 1'
      },
      instruction: 'Change const to let'
    })
    expect(prompt).toContain('src/main.ts')
    expect(prompt).toContain('const x = 1')
    expect(prompt).toContain('Change const to let')
  })

  it('支持多行编辑', () => {
    const result = applyInlineEdit(
      'function foo() {\n  return 1\n}',
      1, 3,
      'function bar() {\n  return 2\n}'
    )
    expect(result.ok).toBe(true)
    expect(result.content).toBe('function bar() {\n  return 2\n}')
  })

  it('验证编辑结果 - 括号不匹配警告', () => {
    const result = validateEditResult(
      '{ code }',
      '{ { { code '
    )
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('验证编辑结果 - 空替换警告', () => {
    const result = validateEditResult(
      'some code',
      '   '
    )
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('返回新的行号范围（单行替换）', () => {
    const result = applyInlineEdit('a\nb\nc', 2, 2, 'B')
    expect(result.newStartLine).toBe(2)
    expect(result.newEndLine).toBe(2)
  })

  it('返回新的行号范围（多行替换）', () => {
    const result = applyInlineEdit('a\nb\nc\nd', 2, 2, 'x\ny\nz')
    expect(result.newStartLine).toBe(2)
    expect(result.newEndLine).toBe(4)
  })

  it('CRLF 文件：保留 CRLF 行尾，不产生混合行尾', () => {
    const crlf = 'line1\r\nline2\r\nline3'
    const result = applyInlineEdit(crlf, 2, 2, 'REPLACED')
    expect(result.ok).toBe(true)
    expect(result.content).toBe('line1\r\nREPLACED\r\nline3')
    // 不应出现孤立的 LF
    expect(result.content?.includes('\r\n')).toBe(true)
    expect(result.content?.includes('\n') && !result.content?.includes('\r\n')).toBe(false)
  })

  it('CRLF 文件：多行替换也保持 CRLF', () => {
    const crlf = 'a\r\nb\r\nc'
    const result = applyInlineEdit(crlf, 1, 1, 'x\ny')
    expect(result.content).toBe('x\r\ny\r\nb\r\nc')
  })
})
