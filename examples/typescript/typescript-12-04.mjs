const assert = (value, message) => { if (!value) throw new Error(message) }
const P = name => ({ kind: "primitive", name })
const V = name => ({ kind: "typevar", name })
const record = (variable, constraint = null, defaultType = null) => ({ variable, candidates: [], constraint, defaultType })

function collect(source, pattern, info, path = "arg") {
  if (pattern.kind === "typevar") {
    info.candidates.push({ type: source, path })
    return
  }
  if (pattern.kind === "object" && source.kind === "object") {
    for (const [name, child] of pattern.properties) {
      const actual = source.properties.get(name)
      if (actual) collect(actual, child, info, `${path}.${name}`)
    }
  }
}

function solve(info, mode = "same") {
  if (!info.candidates.length) return info.defaultType ?? { kind: "error", reason: "no-candidate" }
  const unique = [...new Map(info.candidates.map(item => [item.type.name, item.type])).values()]
  if (mode === "same" && unique.length > 1) return { kind: "error", reason: "conflict" }
  const chosen = mode === "union" && unique.length > 1 ? { kind: "union", members: unique } : unique[0]
  if (info.constraint && chosen.kind === "primitive" && chosen.name !== info.constraint.name) {
    return { kind: "error", reason: "constraint-mismatch" }
  }
  return chosen
}

const info = record(V("T"))
collect(P("number"), V("T"), info)
assert(solve(info).name === "number", "one candidate solves T")

const pairInfo = record(V("T"))
collect(P("string"), V("T"), pairInfo, "arg0")
collect(P("number"), V("T"), pairInfo, "arg1")
assert(solve(pairInfo).reason === "conflict", "same-mode conflict remains visible")
assert(solve(pairInfo, "union").kind === "union", "union mode preserves candidates")

const constrained = record(V("T"), P("number"))
collect(P("string"), V("T"), constrained)
assert(solve(constrained).reason === "constraint-mismatch", "constraint failure is distinct")

const missing = record(V("T"), null, P("unknown"))
assert(solve(missing).name === "unknown", "default fills missing evidence")
console.log("typescript-12-04: PASS")
