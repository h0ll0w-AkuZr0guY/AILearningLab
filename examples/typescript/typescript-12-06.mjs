const assert = (value, message) => {
  if (!value) throw new Error(message)
}

const primitive = name => Object.freeze({ kind: "primitive", name })
const objectType = properties => Object.freeze({
  kind: "object",
  properties: new Map(Object.entries(properties))
})

function lineColumn(text, offset) {
  if (offset === undefined) return { line: undefined, column: undefined }
  const prefix = text.slice(0, offset)
  const lines = prefix.split(/\r?\n/)
  return { line: lines.length, column: lines.at(-1).length + 1 }
}

function diagnostic(stage, code, file, start, length, messageText, relatedInformation = []) {
  return Object.freeze({
    stage, code, file, start, length, messageText, relatedInformation
  })
}

function parse(source, file = "input.ts") {
  const statements = []
  const diagnostics = []
  let offset = 0
  for (const line of source.split(/\n/)) {
    const text = line.replace(/\r$/, "")
    const trimmed = text.trim()
    if (trimmed) {
      const typeMatch = trimmed.match(/^type\s+(\w+)\s*=\s*\{\s*(\w+)\s*:\s*(\w+)\s*\};$/)
      const valueMatch = trimmed.match(/^(const|let)\s+(\w+)\s*:\s*(\w+)\s*=\s*(.+?)\s*;$/)
      if (typeMatch) {
        statements.push({
          kind: "type",
          name: typeMatch[1],
          property: typeMatch[2],
          propertyType: typeMatch[3],
          start: offset,
          length: text.length
        })
      } else if (valueMatch) {
        const expression = valueMatch[4]
        statements.push({
          kind: "value",
          name: valueMatch[2],
          declared: valueMatch[3],
          expression,
          expressionStart: offset + text.indexOf(expression),
          start: offset,
          length: text.length
        })
      } else {
        diagnostics.push(diagnostic(
          "parse", 1000, file, offset, text.length, "无法识别的语句或缺少分号"
        ))
      }
    }
    offset += line.length + 1
  }
  return { file, source, statements, diagnostics }
}

function bind(parsed) {
  const types = new Map()
  const values = new Map()
  const diagnostics = []

  for (const statement of parsed.statements) {
    if (statement.kind === "type") {
      if (types.has(statement.name)) {
        diagnostics.push(diagnostic(
          "bind", 2300, parsed.file, statement.start, statement.length,
          "重复的类型别名 " + statement.name
        ))
        continue
      }
      types.set(statement.name, objectType({
        [statement.property]: primitive(statement.propertyType)
      }))
      continue
    }

    if (values.has(statement.name)) {
      diagnostics.push(diagnostic(
        "bind", 2451, parsed.file, statement.start, statement.length,
        "重复的值声明 " + statement.name
      ))
      continue
    }
    const declaredType = resolveType(statement.declared, types)
    if (declaredType.kind === "unknown") {
      diagnostics.push(diagnostic(
        "bind", 2304, parsed.file, statement.start, statement.length,
        "找不到类型 " + statement.declared
      ))
      continue
    }
    values.set(statement.name, {
      kind: "value",
      name: statement.name,
      type: declaredType,
      node: statement
    })
  }

  return { ...parsed, types, values, diagnostics }
}

function resolveType(name, types) {
  if (["number", "string", "boolean"].includes(name)) return primitive(name)
  return types.get(name) ?? { kind: "unknown", name }
}

function typeName(type) {
  if (type.kind === "primitive") return type.name
  if (type.kind === "object") return "{" + [...type.properties.keys()].join(", ") + "}"
  return type.name
}

function assignable(actual, expected) {
  if (actual.kind === "primitive" && expected.kind === "primitive") {
    return actual.name === expected.name
  }
  if (actual.kind === "object" && expected.kind === "object") {
    return [...expected.properties].every(([name, wanted]) => (
      actual.properties.has(name) && assignable(actual.properties.get(name), wanted)
    ))
  }
  return false
}

