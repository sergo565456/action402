import { config } from "./config.js";
import { createJsonStore } from "./stores/jsonStore.js";
import { createPostgresStore } from "./stores/postgresStore.js";

let store = null;
let initialized = false;

function createConfiguredStore() {
  if (config.storeDriver === "postgres") {
    return createPostgresStore(config);
  }
  return createJsonStore(config);
}

export async function initStore() {
  if (!store) {
    store = createConfiguredStore();
  }
  if (initialized) return store;
  await store.init();
  initialized = true;
  return store;
}

async function activeStore() {
  return initStore();
}

export async function pruneExpired(now = Date.now(), options = {}) {
  return (await activeStore()).pruneExpired(now, options);
}

export async function createJob(job) {
  return (await activeStore()).createJob(job);
}

export async function updateJob(id, patch) {
  return (await activeStore()).updateJob(id, patch);
}

export async function getJob(id) {
  return (await activeStore()).getJob(id);
}

export async function getJobByIdempotencyKey(key) {
  return (await activeStore()).getJobByIdempotencyKey(key);
}

export async function saveReceipt(receipt) {
  return (await activeStore()).saveReceipt(receipt);
}

export async function getReceipt(id) {
  return (await activeStore()).getReceipt(id);
}

export async function resetStoreForTests() {
  return (await activeStore()).resetForTests();
}

export async function storeStats() {
  return (await activeStore()).stats();
}

export async function closeStore() {
  if (store && initialized) {
    await store.close();
  }
  initialized = false;
  store = null;
}
