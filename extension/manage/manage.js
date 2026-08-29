import {
  getState,
  saveSettings,
  updateSite,
  addCustomSite,
  removeSite,
  resetSites,
  recordVisit,
  patchState,
} from "../lib/store.js";
import { openSite, buildScopeOptions } from "../lib/jump.js";
import { avatarHue, kindLabel, parseScope } from "../lib/surprise.js";

const $ = (sel) => document.querySelector(sel);

const state = {
  sites: [],
  settings: null,
  history: [],
  filters: { q: "", kind: "all", cat: "all", status: "all", sort: "kind" },
  editingId: null, // null = 新增模式
};

/* ---------- 小工具 ---------- */

function faviconURL(href, size = 64) {
  return (
    chrome.runtime.getURL("_favicon/") +
    "?pageUrl=" +
    encodeURIComponent(href) +
    "&size=" +
    size
  );
}

function avatarEl(site) {
  const holder = document.createElement("span");
  holder.className = "avatar";
  const img = document.createElement("img");
  img.src = faviconURL(site.href);
  img.alt = "";
  const hue = avatarHue(site.title);
  const letter = document.createElement("span");
  letter.className = "letter";
  letter.style.background = `linear-gradient(135deg,hsl(${hue} 65% 45%),hsl(${
    (hue + 40) % 360
  } 65% 55%))`;
  letter.textContent = (site.title || "?").trim().charAt(0);
  img.addEventListener("error", () => img.replaceWith(letter));
  holder.appendChild(img);
  return holder;
}

let toastTimer = null;
function toast(msg, type = "ok") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/* ---------- 渲染 ---------- */

function siteMatches(s) {
  const f = state.filters;
  if (f.kind !== "all" && s.kind !== f.kind) return false;
  if (f.cat !== "all" && !(s.categories || []).includes(f.cat)) return false;
  switch (f.status) {
    case "fav": if (!s.fav) return false; break;
    case "blocked": if (!s.blocked) return false; break;
    case "custom": if (!s.custom) return false; break;
    case "unvisited": if (s.visitCount > 0) return false; break;
  }
  if (f.q) {
    const q = f.q.toLowerCase();
    if (![s.title, s.slogan, s.href].some((v) => (v || "").toLowerCase().includes(q))) return false;
  }
  return true;
}

function sortedView(sites) {
  const arr = sites.slice();
  const kindNo = (k) => {
    const m = /(\d+)/.exec(k || "");
    return m ? Number(m[1]) : -1;
  };
  switch (state.filters.sort) {
    case "title":
      arr.sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"));
      break;
    case "visits":
      arr.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0) || a.title.localeCompare(b.title, "zh-Hans-CN"));
      break;
    default:
      arr.sort((a, b) => kindNo(b.kind) - kindNo(a.kind) || a.title.localeCompare(b.title, "zh-Hans-CN"));
  }
  return arr;
}

function renderStats() {
  const total = state.sites.length;
  const fav = state.sites.filter((s) => s.fav).length;
  const blocked = state.sites.filter((s) => s.blocked).length;
  const custom = state.sites.filter((s) => s.custom).length;
  const visits = state.sites.reduce((n, s) => n + (s.visitCount || 0), 0);
  $("#stats").innerHTML = [
    `共 <b>${total}</b> 站`,
    `⭐ <b>${fav}</b>`,
    `🚫 <b>${blocked}</b>`,
    `✏️ 自定义 <b>${custom}</b>`,
    `累计访问 <b>${visits}</b> 次`,
  ]
    .map((t) => `<span class="chip">${t}</span>`)
    .join("");
}

