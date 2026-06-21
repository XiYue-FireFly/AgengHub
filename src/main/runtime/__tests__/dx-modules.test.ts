import { describe, expect, it } from "vitest"

// --- Terminal AI ---

describe("terminal-ai", () => {
  it("builds prompt with terminal context", async () => {
    const { buildTerminalPrompt } = await import("../terminal-ai")
    const prompt = buildTerminalPrompt("Why did this fail?", {
      recentCommands: ["npm test", "npm run build"],
      recentOutput: ["Error: Cannot find module './foo'"],
      cwd: "/home/user/project",
      lastExitCode: 1
    })
    expect(prompt).toContain("Working directory: /home/user/project")
    expect(prompt).toContain("$ npm test")
    expect(prompt).toContain("Cannot find module")
    expect(prompt).toContain("exited with code 1")
    expect(prompt).toContain("Why did this fail?")
  })

  it("suggests command prompt", async () => {
    const { suggestCommandPrompt } = await import("../terminal-ai")
    const prompt = suggestCommandPrompt("install express", { recentCommands: [], recentOutput: [] })
    expect(prompt).toContain("install express")
    expect(prompt).toContain("Return ONLY the command")
  })

  it("explains output prompt", async () => {
    const { explainOutputPrompt } = await import("../terminal-ai")
    const prompt = explainOutputPrompt({ recentCommands: ["ls -la"], recentOutput: ["total 0"] })
    expect(prompt).toContain("Explain what this terminal output means")
  })
})

// --- Browser Workspace ---

describe("browser-workspace", () => {
  it("summarizes page snapshot", async () => {
    const { summarizePageSnapshot } = await import("../browser-workspace")
    const summary = summarizePageSnapshot({
      url: "https://example.com",
      title: "Example",
      textContent: "Hello world content",
      meta: { description: "An example site" },
      links: [{ text: "Link 1", href: "/page1" }],
      hasForms: true,
      capturedAt: new Date().toISOString()
    })
    expect(summary).toContain("Example")
    expect(summary).toContain("example.com")
    expect(summary).toContain("An example site")
    expect(summary).toContain("Hello world content")
    expect(summary).toContain("interactive forms")
  })

  it("extracts readable text from HTML", async () => {
    const { extractReadableText } = await import("../browser-workspace")
    const text = extractReadableText('<html><head><title>T</title></head><body><p>Hello</p><script>alert(1)</script><p>World</p></body></html>')
    expect(text).toContain("Hello")
    expect(text).toContain("World")
    expect(text).not.toContain("alert")
    expect(text).not.toContain("<p>")
  })

  it("builds page analysis prompt", async () => {
    const { buildPageAnalysisPrompt } = await import("../browser-workspace")
    const prompt = buildPageAnalysisPrompt({
      url: "https://test.com",
      title: "Test Page",
      textContent: "content",
      meta: {},
      links: [],
      hasForms: false,
      capturedAt: new Date().toISOString()
    }, "Summarize this")
    expect(prompt).toContain("Summarize this")
    expect(prompt).toContain("Test Page")
  })
})

// --- Inline Edit ---

describe("inline-edit", () => {
  it("builds edit prompt with context", async () => {
    const { buildInlineEditPrompt } = await import("../inline-edit")
    const prompt = buildInlineEditPrompt({
      range: {
        filePath: "src/main.ts",
        startLine: 5,
        endLine: 7,
        selectedText: "const x = 1\nconst y = 2\nconst z = 3",
        fullContent: "line1\nline2\nline3\nline4\nconst x = 1\nconst y = 2\nconst z = 3\nline8\nline9\nline10"
      },
      instruction: "Change to use let instead of const"
    })
    expect(prompt).toContain("src/main.ts")
    expect(prompt).toContain("5-7")
    expect(prompt).toContain("const x = 1")
    expect(prompt).toContain("Change to use let")
    expect(prompt).toContain("line4") // context before
    expect(prompt).toContain("line8") // context after
  })

  it("validates edit result", async () => {
    const { validateEditResult } = await import("../inline-edit")
    expect(validateEditResult("const x = 1", "let x = 1").valid).toBe(true)
    const identical = validateEditResult("same", "same")
    expect(identical.warnings.some(w => w.includes("identical"))).toBe(true)
    expect(validateEditResult("code", "").warnings[0]).toContain("empty")
  })

  it("applies inline edit to file content", async () => {
    const { applyInlineEdit } = await import("../inline-edit")
    const result = applyInlineEdit("line1\nline2\nline3\nline4\nline5", 2, 4, "REPLACED")
    expect(result.ok).toBe(true)
    expect(result.content).toBe("line1\nREPLACED\nline5")
  })

  it("rejects invalid range", async () => {
    const { applyInlineEdit } = await import("../inline-edit")
    const result = applyInlineEdit("line1\nline2", 5, 10, "x")
    expect(result.ok).toBe(false)
    expect(result.error).toContain("Invalid range")
  })
})
