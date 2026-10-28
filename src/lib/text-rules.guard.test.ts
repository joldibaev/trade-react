import { describe, expect, it } from "vitest"

/**
 * The server's text rules are read from its OpenAPI document (`src/api/text-rules.gen.ts`), never copied. A form that
 * writes its own maximum length or Unicode pattern is the copy that drifts from the server; this finds it.
 */
const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
})

// The generated rules, their reader and this guard are the only places that may say these things.
const allowed = [
  "/src/api/",
  "/src/lib/text-rules.ts",
  "/src/lib/text-rules.test.ts",
  "/src/lib/text-rules.guard.test.ts",
]

const forbidden: [string, RegExp][] = [
  ["a maximum or minimum length", /\b(?:maxLength|minLength)\b\s*[:=]/],
  ["a Unicode category pattern", /\\p\{(?:Cc|Cf|L|N|Z)\}/],
  [
    "a hand-named length limit",
    /\b(?:textMaxLength|nameMaxLength|passwordMinLength|titleLength|qrValueLength)\b/,
  ],
  ["an HTML length attribute", /\b(?:maxLength|minLength)=\{/],
]

describe("no form declares its own text rule", () => {
  const files = Object.entries(sources).filter(
    ([path]) => !allowed.some((prefix) => path.startsWith(prefix))
  )

  it("looks at the source files", () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it.each(forbidden)("%s", (_, pattern) => {
    const found = files
      .filter(([, source]) => pattern.test(source))
      .map(([path]) => path)
    expect(found).toEqual([])
  })
})
