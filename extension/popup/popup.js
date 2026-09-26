import { getState, saveSettings, recordVisit, removeHistoryAt, removeSiteAndHistory, updateSite, addCustomSite } from "../lib/store.js";
import { openSite, surpriseJump, buildScopeOptions } from "../lib/jump.js";
import { avatarHue, kindLabel } from "../lib/surprise.js";

const $ = (sel) => document.querySelector(sel);

function faviconURL(href, size = 32) {
  return (
    chrome.runtime.getURL("_favicon/") +
    "?pageUrl=" +
    encodeURIComponent(href) +
    "&size=" +
    size
  );
}

function avatarEl(site) {
  const span = document.createElement("span");
  span.className = "avatar";
  const hue = avatarHue(site.title);
  span.style.background = `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 40) % 360} 65% 55%))`;
  span.textContent = (site.title || "?").trim().charAt(0);
  const img = document.createElement("img");
  img.src = faviconURL(site.href);
  img.width = 26;
  img.height = 26;
  img.style.cssText = "border-radius:7px;flex:none;";
  img.onerror = () => img.replaceWith(span);
  const holder = document.createElement("span");
  holder.style.cssText = "width:26px;height:26px;flex:none;";
  holder.appendChild(img);
  return holder;
}

async function initScopeSelect(sites, settings) {
  const sel = $("#scopeSel");
  const { categories, kindList } = buildScopeOptions(sites);
  const add = (value, label) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    sel.appendChild(opt);
  };
  add("all", "🌐 全部网站");
  add("fav", "⭐ 仅收藏");
  const catGroup = document.createElement("optgroup");
  catGroup.label = "按分类";
  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = `cat:${c}`;
    opt.textContent = c;
    catGroup.appendChild(opt);
  });
  sel.appendChild(catGroup);
  const kindGroup = document.createElement("optgroup");
  kindGroup.label = "按期数";
  kindList.forEach((k) => {
    const opt = document.createElement("option");
    opt.value = `kind:${k}`;
    opt.textContent = kindLabel(k);
    kindGroup.appendChild(opt);
  });
  sel.appendChild(kindGroup);
  sel.value = settings.surpriseScope || "all";
  if (sel.value !== settings.surpriseScope) sel.value = "all";
  sel.addEventListener("change", async () => {
    await saveSettings({ surpriseScope: sel.value });
  });
}

function setupSurprise() {
  const btn = $("#surpriseBtn");
  const tip = $("#tip");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.querySelector(".txt").textContent = "抽取中…";
    const site = await surpriseJump();
    if (!site) {
      tip.hidden = false;
      tip.textContent = "范围内没有可抽取的网站，去收藏几个或换个范围吧！";
      btn.disabled = false;
      btn.querySelector(".txt").textContent = "Surprise !";
      return;
    }
    btn.querySelector(".txt").textContent = site.title;
    setTimeout(() => window.close(), 450);
  });
}

function setupSearch(sites) {
  const input = $("#searchInput");
  const box = $("#searchResults");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    box.innerHTML = "";
    if (!q) {
      box.hidden = true;
      return;
    }
    const hits = sites
      .filter((s) =>
        [s.title, s.slogan, s.href].some((v) => (v || "").toLowerCase().includes(q))
      )
      .slice(0, 8);
    if (!hits.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "没有匹配的网站";
      box.appendChild(empty);
    }
    for (const site of hits) {
      const item = document.createElement("div");
      item.className = "result-item";
      item.appendChild(avatarEl(site));
      const info = document.createElement("div");
      info.className = "info";
      const t = document.createElement("div");
      t.className = "t";
      t.textContent = site.title;
      const s = document.createElement("div");
      s.className = "s";
      s.textContent = site.slogan || site.href;
      info.append(t, s);
      item.appendChild(info);
      item.addEventListener("click", async () => {
        await recordVisit(site);
        await openSite(site);
        window.close();
      });
      box.appendChild(item);
    }
    box.hidden = false;
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      box.hidden = true;
      input.blur();
    }
  });
}