function renderFilters() {
  const kindSel = $("#fKind");
  const catSel = $("#fCat");
  const keep = (sel, fn) => {
    const v = sel.value;
    fn();
    sel.value = v;
    if (sel.value !== v) sel.value = "all";
  };
  keep(kindSel, () => {
    const kinds = [...new Set(state.sites.map((s) => s.kind))]
      .filter((k) => /^web_\d+$/.test(k))
      .sort((a, b) => Number(b.slice(4)) - Number(a.slice(4)));
    kindSel.innerHTML =
      `<option value="all">全部期数</option>` +
      kinds.map((k) => `<option value="${k}">${kindLabel(k)}</option>`).join("");
  });
  keep(catSel, () => {
    const counts = new Map();
    for (const s of state.sites)
      for (const c of s.categories || []) counts.set(c, (counts.get(c) || 0) + 1);
    const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    catSel.innerHTML =
      `<option value="all">全部分类</option>` +
      cats.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  });
}

function renderGrid() {
  const view = sortedView(state.sites.filter(siteMatches));
  $("#countInfo").textContent = `显示 ${view.length} / ${state.sites.length}`;
  const grid = $("#grid");
  if (!view.length) {
    grid.innerHTML = `<div class="empty-grid">没有符合条件的网站 —— 试试调整筛选，或点「添加网站」。</div>`;
    return;
  }
  grid.innerHTML = view.map(cardHTML).join("");
  // 头像用 DOM 构建（favicon 加载失败回退到首字母，CSP 禁止内联 onerror）
  for (const head of grid.querySelectorAll(".card-head")) {
    const card = head.closest(".card");
    const site = view.find((s) => s.id === card.dataset.id);
    if (site) head.prepend(avatarEl(site));
  }
}

