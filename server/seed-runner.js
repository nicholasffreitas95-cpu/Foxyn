// CLI: node server/seed-runner.js [--force]
import { runSeed } from "./seed.js";
const force = process.argv.includes("--force");
runSeed(force);
