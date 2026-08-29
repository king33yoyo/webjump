/**
 * Surprise 跳转编排：抽取 → 记录 → 打开。供 background / popup / manage 共用。
 */
import { getState, patchState, getSettings, recordVisit } from "./store.js";
import { eligibleSites, pickFromList, parseScope } from "./surprise.js";

/** 抽取一个站点（维护洗牌袋），不打开。 */
export async function pickSurprise() {
  const { sites, settings, bag, lastScope } = await getState();
  const scope = settings.surpriseScope || "all";
  const eligible = eligibleSites(sites, scope);

  let nextBag = bag;
  if (settings.noRepeat) {
    // 范围变了 → 整袋重洗
    nextBag = lastScope === scope ? bag : [];
  }
  const { site, bag: newBag } = pickFromList(nextBag, eligible, settings.noRepeat !== false);
  if (!site) return null;

  await patchState({ bag: newBag, lastScope: scope });
  return site;
}

/** 抽取并打开（记入历史），返回抽中的站点；候选池为空返回 null。 */
export async function surpriseJump() {
  const site = await pickSurprise();
  if (!site) return null;
  await recordVisit(site);
  await openSite(site);
  return site;
}

/** 打开站点：新标签页（默认）或当前标签页。 */
export async function openSite(site) {
  const settings = await getSettings();
  if (settings.openInNewTab === false) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      await chrome.tabs.update(tab.id, { url: site.href });
      return;
    }
  }
  await chrome.tabs.create({ url: site.href });
}

/** 构建 popup / 管理页范围下拉框的数据。 */
export function buildScopeOptions(sites) {
  const catCount = new Map();
  const kinds = new Set();
  for (const s of sites) {
    if (s.blocked) continue;
    kinds.add(s.kind);
    for (const c of s.categories || []) catCount.set(c, (catCount.get(c) || 0) + 1);
  }
  const categories = [...catCount.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const kindList = [...kinds]
    .filter((k) => /^web_\d+$/.test(k))
    .sort((a, b) => Number(b.slice(4)) - Number(a.slice(4)));
  return { categories, kindList };
}

export { parseScope };
