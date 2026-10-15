#!/usr/bin/env node
/**
 * Keep prisma/schema.prisma's datasource provider in sync with DATABASE_URL.
 *
 * - DATABASE_URL is a postgres:// or postgresql:// URL  -> provider "postgresql"
 * - DATABASE_URL is a file: URL (or unset)              -> provider "sqlite"
 *
 * Why: Prisma requires the `provider` to be a literal in the schema, but this
 * app runs on SQLite locally (no server to reach) and on hosted Postgres in the
 * deployed/serverless environment (Vercel cannot open a SQLite file). Running
 * this before `prisma generate` / `prisma build` lets one schema serve both.
 *
 * Wired into the `postinstall` and `build` scripts in package.json.
 */
const fs = require('fs')
const path = require('path')

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')

const url = process.env.DATABASE_URL || ''
const wantPostgres = /^(postgres|postgresql):\/\//.test(url.trim())
const provider = wantPostgres ? 'postgresql' : 'sqlite'

const schema = fs.readFileSync(schemaPath, 'utf8')
const updated = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql)"/,
  `provider = "${provider}"`,
)

if (updated !== schema) {
  fs.writeFileSync(schemaPath, updated)
  console.log(`[prisma] datasource provider -> ${provider} (from DATABASE_URL)`)
} else {
  console.log(`[prisma] datasource provider already "${provider}"`)
}