function cardHTML(s) {
      const badges = [
        `<span class="badge kind">${kindLabel(s.kind)}</span>`,
        ...(s.categories || []).map((c) => `<span class="badge">${escapeHTML(c)}</span>`),
      ].join("");
      const marks =
        (s.custom ? `<span class="mark" title="自定义">✏️</span>` : "") +
        (s.blocked ? `<span class="mark" title="已屏蔽">🚫</span>` : "");
      const metaBits = [
        s.visitCount ? `访问 ${s.visitCount} 次` : "",
        s.fav ? "⭐" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<article class="card ${s.blocked ? "blocked" : ""}" data-id="${s.id}">
        <div class="card-head">
          <div class="card-title-row">
            <div class="card-title"><span>${escapeHTML(s.title)}</span>${marks}</div>
          </div>
        </div>
        <div class="card-slogan">${escapeHTML(s.slogan || s.href)}</div>
        <div class="badges">${badges}</div>
        <div class="card-foot">
          <span class="meta">${metaBits || "&nbsp;"}</span>
          <button class="mini" data-action="open" title="打开">↗</button>
          <button class="mini ${s.fav ? "on" : ""}" data-action="fav" title="收藏">⭐</button>
          <button class="mini ${s.blocked ? "on" : ""}" data-action="block" title="屏蔽 / 取消屏蔽">🚫</button>
          <button class="mini" data-action="edit" title="编辑">✏️</button>
          <button class="mini danger" data-action="del" title="删除">🗑</button>
        </div>
      </article>`;
}

function renderAll() {
  renderStats();
  renderFilters();
  renderGrid();
}

/* ---------- 卡片操作（事件委托） ---------- */

$("#grid").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const card = btn.closest(".card");
  const site = state.sites.find((s) => s.id === card?.dataset.id);
  if (!site) return;
  switch (btn.dataset.action) {
    case "open":
      await recordVisit(site);
      await openSite(site);
      renderAll();
      break;
    case "fav":
      await updateSite(site.id, { fav: !site.fav });
      await refresh();
      break;
    case "block":
      await updateSite(site.id, { blocked: !site.blocked });
      await refresh();
      break;
    case "edit":
      openModal(site);
      break;
    case "del": {
      const ok = await confirmDialog(`确定删除「${site.title}」吗？`);
      if (!ok) break;
      await removeSite(site.id);
      toast("已删除");
      await refresh();
      break;
    }
  }
});

/** 原生 confirm 的 Promise 包装（保持扩展页面行为一致）。 */
function confirmDialog(msg) {
  return Promise.resolve(window.confirm(msg));
}

async function refresh() {
  const { sites, settings, history } = await getState();
  state.sites = sites;
  state.settings = settings;
  state.history = history;
  renderAll();
}

/* ---------- 弹窗（添加 / 编辑） ---------- */

function fillKindOptions(selected) {
  const sel = $("#mKind");
  const kinds = [...new Set(state.sites.map((s) => s.kind))]
    .filter((k) => /^web_\d+$/.test(k))
    .sort((a, b) => Number(b.slice(4)) - Number(a.slice(4)));
  sel.innerHTML =
    `<option value="custom">自定义</option>` +
    kinds.map((k) => `<option value="${k}">${kindLabel(k)}</option>`).join("");
  sel.value = selected || "custom";
  if (sel.value !== (selected || "custom")) sel.value = "custom";
}

function openModal(site = null) {
  state.editingId = site ? site.id : null;
  $("#modalTitle").textContent = site ? "编辑网站" : "添加网站";
  $("#mTitle").value = site?.title || "";
  $("#mHref").value = site?.href || "";
  $("#mSlogan").value = site?.slogan || "";
  $("#mCats").value = site ? (site.categories || []).join(", ") : "";
  fillKindOptions(site?.kind);
  $("#modalMask").hidden = false;
  $("#mTitle").focus();
}

function closeModal() {
  $("#modalMask").hidden = true;
  state.editingId = null;
}

$("#mCancel").addEventListener("click", closeModal);
$("#modalMask").addEventListener("click", (e) => {
  if (e.target === $("#modalMask")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#modalMask").hidden) closeModal();
});

$("#mSave").addEventListener("click", async () => {
  const title = $("#mTitle").value.trim();
  let href = $("#mHref").value.trim();
  const slogan = $("#mSlogan").value.trim();
  const categories = $("#mCats").value
    .split(/[,，]/)
    .map((c) => c.trim())
    .filter(Boolean);
  const kind = $("#mKind").value;
  if (!title) return toast("请填写名称", "err");
  if (!href) return toast("请填写链接", "err");
  if (!/^https?:\/\//i.test(href)) href = "https://" + href;

  if (state.editingId) {
    await updateSite(state.editingId, { title, href, slogan, categories, kind });
    toast("已保存");
  } else {
    await addCustomSite({ title, href, slogan, categories, kind });
    toast("已添加");
  }
  closeModal();
  await refresh();
});

/* ---------- 工具条 ---------- */

$("#btnAdd").addEventListener("click", () => openModal());

$("#btnExport").addEventListener("click", () => {
  const backup = {
    type: "webjump-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    history: state.history,
    sites: state.sites,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `webjump-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("已导出备份");
});