function expressionType(expression, bound, statement, file) {
  if (/^\d+$/.test(expression)) return { type: primitive("number") }
  if (/^"(?:[^"\\]|\\.)*"$/s.test(expression)) return { type: primitive("string") }
  if (/^(true|false)$/.test(expression)) return { type: primitive("boolean") }

  const objectMatch = expression.match(/^\{\s*(\w+)\s*:\s*(\d+|"(?:[^"\\]|\\.)*"|true|false)\s*\}$/s)
  if (objectMatch) {
    const valueType = expressionType(objectMatch[2], bound, statement, file)
    return { type: objectType({ [objectMatch[1]]: valueType.type }) }
  }

  const propertyMatch = expression.match(/^(\w+)\.(\w+)$/)
  if (propertyMatch) {
    const symbol = bound.values.get(propertyMatch[1])
    if (!symbol) {
      return { failure: diagnostic(
        "semantic", 2304, file, statement.expressionStart, expression.length,
        "找不到名称 " + propertyMatch[1]
      ) }
    }
    if (symbol.type.kind !== "object" || !symbol.type.properties.has(propertyMatch[2])) {
      return { failure: diagnostic(
        "semantic", 2339, file, statement.expressionStart, expression.length,
        "类型 " + typeName(symbol.type) + " 上不存在属性 " + propertyMatch[2]
      ) }
    }
    return { type: symbol.type.properties.get(propertyMatch[2]) }
  }

  const symbol = bound.values.get(expression)
  if (symbol) return { type: symbol.type }
  return { failure: diagnostic(
    "semantic", 2304, file, statement.expressionStart, expression.length,
    "无法解析表达式 " + expression
  ) }
}

function check(bound) {
  const diagnostics = []
  for (const statement of bound.statements) {
    if (statement.kind !== "value") continue
    const expected = resolveType(statement.declared, bound.types)
    const result = expressionType(statement.expression, bound, statement, bound.file)
    if (result.failure) {
      diagnostics.push(result.failure)
      continue
    }
    if (!assignable(result.type, expected)) {
      diagnostics.push(diagnostic(
        "semantic", 2322, bound.file, statement.expressionStart,
        statement.expression.length,
        "类型 " + typeName(result.type) + " 不能赋给 " + typeName(expected),
        [{ messageText: "目标注解为 " + typeName(expected), start: statement.start }]
      ))
    }
  }
  return { ...bound, diagnostics }
}

function formatDiagnostic(item, source) {
  if (!item.file || item.start === undefined) {
    return "<config> " + item.code + " " + item.messageText
  }
  const position = lineColumn(source, item.start)
  return item.file + ":" + position.line + ":" + position.column
    + " TS" + item.code + " " + item.messageText
}

function report(diagnostics, source, completed) {
  return {
    diagnostics,
    completed: [...completed, "report"],
    text: diagnostics.map(item => formatDiagnostic(item, source))
  }
}

function run(source, file = "input.ts") {
  const parsed = parse(source, file)
  if (parsed.diagnostics.length) {
    return report(
      parsed.diagnostics, source,
      ["parse", "bind-skipped", "check-skipped"]
    )
  }

  const bound = bind(parsed)
  if (bound.diagnostics.length) {
    return report(
      bound.diagnostics, source,
      ["parse", "bind", "check-skipped"]
    )
  }

  const checked = check(bound)
  return report(
    checked.diagnostics, source,
    ["parse", "bind", "check"]
  )
}

const goodSource = [
  "type User = { id: number };",
  "const user: User = { id: 7 };",
  "const count: number = user.id;",
  "const label: string = \"ok\";"
].join("\n")
const good = run(goodSource)
assert(good.completed.join(" → ") === "parse → bind → check → report", "normal path must complete")
assert(good.diagnostics.length === 0, "normal path must have no diagnostics")

const semanticSource = [
  "type User = { id: number };",
  "const user: User = { id: 7 };",
  "const wrong: string = user.id;",
  "const missing: string = user.name;"
].join("\n")
const semantic = run(semanticSource)
assert(semantic.diagnostics.length === 2, "independent semantic errors must both be reported")
assert(semantic.diagnostics.every(item => item.stage === "semantic"), "semantic failures keep their stage")
assert(semantic.diagnostics.some(item => item.code === 2322), "type mismatch must be located")
assert(semantic.diagnostics.some(item => item.code === 2339), "missing property must be located")
assert(semantic.diagnostics.every(item => item.file === "input.ts" && item.start >= 0), "semantic spans must be owned by source")

const duplicateSource = [
  "type User = { id: number };",
  "const user: User = { id: 7 };",
  "const user: User = { id: 8 };"
].join("\n")
const duplicate = run(duplicateSource)
assert(duplicate.diagnostics.length === 1 && duplicate.diagnostics[0].stage === "bind", "duplicate declarations fail during bind")
assert(duplicate.completed.includes("check-skipped"), "unsafe symbol table must skip check")

const syntax = run([
  "type User = { id: number }",
  "const user: User = { id: 7 };"
].join("\n"))
assert(syntax.diagnostics.length === 1 && syntax.diagnostics[0].stage === "parse", "syntax failure must stop before semantic checking")
assert(syntax.completed.includes("bind-skipped") && syntax.completed.includes("check-skipped"), "skipped phases must be visible")

const detached = report([
  diagnostic("options", 6046, undefined, undefined, undefined, "选项无效")
], "", ["parse", "bind", "check"])
assert(detached.text[0] === "<config> 6046 选项无效", "detached diagnostics must be safe to format")

console.log(semantic.text.join("\n"))
console.log("typescript-12-06: PASS")
