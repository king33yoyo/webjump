/**
 * 核心逻辑测试：stub 掉 chrome.storage / fetch，在 Node 里跑真实的
 * lib/surprise.js（纯逻辑）+ lib/store.js + lib/jump.js（pickSurprise 链路）。
 *
 * 用法: node scripts/test_core.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- chrome stub ---------- */

const mem = new Map();
const asList = (keys) => (Array.isArray(keys) ? keys : [keys]);

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        const out = {};
        for (const k of asList(keys)) if (mem.has(k)) out[k] = mem.get(k);
        return out;
      },
      async set(obj) {
        for (const [k, v] of Object.entries(obj)) mem.set(k, v);
      },
      async remove(keys) {
        for (const k of asList(keys)) mem.delete(k);
      },
    },
  },
  runtime: {
    getURL: (p) => "stub://" + p,
    openOptionsPage: () => {},
  },
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url).startsWith("stub://")) {
    const file = path.join(ROOT, "extension", String(url).slice("stub://".length));
    return { json: async () => JSON.parse(await readFile(file, "utf-8")) };
  }
  return realFetch(url);
};

/* ---------- 微型断言 ---------- */

let passed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    process.exitCode = 1;
  } else {
    passed++;
    console.log(`  ✓ ${msg}`);
  }
}

/* ---------- 引入被测模块（stub 就绪后） ---------- */

const { ensureInit, getState, updateSite, recordVisit, saveSettings, patchState } = await import(
  "../extension/lib/store.js"
);
const { pickSurprise } = await import("../extension/lib/jump.js");
const { parseScope, inScope, eligibleSites, pickFromList } = await import(
  "../extension/lib/surprise.js"
);

/* ---------- parseScope / inScope ---------- */

console.log("parseScope / inScope");
ok(parseScope("all").type === "all", 'parseScope("all") -> all');
ok(parseScope("cat:音乐").value === "音乐", 'parseScope("cat:音乐") 带值解析');
ok(parseScope(undefined).type === "all", "空范围回退到 all");
ok(inScope({ categories: ["音乐"] }, "cat:音乐"), "inScope 命中分类");
ok(!inScope({ kind: "web_3" }, "kind:web_4"), "inScope 不命中期数");
ok(inScope({ fav: true }, "fav") && !inScope({ fav: false }, "fav"), "inScope 收藏范围");

/* ---------- pickFromList 洗牌袋性质 ---------- */

console.log("pickFromList 洗牌袋");
{
  const pool = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` }));
  const picked = [];
  let bag = [];
  for (let i = 0; i < 20; i++) {
    const r = pickFromList(bag, pool, true);
    picked.push(r.site.id);
    bag = r.bag;
  }
  const first10 = new Set(picked.slice(0, 10));
  const next10 = new Set(picked.slice(10, 20));
  ok(first10.size === 10, "一轮内 10 抽全部不重复");
  ok(next10.size === 10, "第二轮重新洗牌后同样不重复");
  const noRepeatOff = new Set(
    Array.from({ length: 50 }, () => pickFromList([], pool, false).site.id)
  );
  ok(noRepeatOff.size <= 10 && noRepeatOff.size >= 2, "关闭不重复时退化为普通随机");
  ok(pickFromList([], [], true).site === null, "候选池为空返回 null");
}

/* ---------- ensureInit / 种子数据 ---------- */

console.log("初始化");
await ensureInit();
const { sites } = await getState();
ok(sites.length === 303, `种子数据灌入 303 条（实际 ${sites.length}）`);
ok(sites.every((s) => s.fav === false && s.blocked === false && s.visitCount === 0), "初始状态字段齐全");
ok(!sites.some((s) => /<[^>]*>/.test(s.title)), "标题已清洗（无残留 HTML 标签）");

/* ---------- pickSurprise 端到端 ---------- */

console.log("pickSurprise 端到端");
{
  const first = await pickSurprise();
  ok(!!first, "能抽到一个站点");
  const pickedIds = new Set([first.id]);
  let exhaustedOk = true;
  for (let i = 0; i < 310; i++) {
    const s = await pickSurprise();
    if (!s) exhaustedOk = false;
    else pickedIds.add(s.id);
  }
  ok(exhaustedOk && pickedIds.size === 303, `连抽 311 次覆盖全部 303 站且不中断（覆盖 ${pickedIds.size}）`);

  // 收藏范围
  await updateSite(sites[0].id, { fav: true });
  await updateSite(sites[1].id, { fav: true });
  await saveSettings({ surpriseScope: "fav" });
  let favOnly = true;
  for (let i = 0; i < 10; i++) {
    const s = await pickSurprise();
    if (!s || !s.fav) favOnly = false;
  }
  ok(favOnly, "范围=仅收藏时只抽到收藏站点");

  // 屏蔽后排除
  await updateSite(sites[0].id, { blocked: true });
  await saveSettings({ surpriseScope: "all" });
  const blockedIds = new Set(sites.filter((s) => s.blocked).map((s) => s.id));
  let respectBlocked = true;
  for (let i = 0; i < 40; i++) {
    const s = await pickSurprise();
    if (!s || blockedIds.has(s.id)) respectBlocked = false;
  }
  ok(respectBlocked, "被屏蔽的站点不会被抽到");
}

/* ---------- recordVisit / 历史封顶 ---------- */

console.log("recordVisit");
{
  const s0 = (await getState()).sites[5];
  await recordVisit(s0);
  await recordVisit(s0);
  const { sites: after, history } = await getState();
  const target = after.find((x) => x.id === s0.id);
  ok(target.visitCount === 2, "访问计数累加");
  ok(history[0].id === s0.id && history[1].id === s0.id, "历史最新在前");
  const many = Array.from({ length: 120 }, (_, i) => ({
    id: `x${i}`,
    title: `t${i}`,
    href: "https://x",
    at: i,
  }));
  await patchState({ history: many });
  await recordVisit(s0);
  const { history: h2 } = await getState();
  ok(h2.length === 100, "历史封顶 100 条");
}

/* ---------- eligibleSites 汇总 ---------- */

console.log("eligibleSites");
{
  const data = [
    { id: "a", blocked: false, categories: ["工具"], kind: "web_1" },
    { id: "b", blocked: true, categories: ["工具"], kind: "web_1" },
    { id: "c", blocked: false, categories: ["音乐"], kind: "web_2" },
  ];
  ok(eligibleSites(data, "all").length === 2, "all 范围排除屏蔽");
  ok(eligibleSites(data, "cat:工具").map((s) => s.id).join() === "a", "分类过滤");
}

console.log(process.exitCode ? "\n部分测试未通过" : `\n全部通过（${passed} 项断言）`);
