const assert = (value, message) => { if (!value) throw new Error(message) }

function lineAndColumn(text, offset) {
  const lines = text.slice(0, offset).split(/\r?\n/)
  return { line: lines.length, column: lines.at(-1).length + 1 }
}

function makeDiagnostic({ stage, code, category = "error", file, start, length, messageText, relatedInformation = [] }) {
  return Object.freeze({ stage, code, category, file, start, length, messageText, relatedInformation })
}

function collect(groups) {
  const result = []
  const seen = new Set()
  for (const group of groups) {
    for (const diagnostic of group) {
      const key = [diagnostic.stage, diagnostic.file, diagnostic.start, diagnostic.code, diagnostic.messageText].join(":")
      if (!seen.has(key)) { seen.add(key); result.push(diagnostic) }
    }
  }
  return result
}

const text = "const count: number = \"oops\"\n"
const start = text.indexOf("\"oops\"")
const semantic = makeDiagnostic({
  stage: "semantic", code: 2322, file: "main.ts", start, length: 6,
  messageText: "Type 'string' is not assignable to type 'number'.",
  relatedInformation: [{ messageText: "assignment target", start: text.indexOf("count") }]
})
const detached = makeDiagnostic({
  stage: "options", code: 6046, file: undefined, start: undefined, length: undefined,
  messageText: "Compiler option is not supported."
})
const diagnostics = collect([[semantic], [semantic, detached]])
assert(diagnostics.length === 2, "identical diagnostics are deduplicated")
assert(lineAndColumn(text, semantic.start).line === 1, "span converts to line/column")
assert(diagnostics.find(item => item.file === undefined), "detached diagnostic is retained")
assert(diagnostics.every(item => item.code && item.stage), "diagnostic keeps machine fields")
console.log(`${diagnostics[0].file}:${lineAndColumn(text, diagnostics[0].start).column}: ${diagnostics[0].messageText}`)
console.log("typescript-12-05: PASS")
