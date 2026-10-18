import { get, set, del, keys } from 'idb-keyval';

/** Durable queue for recording chunks so uploads survive a refresh or a dropped connection. */
const K = (code, i) => `upload:${code}:${i}`;
export const uploadsStore = {
  put: (code, index, blob, meta) => set(K(code, index), { code, index, blob, meta, at: Date.now() }).catch(() => {}),
  remove: (code, index) => del(K(code, index)).catch(() => {}),
  async pending(code) {
    try {
      const all = await keys();
      const mine = all.filter((k) => String(k).startsWith(code ? `upload:${code}:` : 'upload:'));
      return (await Promise.all(mine.map((k) => get(k)))).filter(Boolean);
    } catch { return []; }
  },
};
