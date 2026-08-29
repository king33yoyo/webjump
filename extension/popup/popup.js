import { getState, saveSettings, recordVisit } from "../lib/store.js";
import { openSite, surpriseJump, buildScopeOptions } from "../lib/jump.js";
import { avatarHue, kindLabel, timeAgo } from "../lib/surprise.js";

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
  const { history } = await getState();
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
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = h.title;
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = timeAgo(h.at);
    li.append(t, when);
    li.addEventListener("click", async () => {
      await openSite(h);
      window.close();
    });
    ul.appendChild(li);
  }
}

async function main() {
  const { sites, settings } = await getState();
  $("#siteCount").textContent = `${sites.length} 个有趣网站`;
  $("#openManage").addEventListener("click", () => chrome.runtime.openOptionsPage());
  await initScopeSelect(sites, settings);
  setupSurprise();
  setupSearch(sites);
  await renderRecent();
}

main();
