import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface EntityField {
  name: string;
  type: string;
  validations?: string[];
}

export interface EntityDef {
  name: string;
  fields?: EntityField[];
  options?: Record<string, string | number | boolean>;
}

const ENTITY_NAME = /^[A-Z][A-Za-z0-9]*$/;
const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/;
const TYPE_NAME = /^[A-Za-z][A-Za-z0-9]*$/;

function assertEntityName(name: string): void {
  if (!ENTITY_NAME.test(name)) {
    throw new Error(
      `Invalid entity name "${name}": must start with uppercase and contain only [A-Za-z0-9]`,
    );
  }
}

function assertFieldName(name: string): void {
  if (!FIELD_NAME.test(name)) {
    throw new Error(
      `Invalid field name "${name}": must start with lowercase and contain only [A-Za-z0-9]`,
    );
  }
}

function assertTypeName(name: string): void {
  if (!TYPE_NAME.test(name)) {
    throw new Error(`Invalid type "${name}": must match /^[A-Za-z][A-Za-z0-9]*$/`);
  }
}

export function buildEntityJdl(entity: EntityDef): string {
  assertEntityName(entity.name);
  const lines: string[] = [`entity ${entity.name} {`];
  for (const f of entity.fields ?? []) {
    assertFieldName(f.name);
    assertTypeName(f.type);
    const validations = (f.validations ?? []).join(" ");
    lines.push(`  ${f.name} ${f.type}${validations ? ` ${validations}` : ""}`);
  }
  lines.push("}");
  if (entity.options) {
    for (const [key, value] of Object.entries(entity.options)) {
      lines.push(`${key} ${entity.name} with ${String(value)}`);
    }
  }
  return lines.join("\n");
}

export type RelationshipKind =
  | "OneToOne"
  | "OneToMany"
  | "ManyToOne"
  | "ManyToMany";

export interface RelationshipDef {
  kind: RelationshipKind;
  from: { entity: string; field: string; required?: boolean };
  to: { entity: string; field?: string; required?: boolean };
}

export function buildRelationshipJdl(rel: RelationshipDef): string {
  assertEntityName(rel.from.entity);
  assertEntityName(rel.to.entity);
  assertFieldName(rel.from.field);
  if (rel.to.field) assertFieldName(rel.to.field);
  const left = `${rel.from.entity}{${rel.from.field}${rel.from.required ? " required" : ""}}`;
  const right = rel.to.field
    ? `${rel.to.entity}{${rel.to.field}${rel.to.required ? " required" : ""}}`
    : rel.to.entity;
  return `relationship ${rel.kind} {\n  ${left} to ${right}\n}`;
}

export interface ApplicationConfig {
  baseName: string;
  applicationType?: "monolith" | "gateway" | "microservice";
  authenticationType?: "jwt" | "oauth2" | "session";
  databaseType?: "sql" | "mongodb" | "cassandra" | "couchbase" | "neo4j" | "no";
  prodDatabaseType?: string;
  devDatabaseType?: string;
  clientFramework?: "angular" | "react" | "vue" | "no";
  buildTool?: "maven" | "gradle";
  packageName?: string;
  serverPort?: number;
  serviceDiscoveryType?: "eureka" | "consul" | "no";
  [k: string]: string | number | boolean | undefined;
}

const BASE_NAME = /^[A-Za-z][A-Za-z0-9]*$/;
const PACKAGE = /^[a-z]+(\.[a-z][a-z0-9]*)*$/;

export function buildApplicationJdl(cfg: ApplicationConfig): string {
  if (!BASE_NAME.test(cfg.baseName)) {
    throw new Error(`Invalid baseName "${cfg.baseName}"`);
  }
  if (cfg.packageName && !PACKAGE.test(cfg.packageName)) {
    throw new Error(`Invalid packageName "${cfg.packageName}"`);
  }
  const lines: string[] = ["application {", "  config {"];
  for (const [key, value] of Object.entries(cfg)) {
    if (value === undefined) continue;
    const rendered =
      typeof value === "string" && !/^[A-Za-z0-9_.-]+$/.test(value)
        ? JSON.stringify(value)
        : String(value);
    lines.push(`    ${key} ${rendered}`);
  }
  lines.push("  }", "}");
  return lines.join("\n");
}

export interface OptionEntry {
  option: string;
  value?: string | number | boolean;
  entities?: string[];
  except?: string[];
}

const OPTION_KEY = /^[a-zA-Z][a-zA-Z0-9]*$/;

export function buildOptionJdl(opt: OptionEntry): string {
  if (!OPTION_KEY.test(opt.option)) {
    throw new Error(`Invalid option key "${opt.option}"`);
  }
  const target =
    !opt.entities || opt.entities.length === 0 || opt.entities.includes("*")
      ? "*"
      : opt.entities.map((e) => {
          assertEntityName(e);
          return e;
        }).join(", ");
  const except =
    opt.except && opt.except.length > 0
      ? ` except ${opt.except.map((e) => {
          assertEntityName(e);
          return e;
        }).join(", ")}`
      : "";
  if (opt.value === undefined) {
    return `${opt.option} ${target}${except}`;
  }
  return `${opt.option} ${target} with ${String(opt.value)}${except}`;
}

/**
 * Cheap, dependency-free structural lint of raw JDL. Catches the obvious
 * mistakes (empty input, unbalanced braces) instantly and without spawning
 * `jhipster` — useful both as a fast-fail and when the CLI is unavailable.
 * Curly braces are structural in JDL and never appear inside values, so this
 * check is free of false positives. Deeper semantic validation is delegated to
 * the generator via a dry run.
 */
