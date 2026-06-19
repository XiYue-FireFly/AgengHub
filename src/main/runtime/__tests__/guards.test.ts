import { describe, expect, it } from "vitest"
import { explicitGuardVerdictFromText, guardShouldBlockExecutor, riskVerdictForText } from "../guards"

describe("custom schedule guards", () => {
  it("blocks executor when reviewer or gatekeeper requires revision", () => {
    const verdict = riskVerdictForText("This answer should run terminal command: rm -rf ./dist", "reviewer")

    expect(verdict.status).toBe("block")
    expect(guardShouldBlockExecutor(verdict, "reviewer")).toBe(true)
  })

  it("treats medium reviewer findings as executor blockers but keeps executor no-op informational", () => {
    const reviewer = riskVerdictForText("The candidate wants to use browser click automation.", "reviewer")
    const executor = riskVerdictForText("No execution needed.", "executor")

    expect(reviewer.status).toBe("revise")
    expect(guardShouldBlockExecutor(reviewer, "reviewer")).toBe(true)
    expect(executor.status).toBe("pass")
    expect(guardShouldBlockExecutor(executor, "executor")).toBe(false)
  })

  it("detects Chinese destructive and sensitive-risk wording", () => {
    expect(riskVerdictForText("请删除所有临时文件并运行命令", "reviewer")).toMatchObject({ status: "revise", level: "medium" })
    expect(riskVerdictForText("不要泄露 API token 或私钥", "reviewer")).toMatchObject({ status: "block", level: "high" })
  })

  it("honors explicit reviewer and gatekeeper verdict tokens", () => {
    const block = explicitGuardVerdictFromText("BLOCK\nThe output violates the requested format.")
    const revise = explicitGuardVerdictFromText("REVISE: answer must be shorter.")

    expect(block).toMatchObject({ status: "block", level: "high" })
    expect(revise).toMatchObject({ status: "revise", level: "medium" })
    expect(guardShouldBlockExecutor(block!, "gatekeeper")).toBe(true)
    expect(guardShouldBlockExecutor(revise!, "reviewer")).toBe(true)
  })

  it("only parses explicit verdicts from the first nonempty verdict line", () => {
    expect(explicitGuardVerdictFromText("Return PASS, WARN, REVISE, or BLOCK.\nBLOCK\nUnsafe output.")).toBeNull()
    expect(explicitGuardVerdictFromText("The answer is BLOCK-worthy.")).toBeNull()
    expect(explicitGuardVerdictFromText("\n\nWARN\nNeeds one formatting fix.")).toMatchObject({ status: "warn", level: "low" })
  })

  it("does not treat executor no-op responses as risky", () => {
    expect(riskVerdictForText("No execution needed.", "executor")).toMatchObject({ status: "pass", level: "low" })
  })
})
