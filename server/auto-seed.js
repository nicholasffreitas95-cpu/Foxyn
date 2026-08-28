// Auto-seed no boot (guarded: só popula se o banco estiver vazio)
import { runSeed } from "./seed.js";

let ran = false;
export function seedIfEmpty() {
  if (ran) return;
  ran = true;
  runSeed(false);
}
