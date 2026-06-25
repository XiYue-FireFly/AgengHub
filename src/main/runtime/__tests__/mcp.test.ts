import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const memory: Record<string, any> = {}
let workspaceRoot = ""

vi.mock("../../store", () => ({
  store: {
    get: (key: string) => memory[key],
    set: (key: string, value: any) => { memory[key] = value }
  }
}))

vi.mock("../../hub/workspace", () => ({
  getWorkspaceManager: () => ({
    getById: (id: string) => id === "ws-1"
      ? { id, name: "Workspace", rootPath: workspaceRoot, createdAt: 1, updatedAt: 1 }
      : undefined
  })
}))

describe("MCP runtime", () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key]
    workspaceRoot = mkdtempSync(join(tmpdir(), "agenthub-mcp-"))
    vi.doMock("node:os", async () => {
      const actual = await vi.importActual<typeof import("node:os")>("node:os")
      return { ...actual, homedir: () => workspaceRoot }
    })
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it("discovers workspace MCP servers and returns workspace-aware enable overrides", async () => {
    writeFileSync(join(workspaceRoot, ".mcp.json"), JSON.stringify({
      mcpServers: {
        notes: {
          command: "node",
          args: ["server.js"],
          enabled: true
        }
      }
    }))

    const { listMcpServers, setMcpEnabled } = await import("../mcp")
    const server = listMcpServers("ws-1").find(item => item.name === "notes")

    expect(server).toMatchObject({
      name: "notes",
      source: "workspace",
      enabled: true,
      transport: "stdio",
      command: "node"
    })

    const updated = setMcpEnabled(server!.id, false, "ws-1")

    expect(updated).toMatchObject({
      id: server!.id,
      enabled: false,
      source: "workspace"
    })
    expect(listMcpServers("ws-1").find(item => item.id === server!.id)?.enabled).toBe(false)
  })

  it("keeps the first MCP server when duplicate names are discovered", async () => {
    writeFileSync(join(workspaceRoot, "mcp.json"), JSON.stringify({
      mcpServers: {
        docs: {
          command: "node",
          args: ["first.js"],
          enabled: true
        }
      }
    }))
    writeFileSync(join(workspaceRoot, ".mcp.json"), JSON.stringify({
      mcpServers: {
        docs: {
          command: "node",
          args: ["second.js"],
          enabled: true
        }
      }
    }))

    const { listMcpServers } = await import("../mcp")

    const servers = listMcpServers("ws-1").filter(item => item.name === "docs")

    expect(servers).toHaveLength(1)
    expect(servers[0]).toMatchObject({
      name: "docs",
      source: "workspace",
      command: "node",
      args: ["first.js"],
      sourcePath: join(workspaceRoot, "mcp.json")
    })
  })

  it("parses nested capability and single-server MCP configs with metadata", async () => {
    writeFileSync(join(workspaceRoot, "mcp.json"), JSON.stringify({
      capabilities: {
        mcp: {
          servers: {
            api: {
              transport: "http",
              url: "https://example.test/mcp",
              headers: { Authorization: "Bearer token" },
              timeoutMs: 5000,
              trustScope: "workspace",
              trustedWorkspaceRoots: [workspaceRoot]
            }
          }
        }
      }
    }))

    const { listMcpServers } = await import("../mcp")
    const server = listMcpServers("ws-1").find(item => item.name === "api")

    expect(server).toMatchObject({
      source: "workspace",
      transport: "http",
      url: "https://example.test/mcp",
      headers: { Authorization: "Bearer token" },
      timeoutMs: 5000,
      trustScope: "workspace",
      trustedWorkspaceRoots: [workspaceRoot],
      sourcePath: join(workspaceRoot, "mcp.json")
    })
  })

  it("parses a single MCP server JSON fragment", async () => {
    writeFileSync(join(workspaceRoot, ".mcp.json"), JSON.stringify({
      name: "single",
      command: "node",
      args: ["single-server.js"]
    }))

    const { listMcpServers } = await import("../mcp")
    const server = listMcpServers("ws-1").find(item => item.name === "single")

    expect(server).toMatchObject({
      source: "workspace",
      transport: "stdio",
      command: "node",
      args: ["single-server.js"],
      sourcePath: join(workspaceRoot, ".mcp.json")
    })
  })

  it("discovers Claude and global config MCP entries", async () => {
    const home = workspaceRoot
    writeFileSync(join(home, ".claude.json"), JSON.stringify({
      disabledMcpServers: ["disabled-notes"],
      mcpServers: {
        "disabled-notes": { command: "node", args: ["disabled.js"] },
        "claude-notes": { command: "node", args: ["notes.js"] }
      }
    }))
    mkdirSync(join(home, ".ccgui"), { recursive: true })
    writeFileSync(join(home, ".ccgui", "config.json"), JSON.stringify({
      mcpServers: [
        { id: "global-api", enabled: true, server: { type: "http", url: "https://example.test/mcp" } }
      ]
    }))

    const { listMcpServers } = await import("../mcp")
    const servers = listMcpServers("ws-1")

    expect(servers.find(item => item.name === "claude-notes")).toMatchObject({
      source: "claude",
      command: "node",
      enabled: true
    })
    expect(servers.find(item => item.name === "disabled-notes")).toMatchObject({
      source: "claude",
      enabled: false
    })
    expect(servers.find(item => item.name === "global-api")).toMatchObject({
      source: "ccgui",
      transport: "http",
      url: "https://example.test/mcp"
    })
  })

  it("discovers Codex TOML MCP server entries", async () => {
    mkdirSync(join(workspaceRoot, ".codex"), { recursive: true })
    writeFileSync(join(workspaceRoot, ".codex", "config.toml"), [
      '[mcp_servers.context7]',
      'command = "node"',
      'args = ["server.js"]',
      'env = { API_KEY = "token" }'
    ].join("\n"))

    const { listMcpServers } = await import("../mcp")
    const server = listMcpServers("ws-1").find(item => item.name === "context7")

    expect(server).toMatchObject({
      source: "codex",
      transport: "stdio",
      command: "node",
      args: ["server.js"],
      env: { API_KEY: "token" }
    })
  })

  it("tests a stdio MCP server by waiting for initialize response", async () => {
    const serverPath = join(workspaceRoot, "mcp-server.js")
    writeFileSync(serverPath, [
      "process.stdin.setEncoding('utf8')",
      "process.stdin.on('data', chunk => {",
      "  if (chunk.includes('initialize')) {",
      "    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'test', version: '1' } } }) + '\\n')",
      "  }",
      "})"
    ].join("\n"))
    memory["runtime.mcp.v1"] = {
      version: 1,
      servers: [{
        id: "local-test",
        name: "local-test",
        source: "user",
        enabled: true,
        transport: "stdio",
        command: process.execPath,
        args: [serverPath],
        timeoutMs: 2000
      }],
      overrides: {}
    }

    const { testMcpServer } = await import("../mcp")
    const result = await testMcpServer("local-test", "ws-1")

    expect(result.status).toBe("ok")
  })

  it("allows stdio MCP servers that initialize slowly", async () => {
    const serverPath = join(workspaceRoot, "slow-mcp-server.js")
    writeFileSync(serverPath, [
      "process.stdin.setEncoding('utf8')",
      "process.stdin.on('data', chunk => {",
      "  if (chunk.includes('initialize')) {",
      "    setTimeout(() => {",
      "      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'slow', version: '1' } } }) + '\\n')",
      "    }, 1600)",
      "  }",
      "})"
    ].join("\n"))
    memory["runtime.mcp.v1"] = {
      version: 1,
      servers: [{
        id: "slow-test",
        name: "slow-test",
        source: "user",
        enabled: true,
        transport: "stdio",
        command: process.execPath,
        args: [serverPath]
      }],
      overrides: {}
    }

    const { testMcpServer } = await import("../mcp")
    const result = await testMcpServer("slow-test", "ws-1")

    expect(result.status).toBe("ok")
  })

  it("enumerates tools, resources, and prompts from MCP server", async () => {
    const serverPath = join(workspaceRoot, "full-mcp-server.js")
    writeFileSync(serverPath, [
      "process.stdin.setEncoding('utf8')",
      "let id = 0",
      "process.stdin.on('data', chunk => {",
      "  const lines = chunk.split('\\n').filter(Boolean)",
      "  for (const line of lines) {",
      "    try {",
      "      const msg = JSON.parse(line)",
      "      if (msg.method === 'initialize') {",
      "        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: 'full', version: '1' } } }) + '\\n')",
      "      } else if (msg.method === 'notifications/initialized') {",
      "        // no response needed",
      "      } else if (msg.method === 'tools/list') {",
      "        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'search', description: 'Search docs' }, { name: 'fetch', description: 'Fetch URL' }] } }) + '\\n')",
      "      } else if (msg.method === 'resources/list') {",
      "        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { resources: [{ uri: 'file:///readme', name: 'README' }, { uri: 'file:///changelog', name: 'CHANGELOG' }, { uri: 'file:///license', name: 'LICENSE' }] } }) + '\\n')",
      "      } else if (msg.method === 'prompts/list') {",
      "        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { prompts: [{ name: 'summarize', description: 'Summarize text' }] } }) + '\\n')",
      "      }",
      "    } catch {}",
      "  }",
      "})"
    ].join("\n"))
    memory["runtime.mcp.v1"] = {
      version: 1,
      servers: [{
        id: "full-test",
        name: "full-test",
        source: "user",
        enabled: true,
        transport: "stdio",
        command: process.execPath,
        args: [serverPath],
        timeoutMs: 5000
      }],
      overrides: {}
    }

    const { listMcpServerTools } = await import("../mcp")
    const result = await listMcpServerTools("full-test", "ws-1")

    expect(result.ok).toBe(true)
    expect(result.tools).toHaveLength(2)
    expect(result.resources).toBe(3)
    expect(result.prompts).toBe(1)
  })

  it("returns tools even when resources/list or prompts/list fail", async () => {
    const serverPath = join(workspaceRoot, "partial-mcp-server.js")
    writeFileSync(serverPath, [
      "process.stdin.setEncoding('utf8')",
      "process.stdin.on('data', chunk => {",
      "  const lines = chunk.split('\\n').filter(Boolean)",
      "  for (const line of lines) {",
      "    try {",
      "      const msg = JSON.parse(line)",
      "      if (msg.method === 'initialize') {",
      "        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'partial', version: '1' } } }) + '\\n')",
      "      } else if (msg.method === 'notifications/initialized') {",
      "        // no response",
      "      } else if (msg.method === 'tools/list') {",
      "        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'ping' }] } }) + '\\n')",
      "      } else if (msg.method === 'resources/list' || msg.method === 'prompts/list') {",
      "        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } }) + '\\n')",
      "      }",
      "    } catch {}",
      "  }",
      "})"
    ].join("\n"))
    memory["runtime.mcp.v1"] = {
      version: 1,
      servers: [{
        id: "partial-test",
        name: "partial-test",
        source: "user",
        enabled: true,
        transport: "stdio",
        command: process.execPath,
        args: [serverPath],
        timeoutMs: 5000
      }],
      overrides: {}
    }

    const { listMcpServerTools } = await import("../mcp")
    const result = await listMcpServerTools("partial-test", "ws-1")

    expect(result.ok).toBe(true)
    expect(result.tools).toHaveLength(1)
    expect(result.resources).toBe(0)
    expect(result.prompts).toBe(0)
  })
})
