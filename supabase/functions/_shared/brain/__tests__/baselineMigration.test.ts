// Phase 4: migration safety guard — the baseline RPC must return AGGREGATES
// ONLY and must not read raw per-user rows. This is a static check of the SQL.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const sql = await Deno.readTextFile(
  new URL(
    "../../../../../db/migrations/023_symptom_trend_baseline_rpc_v2.sql",
    import.meta.url,
  ),
);

// Strip line comments so assertions about actual SQL code ignore the safety
// documentation (which intentionally mentions user_id to explain its absence).
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

Deno.test("baseline RPC: reads anonymous community_weekly_trends, not health_checkins", () => {
  assert(
    sql.includes("community_weekly_trends"),
    "must read community aggregates",
  );
  assert(
    !/from\s+public\.health_checkins/i.test(code),
    "must NOT read raw health_checkins",
  );
  assert(
    !/from\s+health_checkins/i.test(code),
    "must NOT read raw health_checkins",
  );
});

Deno.test("baseline RPC: does not expose user identifiers", () => {
  assert(!/\buser_id\b/i.test(code), "must not reference user_id in SQL code");
});

Deno.test("baseline RPC: not granted to anon", () => {
  assert(
    /revoke all on function[\s\S]*from anon/i.test(sql),
    "must revoke from anon",
  );
  assert(
    /grant execute on function[\s\S]*to service_role/i.test(sql),
    "must grant to service_role",
  );
});

Deno.test("baseline RPC: returns the documented aggregate columns", () => {
  for (
    const col of [
      "state",
      "symptom_group",
      "current_week_count",
      "previous_4_week_average",
      "percentage_change",
      "classification",
      "confidence",
    ]
  ) {
    assert(sql.includes(col), `missing output column ${col}`);
  }
});

Deno.test("baseline RPC: has sample-size protection and trend thresholds", () => {
  assert(
    /current_sample_size\s*<\s*5/i.test(sql),
    "must guard tiny current samples",
  );
  assert(
    /baseline_weeks\s*<\s*2/i.test(sql),
    "must require at least two baseline weeks",
  );
  assert(
    /baseline_sample_total\s*<\s*10/i.test(sql),
    "must guard tiny baseline samples",
  );
  assert(/avg4w\s*\*\s*2\.0/i.test(sql), "must define elevated threshold");
  assert(/avg4w\s*\*\s*1\.5/i.test(sql), "must define rising threshold");
});
