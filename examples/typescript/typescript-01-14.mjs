import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const root = mkdtempSync(join(tmpdir(), "typescript-01-14-"))
const packageDir = join(root, "node_modules", "dual-pkg")
mkdirSync(packageDir, { recursive: true })

try {
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({
    name: "dual-pkg",
    type: "module",
    exports: { ".": { import: "./index.mjs", require: "./index.cjs" } }
  }))
  writeFileSync(join(packageDir, "index.mjs"),
    "export const mode = 'esm'; export const marker = 11;\n")
  writeFileSync(join(packageDir, "index.cjs"),
    "module.exports = { mode: 'cjs', marker: 22 };\n")
  writeFileSync(join(root, "esm-consumer.mjs"),
    "import { mode, marker } from 'dual-pkg';\n" +
    "if (mode !== 'esm' || marker !== 11) process.exit(2);\n")
  writeFileSync(join(root, "cjs-consumer.cjs"),
    "const pkg = require('dual-pkg');\n" +
    "if (pkg.mode !== 'cjs' || pkg.marker !== 22) process.exit(3);\n")
  writeFileSync(join(root, "async.mjs"),
    "await new Promise(() => {}); export const ready = true;\n")
  writeFileSync(join(root, "require-async.cjs"),
    "require('./async.mjs');\n")

  const esm = spawnSync(process.execPath, ["esm-consumer.mjs"], {
    cwd: root, encoding: "utf8"
  })
  assert.equal(esm.status, 0)

  const cjs = spawnSync(process.execPath, ["cjs-consumer.cjs"], {
    cwd: root, encoding: "utf8"
  })
  assert.equal(cjs.status, 0)

  const asyncFailure = spawnSync(process.execPath, ["require-async.cjs"], {
    cwd: root, encoding: "utf8"
  })
  assert.notEqual(asyncFailure.status, 0)
  assert.match(
    asyncFailure.stderr + asyncFailure.stdout,
    /ERR_REQUIRE_ASYNC_MODULE|ERR_REQUIRE_ESM/
  )

  console.log("conditional exports, CJS/ESM bridges, and async failure passed")
} finally {
  rmSync(root, { recursive: true, force: true })
}
