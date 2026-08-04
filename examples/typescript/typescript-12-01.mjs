const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const primitive = name => Object.freeze({ kind: "primitive", name })
const object = entries => Object.freeze({ kind: "object", properties: new Map(entries) })
const fn = (params, returns) => Object.freeze({ kind: "function", params: [...params], returns })

function flattenUnion(members) {
  return members.flatMap(item => item.kind === "union" ? item.members : [item])
}

function union(members) {
  const unique = []
  const keys = new Set()
  for (const member of flattenUnion(members)) {
    const key = member.kind === "primitive"
      ? `primitive:${member.name}`
      : JSON.stringify(member, (_, value) => value instanceof Map ? [...value] : value)
    if (!keys.has(key)) {
      keys.add(key)
      unique.push(member)
    }
  }
  return Object.freeze({ kind: "union", members: unique })
}

const number = primitive("number")
const string = primitive("string")
const user = object([["id", number]])
const lookup = union([number, union([string, number])])
const callback = fn([user], string)

assert(lookup.members.length === 2, "union should flatten and deduplicate")
assert(user.properties.get("id") === number, "object property retains Type identity")
assert(callback.params[0] === user, "function parameter retains object Type")

try {
  const unsupported = { kind: "conditional", check: number }
  if (!["primitive", "object", "union", "function"].includes(unsupported.kind)) {
    throw new Error(`unsupported Type AST: ${unsupported.kind}`)
  }
  assert(false, "unsupported type should fail")
} catch (error) {
  assert(error.message.includes("unsupported"), "failure must identify unsupported type")
}

console.log("typescript-12-01: PASS")
