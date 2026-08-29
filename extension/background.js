/**
 * WebJump 后台 service worker：安装初始化、快捷键、右键菜单。
 */
import { ensureInit } from "./lib/store.js";
import { surpriseJump } from "./lib/jump.js";

chrome.runtime.onInstalled.addListener(async () => {
  await ensureInit();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "wj-surprise",
      title: "Surprise！随机跳转一个有趣网站",
      contexts: ["page", "action"],
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  ensureInit();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "surprise") return;
  await ensureInit();
  await surpriseJump();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "wj-surprise") return;
  await ensureInit();
  await surpriseJump();
});
