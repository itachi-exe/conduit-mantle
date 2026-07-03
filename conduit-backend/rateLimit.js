// In-memory per-wallet daily chat message counter. Single-process only, // same documented tradeoff as lib/cache.js: fine for a `next dev`/`next
// start` demo, not shared across serverless instances or restarts.

const DAILY_LIMIT = 10;
const store = new Map();

// Separate, smaller daily allowance for web_search specifically, the
// expensive tool. Most of the 10 daily messages never need it; this caps
// how many of them are allowed to, independent of the message count.
const DAILY_SEARCH_LIMIT = 2;
const searchStore = new Map();

function todayKey(wallet) {
  return `${wallet.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`;
}

export function checkWalletLimit(wallet) {
  const count = store.get(todayKey(wallet)) ?? 0;
  return { allowed: count < DAILY_LIMIT, remaining: Math.max(DAILY_LIMIT - count, 0) };
}

// Call only after checkWalletLimit has allowed the request. Returns the
// remaining count after this message is counted.
export function recordWalletMessage(wallet) {
  const key = todayKey(wallet);
  const count = (store.get(key) ?? 0) + 1;
  store.set(key, count);
  return Math.max(DAILY_LIMIT - count, 0);
}

export function checkWalletSearchLimit(wallet) {
  const count = searchStore.get(todayKey(wallet)) ?? 0;
  return { allowed: count < DAILY_SEARCH_LIMIT, remaining: Math.max(DAILY_SEARCH_LIMIT - count, 0) };
}

// Call only when the model actually performed a web_search this turn, not
// merely when it was allowed to. A message that never needed search must
// not touch this counter.
export function recordWalletSearch(wallet) {
  const key = todayKey(wallet);
  const count = (searchStore.get(key) ?? 0) + 1;
  searchStore.set(key, count);
  return Math.max(DAILY_SEARCH_LIMIT - count, 0);
}

export const DAILY_MESSAGE_LIMIT = DAILY_LIMIT;
export const DAILY_SEARCH_MESSAGE_LIMIT = DAILY_SEARCH_LIMIT;
