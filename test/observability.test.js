import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import {
  logEvent,
  observabilitySummary,
  recordMetric,
  resetObservabilityForTests,
  setLogSinkForTests
} from "../src/observability.js";

test("observability records counters and emits structured JSON logs", () => {
  const previousLevel = config.logLevel;
  const lines = [];

  config.logLevel = "info";
  resetObservabilityForTests();
  setLogSinkForTests((line) => lines.push(line));

  recordMetric("executionsStarted");
  recordMetric("executionsSucceeded");
  logEvent("info", "execution.succeeded", {
    requestId: "req_test",
    jobId: "job_test"
  });

  const event = JSON.parse(lines[0]);
  assert.equal(event.service, "Action402");
  assert.equal(event.event, "execution.succeeded");
  assert.equal(event.requestId, "req_test");
  assert.equal(event.jobId, "job_test");
  assert.equal(observabilitySummary().metrics.executionsStarted, 1);
  assert.equal(observabilitySummary().metrics.executionsSucceeded, 1);

  setLogSinkForTests();
  config.logLevel = previousLevel;
});

test("observability respects log level filtering", () => {
  const previousLevel = config.logLevel;
  const lines = [];

  config.logLevel = "error";
  setLogSinkForTests((line) => lines.push(line));

  logEvent("info", "hidden.event");
  logEvent("error", "visible.event");

  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).event, "visible.event");

  setLogSinkForTests();
  config.logLevel = previousLevel;
});
