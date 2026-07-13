import { z } from "zod";

/**
 * Matches the worker manifest structure defined in skill.md.
 * `input`/`output` are JSON Schema documents (validated structurally, not
 * against a fixed shape) since each worker defines its own fields.
 */

const jsonSchemaDocument = z.record(z.string(), z.unknown());

const pricingSchema = z.object({
  model: z.enum(["per_call", "per_unit", "subscription"]).default("per_call"),
  amount_cents: z.number().int().positive(),
  currency: z.string().default("usd"),
  unit: z.string().optional(), // e.g. "page", "1k_tokens" for per_unit pricing
});

// Platform-wide ceiling on free trial runs — developers can offer fewer,
// never more, regardless of what a manifest requests.
export const PLATFORM_MAX_FREE_RUNS = 10;

const trialSchema = z.object({
  free_runs: z.number().int().min(0).max(PLATFORM_MAX_FREE_RUNS).default(0),
});

const privacySchema = z.object({
  logs_input: z.boolean().default(false),
  logs_output: z.boolean().default(false),
  retains_data: z.boolean().default(false),
  data_retention_days: z.number().int().min(0).optional(),
  third_party_sharing: z.boolean().default(false),
});

const endpointSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT"]).default("POST"),
  timeout_seconds: z.number().int().positive().max(300).default(60),
});

const verificationSchema = z.object({
  documentation_score: z.number().min(0).max(100).optional(),
  security_score: z.number().min(0).max(100).optional(),
  benchmark_score: z.number().min(0).max(100).optional(),
  trust_score: z.number().min(0).max(100).optional(),
});

export const outcomePolicyEnum = z.enum(["FRIENDLY", "STANDARD", "STRICT"]);

export const workerManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver, e.g. 1.0.0"),
  category: z.string().min(1),
  description: z.string().min(1),

  endpoint: endpointSchema,

  input: jsonSchemaDocument,
  output: jsonSchemaDocument,

  pricing: pricingSchema,
  trial: trialSchema.default({ free_runs: 0 }),
  privacy: privacySchema,

  capabilities: z.array(z.string()).default([]),
  outcome_policy: outcomePolicyEnum.default("STANDARD"),

  verification: verificationSchema.optional(),
});

export type WorkerManifest = z.infer<typeof workerManifestSchema>;

export function validateManifest(raw: unknown) {
  return workerManifestSchema.safeParse(raw);
}
