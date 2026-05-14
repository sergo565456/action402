import test from "node:test";
import assert from "node:assert/strict";
import { assertTargetPolicy, domainMatches } from "../src/targetPolicy.js";

test("domainMatches supports exact and wildcard hostnames", () => {
  assert.equal(domainMatches("example.com", "example.com"), true);
  assert.equal(domainMatches("example.com", "api.example.com"), false);
  assert.equal(domainMatches("*.example.com", "api.example.com"), true);
  assert.equal(domainMatches("*.example.com", "deep.api.example.com"), true);
  assert.equal(domainMatches("*.example.com", "example.com"), false);
});

test("target policy blocks configured hostnames", () => {
  assert.throws(
    () =>
      assertTargetPolicy("blocked.example.com", {
        targetAllowlist: [],
        targetBlocklist: ["blocked.example.com"],
        requireTargetAllowlist: false
      }),
    /target hostname is blocked/
  );
});

test("target policy can require allowlist membership", () => {
  assert.doesNotThrow(() =>
    assertTargetPolicy("api.example.com", {
      targetAllowlist: ["*.example.com"],
      targetBlocklist: [],
      requireTargetAllowlist: true
    })
  );

  assert.throws(
    () =>
      assertTargetPolicy("other.test", {
        targetAllowlist: ["*.example.com"],
        targetBlocklist: [],
        requireTargetAllowlist: true
      }),
    /not in TARGET_ALLOWLIST/
  );
});
