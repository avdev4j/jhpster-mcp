/**
 * Pure helpers for the upgrade advisor (Tier 5 #13). This module gathers and
 * scores *facts* about an upgrade — it intentionally holds no database of
 * version-specific breaking changes. Enumerating those for a given version
 * range is the agent's job (from release notes / its own knowledge); the tool
 * just frames the gap and the project's risk factors.
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export type Bump = "none" | "patch" | "minor" | "major" | "downgrade" | "unknown";

export function parseVersion(v: string | undefined | null): SemVer | null {
  if (!v) return null;
  const m = /^\s*v?(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Classify the move from `current` to `target`. */
export function classifyBump(current: SemVer | null, target: SemVer | null): Bump {
  if (!current || !target) return "unknown";
  const cmp =
    current.major !== target.major
      ? target.major - current.major
      : current.minor !== target.minor
        ? target.minor - current.minor
        : target.patch - current.patch;
  if (cmp < 0) return "downgrade";
  if (current.major !== target.major) return "major";
  if (current.minor !== target.minor) return "minor";
  if (current.patch !== target.patch) return "patch";
  return "none";
}

export interface UpgradeFacts {
  bump: Bump;
  blueprints: string[];
  applicationType: string;
  entityCount: number;
}

export type RiskLevel = "low" | "medium" | "high";

export interface UpgradeAssessment {
  riskLevel: RiskLevel;
  considerations: string[];
  steps: string[];
  references: string[];
}

const REFERENCES = [
  "Upgrading an application: https://www.jhipster.tech/upgrading-an-application/",
  "Release notes / breaking changes: https://github.com/jhipster/generator-jhipster/releases",
];

/** Score risk and produce project-specific considerations + a generic, honest upgrade checklist. */
export function assessUpgrade(facts: UpgradeFacts): UpgradeAssessment {
  let score = 0;
  switch (facts.bump) {
    case "major":
    case "downgrade":
      score += 2;
      break;
    case "minor":
    case "unknown":
      score += 1;
      break;
    default:
      break; // patch / none
  }

  const considerations: string[] = [];
  if (facts.blueprints.length > 0) {
    score += 1;
    considerations.push(
      `Uses blueprint(s): ${facts.blueprints.join(", ")} — confirm each supports the target version before upgrading (blueprints often lag generator releases).`,
    );
  }
  if (facts.applicationType === "gateway" || facts.applicationType === "microservice") {
    score += 1;
    considerations.push(
      "Microservices architecture — upgrade the gateway and every service, keeping their generator versions aligned.",
    );
  }
  if (facts.entityCount > 20) {
    score += 1;
    considerations.push(`${facts.entityCount} entities — regeneration will touch many files; expect a large diff to review.`);
  }
  if (facts.bump === "downgrade") {
    considerations.push("Target is older than the current version — downgrades are not supported by JHipster; proceed with caution.");
  }
  if (facts.bump === "unknown") {
    considerations.push("Could not compare versions — provide a targetVersion and ensure .yo-rc.json records jhipsterVersion.");
  }

  const riskLevel: RiskLevel = score >= 3 ? "high" : score === 2 ? "medium" : "low";

  const steps = [
    "Start from a clean git tree (commit or stash) — the official upgrade and any regeneration produce a diff you'll need to review.",
    "Read the release notes for every release between the current and target version, and list the breaking changes that apply to this app.",
    "Install the target generator (e.g. set JHIPSTER_MCP_GENERATOR_VERSION, or `npm i -g generator-jhipster@<target>`).",
    "Apply the upgrade — either `jhipster upgrade` (git-based merge) or regenerate from the project's JDL and diff the result.",
    "Resolve conflicts, then rebuild and run the tests (see the `project_commands` tool for the exact commands).",
  ];
  if (facts.blueprints.length > 0) {
    steps.push("Re-verify blueprint compatibility and bump blueprint versions to match the target generator.");
  }

  return { riskLevel, considerations, steps, references: REFERENCES };
}
