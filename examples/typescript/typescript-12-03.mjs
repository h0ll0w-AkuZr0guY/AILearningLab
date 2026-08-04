const assert = (value, message) => { if (!value) throw new Error(message) }
const union = members => [...new Set(members)]

function narrow(type, guard, assumeTrue) {
  const result = type.filter(member => assumeTrue ? guard(member) : !guard(member))
  return result.length ? result : ["never"]
}

const entry = ["string", "number", "null"]
const trueBranch = narrow(entry, value => value === "string", true)
const falseBranch = narrow(entry, value => value === "string", false)
assert(trueBranch.join("|") === "string", "typeof guard selects string")
assert(falseBranch.join("|") === "number|null", "false edge retains other candidates")
assert(narrow(entry, value => value !== "null", true).join("|") === "string|number", "truthy removes null")
assert(union([...trueBranch, ...falseBranch]).join("|") === "string|number|null", "join restores candidates")

const facts = new Map([["value", entry]])
const narrowed = new Map(facts)
narrowed.set("value", trueBranch)
assert(facts.get("value").length === 3, "branch snapshot does not mutate entry")
narrowed.delete("value")
assert(!narrowed.has("value"), "assignment invalidates stale fact")

console.log("typescript-12-03: PASS")
