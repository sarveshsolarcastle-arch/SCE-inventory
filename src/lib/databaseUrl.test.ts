import test from "node:test";
import assert from "node:assert/strict";
import { resolveDatabaseUrl, DEV_DATABASE_URL } from "./databaseUrl.ts";

test("an explicit URL is used as given", () => {
  assert.equal(
    resolveDatabaseUrl({ DATABASE_URL: "postgresql://host/db", NODE_ENV: "production" }),
    "postgresql://host/db"
  );
});

test("development falls back to the local file", () => {
  assert.equal(resolveDatabaseUrl({ NODE_ENV: "development" }), DEV_DATABASE_URL);
});

test("no NODE_ENV at all is treated as development", () => {
  assert.equal(resolveDatabaseUrl({}), DEV_DATABASE_URL);
});

test("production without a URL refuses to start", () => {
  assert.throws(
    () => resolveDatabaseUrl({ NODE_ENV: "production" }),
    /DATABASE_URL is not set/
  );
});

test("production with a blank URL refuses too — the empty string is not a setting", () => {
  assert.throws(
    () => resolveDatabaseUrl({ DATABASE_URL: "   ", NODE_ENV: "production" }),
    /DATABASE_URL is not set/
  );
});

test("surrounding whitespace is trimmed off a real URL", () => {
  assert.equal(
    resolveDatabaseUrl({ DATABASE_URL: "  postgresql://host/db  " }),
    "postgresql://host/db"
  );
});

test("the production error names the consequence, not just the missing variable", () => {
  // The whole point of this module is that the failure is otherwise invisible,
  // so the message has to say what silently goes wrong, not merely "unset".
  assert.throws(() => resolveDatabaseUrl({ NODE_ENV: "production" }), /losing every write/);
});
