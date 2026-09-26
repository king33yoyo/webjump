/**
 * chrome.storage.local 数据层。
 *
 * 存储结构:
 *   sites   : 站点数组（种子 + 用户自定义），每条:
 *              { id, title, href, slogan, kind, categories[],
 *                fav, blocked, visitCount, lastVisited, custom?, addedAt? }
 *   settings : { surpriseScope, openInNewTab, noRepeat }
 *   history  : [{ id, title, href, at }]  最近 100 条
 *   bag      : [站点id]  洗牌袋剩余
 *   lastScope: 上次 Surprise 的范围（变了就重洗）
 */

export const DEFAULT_SETTINGS = {
  surpriseScope: "all",
  openInNewTab: true,
  noRepeat: true,
};

const KEYS = ["sites", "settings", "history", "bag", "lastScope"];

let initPromise = null;

/** 幂等初始化：首次安装时把打包的种子数据灌入 storage。 */
export function ensureInit() {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit() {
  const cur = await chrome.storage.local.get(KEYS);
  if (Array.isArray(cur.sites) && cur.sites.length > 0) return;
  const res = await fetch(chrome.runtime.getURL("data/sites.json"));
  const seed = await res.json();
  const sites = seed.sites.map((s) => ({
    ...s,
    fav: false,
    blocked: false,
    visitCount: 0,
    lastVisited: 0,
  }));
  await chrome.storage.local.set({
    sites,
    settings: { ...DEFAULT_SETTINGS },
    history: [],
    bag: [],
    lastScope: "",
  });
}

export async function getState() {
  await ensureInit();
  const cur = await chrome.storage.local.get(KEYS);
  return {
    sites: cur.sites || [],
    settings: { ...DEFAULT_SETTINGS, ...(cur.settings || {}) },
    history: cur.history || [],
    bag: cur.bag || [],
    lastScope: cur.lastScope || "",
  };
}

export async function patchState(patch) {
  await chrome.storage.local.set(patch);
}

export async function getSettings() {
  const { settings } = await getState();
  return settings;
}

export async function saveSettings(patch) {
  const settings = await getSettings();
  const next = { ...settings, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

/** 更新单个站点属性并写回。 */
export async function updateSite(id, patch) {
  const { sites } = await getState();
  const idx = sites.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  sites[idx] = { ...sites[idx], ...patch };
  await chrome.storage.local.set({ sites });
  return sites[idx];
}

/** 新增自定义站点。 */
export async function addCustomSite({ title, href, slogan, categories, kind }) {
  const { sites } = await getState();
  const site = {
    id: `custom-${Date.now()}`,
    title,
    href,
    slogan: slogan || "",
    kind: kind || "custom",
    categories: categories && categories.length ? categories : ["未分类"],
    fav: false,
    blocked: false,
    visitCount: 0,
    lastVisited: 0,
    custom: true,
    addedAt: Date.now(),
  };
  sites.push(site);
  await chrome.storage.local.set({ sites, bag: [] });
  return site;
}

export async function removeSite(id) {
  const { sites } = await getState();
  const next = sites.filter((s) => s.id !== id);
  await chrome.storage.local.set({ sites: next, bag: [] });
}

/** 删除单条访问记录（按时间戳，at 唯一标识一条记录），只动历史不动站点。 */
export async function removeHistoryAt(at) {
  const { history } = await getState();
  await chrome.storage.local.set({ history: history.filter((h) => h.at !== at) });
}

/** 删除网站本身，并级联清掉历史里所有指向它的记录（用于「是，删除原网页」）。 */
export async function removeSiteAndHistory(id) {
  const { sites, history } = await getState();
  await chrome.storage.local.set({
    sites: sites.filter((s) => s.id !== id),
    history: history.filter((h) => h.id !== id),
    bag: [],
  });
}

/** 恢复默认种子数据（保留设置），清空收藏/屏蔽/历史/自定义。 */
export async function resetSites() {
  await chrome.storage.local.remove(["sites", "history", "bag", "lastScope"]);
  initPromise = null;
  await ensureInit();
}

/** 记录一次访问：站点计数 + 历史（封顶 100）。 */
export async function recordVisit(site) {
  const { sites, history } = await getState();
  const idx = sites.findIndex((s) => s.id === site.id);
  if (idx !== -1) {
    sites[idx].visitCount = (sites[idx].visitCount || 0) + 1;
    sites[idx].lastVisited = Date.now();
  }
  const entry = { id: site.id, title: site.title, href: site.href, at: Date.now() };
  const nextHistory = [entry, ...(history || [])].slice(0, 100);
  await chrome.storage.local.set({ sites, history: nextHistory });
}
