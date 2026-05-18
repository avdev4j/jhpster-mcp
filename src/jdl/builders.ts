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
