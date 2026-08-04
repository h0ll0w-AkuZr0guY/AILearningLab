const assert = (value, message) => { if (!value) throw new Error(message) }
const P = name => ({ kind: "primitive", name })
const O = properties => ({ kind: "object", properties: new Map(Object.entries(properties)) })
const F = (params, returns) => ({ kind: "function", params, returns })

function relation(source, target, seen = new Set(), path = []) {
  const pair = `${source.id ?? JSON.stringify(source)}=>${target.id ?? JSON.stringify(target)}`
  if (seen.has(pair)) return { ok: true, path }
  seen.add(pair)
  if (source.kind === "primitive" && target.kind === "primitive") {
    return source.name === target.name ? { ok: true, path } : { ok: false, path, reason: "primitive" }
  }
  if (source.kind === "object" && target.kind === "object") {
    for (const [name, wanted] of target.properties) {
      const actual = source.properties.get(name)
      if (!actual) return { ok: false, path: [...path, name], reason: "missing" }
      const result = relation(actual, wanted, seen, [...path, name])
      if (!result.ok) return result
    }
    return { ok: true, path }
  }
  if (source.kind === "function" && target.kind === "function") {
    if (source.params.length !== target.params.length) return { ok: false, path, reason: "arity" }
    for (let i = 0; i < source.params.length; i++) {
      const result = relation(target.params[i], source.params[i], seen, [...path, `arg${i}`])
      if (!result.ok) return result
    }
    return relation(source.returns, target.returns, seen, [...path, "return"])
  }
  return { ok: false, path, reason: "unsupported" }
}

const source = O({ id: P("number"), label: P("string") })
const target = O({ id: P("number") })
assert(relation(source, target).ok, "extra source member is allowed")
const bad = relation(O({ id: P("string") }), target)
assert(!bad.ok && bad.path.join(".") === "id", "nested mismatch keeps path")
const dog = O({ name: P("string"), bark: P("boolean") })
const animal = O({ name: P("string") })
assert(!relation(F([dog], animal), F([animal], animal)).ok, "strict function parameters reject narrow callback")
console.log("typescript-12-02: PASS")