export function quickLintJdl(jdl: string): string[] {
  const issues: string[] = [];
  if (jdl.trim().length === 0) {
    issues.push("JDL is empty.");
    return issues;
  }
  let depth = 0;
  for (const ch of jdl) {
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth < 0) {
        issues.push("Unbalanced braces: a '}' appears with no matching '{'.");
        return issues;
      }
    }
  }
  if (depth > 0) {
    issues.push(`Unbalanced braces: ${depth} '{' left unclosed.`);
  }
  return issues;
}

/**
 * Application-config decisions this server can elicit when a JDL `application`
 * block leaves them unspecified (JHipster would otherwise silently default them).
 * The option lists are the single source of truth shared by the elicitation
 * schema and the answer→JDL mapping below.
 */
export type ElicitableConfigKey = "database" | "authentication" | "clientFramework";

export const DATABASE_OPTIONS = [
  "postgresql",
  "mysql",
  "mariadb",
  "mssql",
  "oracle",
  "mongodb",
  "cassandra",
  "neo4j",
  "none",
] as const;
export const AUTH_OPTIONS = ["jwt", "oauth2", "session"] as const;
export const CLIENT_OPTIONS = ["angular", "react", "vue", "none"] as const;

const SQL_PROD = new Set(["postgresql", "mysql", "mariadb", "mssql", "oracle"]);
const APP_BLOCK = /\bapplication\s*\{/g;

export interface AppConfigAnalysis {
  /** How many `application { ... }` blocks the JDL declares. */
  appBlockCount: number;
  /** Whether there's a `config { ... }` block to inject into. */
  hasConfigBlock: boolean;
  /** Which elicitable keys are absent from the JDL. */
  missing: ElicitableConfigKey[];
}

/** Detect, without a full parse, how many app blocks exist and which key config decisions are unspecified. */
export function analyzeAppConfig(jdl: string): AppConfigAnalysis {
  const appBlockCount = (jdl.match(APP_BLOCK) ?? []).length;
  const hasConfigBlock = /\bconfig\s*\{/.test(jdl);
  const missing: ElicitableConfigKey[] = [];
  if (!/\bdatabaseType\b/.test(jdl)) missing.push("database");
  if (!/\bauthenticationType\b/.test(jdl)) missing.push("authentication");
  if (!/\bclientFramework\b/.test(jdl)) missing.push("clientFramework");
  return { appBlockCount, hasConfigBlock, missing };
}

/** Map elicited answers to JDL config lines. Unknown/blank values are ignored (defensive against a misbehaving client). */
export function configLinesFromAnswers(
  answers: Partial<Record<ElicitableConfigKey, string>>,
): string[] {
  const lines: string[] = [];
  const db = answers.database;
  if (db && (DATABASE_OPTIONS as readonly string[]).includes(db)) {
    if (SQL_PROD.has(db)) {
      lines.push("databaseType sql", `prodDatabaseType ${db}`, "devDatabaseType h2Disk");
    } else if (db === "none") {
      lines.push("databaseType no");
    } else {
      lines.push(`databaseType ${db}`);
    }
  }
  const auth = answers.authentication;
  if (auth && (AUTH_OPTIONS as readonly string[]).includes(auth)) {
    lines.push(`authenticationType ${auth}`);
  }
  const client = answers.clientFramework;
  if (client && (CLIENT_OPTIONS as readonly string[]).includes(client)) {
    lines.push(`clientFramework ${client === "none" ? "no" : client}`);
  }
  return lines;
}

/** Insert config lines just inside the first `config {` block of the JDL. Returns the JDL unchanged if there's no such block or no lines. */
export function injectConfigLines(jdl: string, lines: string[]): string {
  if (lines.length === 0) return jdl;
  const m = /\bconfig\s*\{/.exec(jdl);
  if (!m) return jdl;
  const insertAt = m.index + m[0].length;
  const inserted = lines.map((l) => `\n    ${l}`).join("");
  return jdl.slice(0, insertAt) + inserted + jdl.slice(insertAt);
}

// npm-package-name shape: optional @scope/, then name. Each segment must start
// with an alphanumeric (so a value can't begin with '-' and pose as a CLI flag).
const BLUEPRINT_NAME = /^(@[a-z0-9~][a-z0-9-._~]*\/)?[a-z0-9~][a-z0-9-._~]*$/;

/**
 * Build the `--blueprints a,b` argument pair for the generator, validating each
 * name (so a blueprint name can't smuggle in extra flags or shell metacharacters).
 * Returns `[]` when no blueprints are requested.
 */
export function buildBlueprintsArgs(names: string[] | undefined): string[] {
  const list = (names ?? []).map((n) => n.trim()).filter((n) => n.length > 0);
  if (list.length === 0) return [];
  for (const name of list) {
    if (!BLUEPRINT_NAME.test(name)) {
      throw new Error(
        `Invalid blueprint name "${name}": expected an npm package name like "kotlin" or "@scope/generator-jhipster-foo".`,
      );
    }
  }
  return ["--blueprints", list.join(",")];
}

export async function withTempJdlFile<T>(
  content: string,
  fn: (filePath: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "jhipster-mcp-"));
  const file = path.join(dir, "snippet.jdl");
  await writeFile(file, content, "utf8");
  try {
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