/** 清洗 lks 原始数据的标题（和 fetch_data.py 保持一致的兜底逻辑）。 */
function cleanTitle(raw) {
  const ta = document.createElement("textarea");
  ta.innerHTML = raw || "";
  return ta.value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

$("#btnImport").addEventListener("click", () => $("#fileInput").click());

$("#fileInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return toast("JSON 解析失败", "err");
  }

  if (data?.type === "webjump-backup" && Array.isArray(data.sites)) {
    const ok = await confirmDialog(
      `这是 WebJump 备份（${data.sites.length} 个站点）。\n导入将覆盖当前全部数据（含收藏/历史），确定吗？`
    );
    if (!ok) return;
    await patchState({
      sites: data.sites,
      settings: { ...state.settings, ...(data.settings || {}) },
      history: data.history || [],
      bag: [],
      lastScope: "",
    });
    toast(`已恢复备份（${data.sites.length} 个站点）`);
    await refresh();
    return;
  }

  if (Array.isArray(data) && data.length && data[0].kind_name !== undefined) {
    // lks 原始格式：合并新站点，保留现有状态
    const known = new Set(state.sites.map((s) => s.id));
    const seenHref = new Set(state.sites.map((s) => s.href));
    let added = 0;
    for (const it of data) {
      const href = (it.href || "").trim();
      const title = cleanTitle(it.title);
      if (!href || !title || seenHref.has(href)) continue;
      const id = `${it.kind}-${it.id}`;
      if (known.has(id)) continue;
      const categories = String(it.kind_name || "")
        .split("&")
        .map((c) => c.trim())
        .filter(Boolean);
      state.sites.push({
        id,
        title,
        href,
        slogan: (it.slogan || "").trim(),
        kind: it.kind || "web_0",
        categories: categories.length ? categories : ["未分类"],
        fav: false,
        blocked: false,
        visitCount: 0,
        lastVisited: 0,
      });
      known.add(id);
      seenHref.add(href);
      added++;
    }
    await patchState({ sites: state.sites, bag: [] });
    toast(added ? `已合并 ${added} 个新站点` : "没有发现新站点", added ? "ok" : "err");
    await refresh();
    return;
  }

  toast("无法识别的文件格式", "err");
});

$("#btnReset").addEventListener("click", async () => {
  const ok = await confirmDialog(
    "恢复默认数据将清空：收藏、屏蔽、自定义网站、访问记录。\n（设置保留）确定继续吗？"
  );
  if (!ok) return;
  await resetSites();
  toast("已恢复默认数据");
  await refresh();
});

/* ---------- 设置面板 ---------- */

function renderSettingsScope() {
  const sel = $("#setScope");
  const { categories, kindList } = buildScopeOptions(state.sites);
  const parts = [`<option value="all">🌐 全部网站</option>`, `<option value="fav">⭐ 仅收藏</option>`];
  if (categories.length)
    parts.push(
      `<optgroup label="按分类">` +
        categories.map((c) => `<option value="cat:${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("") +
        `</optgroup>`
    );
  if (kindList.length)
    parts.push(
      `<optgroup label="按期数">` +
        kindList.map((k) => `<option value="kind:${k}">${kindLabel(k)}</option>`).join("") +
        `</optgroup>`
    );
  sel.innerHTML = parts.join("");
  sel.value = state.settings.surpriseScope || "all";
  if (sel.value !== state.settings.surpriseScope) sel.value = "all";
}

function renderSettings() {
  renderSettingsScope();
  $("#setOpenNew").checked = state.settings.openInNewTab !== false;
  $("#setNoRepeat").checked = state.settings.noRepeat !== false;
  $("#historyInfo").textContent = `当前保存 ${state.history.length} / 100 条`;
}

$("#btnSettings").addEventListener("click", () => {
  const panel = $("#settingsPanel");
  panel.hidden = !panel.hidden;
});

$("#setScope").addEventListener("change", (e) => saveSettings({ surpriseScope: e.target.value }));
$("#setOpenNew").addEventListener("change", (e) => saveSettings({ openInNewTab: e.target.checked }));
$("#setNoRepeat").addEventListener("change", (e) => saveSettings({ noRepeat: e.target.checked }));

$("#btnClearHistory").addEventListener("click", async () => {
  const ok = await confirmDialog("确定清空全部访问记录吗？");
  if (!ok) return;
  await patchState({ history: [] });
  toast("已清空访问记录");
  await refresh();
});

/* ---------- 筛选绑定 ---------- */

$("#fSearch").addEventListener("input", (e) => {
  state.filters.q = e.target.value.trim();
  renderGrid();
});
for (const [id, key] of [
  ["#fKind", "kind"],
  ["#fCat", "cat"],
  ["#fStatus", "status"],
  ["#fSort", "sort"],
]) {
  $(id).addEventListener("change", (e) => {
    state.filters[key] = e.target.value;
    renderGrid();
  });
}

/* ---------- 启动 ---------- */

refresh().then(() => {
  renderSettings();
});
