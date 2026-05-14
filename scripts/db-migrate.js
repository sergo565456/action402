import { assertProductionConfig } from "../src/config.js";
import { closeStore, initStore, storeStats } from "../src/store.js";

assertProductionConfig();
await initStore();

const stats = await storeStats();
console.log(
  JSON.stringify(
    {
      ok: true,
      store: stats
    },
    null,
    2
  )
);

await closeStore();