async function renderRecent() {
  const { history, sites } = await getState();
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const ul = $("#recentList");
  ul.innerHTML = "";
  if (!history.length) {
    const li = document.createElement("li");
    li.className = "empty-row";
    li.textContent = "还没有访问记录，点上面的 Surprise 开始探索吧！";
    ul.appendChild(li);
    return;
  }
  for (const h of history.slice(0, 5)) {
    const li = document.createElement("li");
    li.appendChild(avatarEl({ title: h.title, href: h.href }));

    const site = siteById.get(h.id);
    const info = document.createElement("span");
    info.className = "info";
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = h.title;
    const s = document.createElement("span");
    s.className = "s";
    s.textContent = site ? site.slogan || site.href : h.href;
    info.append(t, s);
    li.appendChild(info);

    if (site) {
      const fav = document.createElement("button");
      fav.className = "recent-fav";
      const paint = () => {
        fav.textContent = site.fav ? "★" : "☆";
        fav.classList.toggle("on", !!site.fav);
        fav.title = site.fav ? "取消收藏" : "收藏";
      };
      paint();
      fav.addEventListener("click", async (e) => {
        e.stopPropagation();
        const updated = await updateSite(site.id, { fav: !site.fav });
        if (updated) {
          site.fav = updated.fav;
          paint();
        }
      });
      li.appendChild(fav);
    }

    const del = document.createElement("button");
    del.className = "recent-del";
    del.title = "删除";
    del.textContent = "✕";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      openDeleteConfirm(h);
    });
    li.appendChild(del);

    li.addEventListener("click", async () => {
      await openSite(h);
      window.close();
    });
    ul.appendChild(li);
  }
}

/* ---------- 最近访问：删除确认 ---------- */

let pendingDelete = null;

function openDeleteConfirm(entry) {
  pendingDelete = entry;
  $("#confirmText").textContent = `是否删除原网页「${entry.title}」？`;
  $("#confirmMask").hidden = false;
}

function closeDeleteConfirm() {
  $("#confirmMask").hidden = true;
  pendingDelete = null;
}

function setupDeleteConfirm() {
  $("#confirmCancel").addEventListener("click", closeDeleteConfirm);
  $("#confirmMask").addEventListener("click", (e) => {
    if (e.target === $("#confirmMask")) closeDeleteConfirm();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#confirmMask").hidden) closeDeleteConfirm();
  });
  $("#confirmRecordOnly").addEventListener("click", async () => {
    if (!pendingDelete) return;
    await removeHistoryAt(pendingDelete.at);
    closeDeleteConfirm();
    await renderRecent();
  });
  $("#confirmDeleteSite").addEventListener("click", async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    closeDeleteConfirm();
    await removeSiteAndHistory(id);
    const { sites } = await getState();
    $("#siteCount").textContent = `${sites.length} 个有趣网站`;
    await renderRecent();
  });
}

/* ---------- 添加当前网页 ---------- */

let tipTimer = null;
function showTip(text) {
  const tip = $("#tip");
  tip.textContent = text;
  tip.hidden = false;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => {
    tip.hidden = true;
  }, 2500);
}

function setupAddCurrentPage() {
  $("#addCurrent").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https?:\/\//i.test(tab.url || "")) {
      showTip("此页面无法添加（仅支持 http/https 网页）");
      return;
    }
    const href = tab.url;
    const title = (tab.title || href).trim();
    const norm = (u) => u.replace(/\/+$/, "");
    const { sites } = await getState();
    const existing = sites.find((s) => norm(s.href) === norm(href));
    if (existing) {
      if (!existing.fav) await updateSite(existing.id, { fav: true });
      showTip(`「${title}」已在网站库中，已为你点亮收藏 ⭐`);
      return;
    }
    await addCustomSite({ title, href, slogan: "", categories: ["未分类"], kind: "custom" });
    const { sites: after } = await getState();
    $("#siteCount").textContent = `${after.length} 个有趣网站`;
    showTip(`已添加「${title}」`);
  });
}

async function main() {
  const { sites, settings } = await getState();
  $("#siteCount").textContent = `${sites.length} 个有趣网站`;
  $("#openManage").addEventListener("click", () => chrome.runtime.openOptionsPage());
  setupAddCurrentPage();
  await initScopeSelect(sites, settings);
  setupSurprise();
  setupSearch(sites);
  setupDeleteConfirm();
  await renderRecent();
}

main();
