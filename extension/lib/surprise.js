/**
 * Surprise 纯逻辑（不依赖 chrome API，可在 Node 里单测）。
 */

/** 把范围字符串解析成谓词。范围: "all" | "fav" | "cat:分类名" | "kind:web_N" */
export function parseScope(scope) {
  const s = scope || "all";
  if (s === "all") return { type: "all" };
  if (s === "fav") return { type: "fav" };
  const idx = s.indexOf(":");
  if (idx > 0) return { type: s.slice(0, idx), value: s.slice(idx + 1) };
  return { type: "all" };
}

/** 站点是否命中范围（不含屏蔽判断）。 */
export function inScope(site, scope) {
  const p = parseScope(scope);
  switch (p.type) {
    case "fav":
      return !!site.fav;
    case "cat":
      return (site.categories || []).includes(p.value);
    case "kind":
      return site.kind === p.value;
    default:
      return true;
  }
}

/** Surprise 的候选池：命中范围且未被屏蔽。 */
export function eligibleSites(sites, scope) {
  return (sites || []).filter((s) => !s.blocked && inScope(s, scope));
}

/** Fisher–Yates 洗牌，返回新数组。 */
export function shuffle(arr) {
  const a = (arr || []).slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 从候选池抽取一个站点，维护洗牌袋。
 * @param {string[]} bag      当前袋中剩余 id
 * @param {Array}  eligible   候选站点
 * @param {boolean} noRepeat  是否启用不重复抽取
 * @returns {{site: object|null, bag: string[]}}
 */
export function pickFromList(bag, eligible, noRepeat = true) {
  if (!eligible || eligible.length === 0) return { site: null, bag: [] };
  if (!noRepeat) {
    return { site: eligible[Math.floor(Math.random() * eligible.length)], bag: [] };
  }
  let b = (bag || []).slice();
  while (b.length) {
    const id = b.pop();
    const site = eligible.find((s) => s.id === id);
    if (site) return { site, bag: b };
  }
  // 袋空：整袋重洗（洗牌袋保证一轮内不重复）
  b = shuffle(eligible.map((s) => s.id));
  const id = b.pop();
  return { site: eligible.find((s) => s.id === id) || null, bag: b };
}

/** 期数显示名：web_12 -> 第12期，custom -> 自定义 */
export function kindLabel(kind) {
  if (kind === "custom") return "自定义";
  const m = /(\d+)/.exec(kind || "");
  return m ? `第${m[1]}期` : kind || "";
}

/** 按标题稳定地选一个头像配色 */
export function avatarHue(title) {
  let h = 0;
  for (const ch of String(title || "?")) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
}

export function timeAgo(ts, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  const m = 60 * 1000, h = 60 * m, d = 24 * h;
  if (diff < m) return "刚刚";
  if (diff < h) return `${Math.floor(diff / m)} 分钟前`;
  if (diff < d) return `${Math.floor(diff / h)} 小时前`;
  if (diff < 30 * d) return `${Math.floor(diff / d)} 天前`;
  const t = new Date(ts);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
