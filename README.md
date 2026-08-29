# WebJump · 网站惊喜跳跃

一个 Edge / Chrome 扩展（Manifest V3），收录了 B 站 UP 主 **LKs**《良心到难以置信的网站推荐》第 1～12 期的 **303 个有趣网站**，并围绕它做了收藏、屏蔽、分类管理和核心的 **Surprise 一键随机跳转**。

> 数据来源于开源项目 [xiangjianan/lks](https://github.com/xiangjianan/lks)（[lkssite.vip](https://lkssite.vip/)，MIT License）。

## 功能

- 🎲 **Surprise**：一键随机跳转到一个有趣网站。默认使用「洗牌袋」算法——一轮之内不重复、每个网站都会被抽到，抽完自动重洗。
- 🎯 **抽取范围**：全部网站 / 仅收藏 / 按分类（工具、娱乐、图片…）/ 按期数（第 1～12 期）。
- ⌨️ **快捷键**：`Alt+Shift+S` 直接来一发惊喜；`Alt+Shift+W` 打开弹窗（可在 `edge://extensions/shortcuts` 自定义）。
- 🖱️ **右键菜单**：页面任意位置右键 →「Surprise！随机跳转一个有趣网站」。
- 🗂️ **管理页**：搜索、按期数/分类/状态筛选、排序、收藏 ⭐、屏蔽 🚫、添加/编辑/删除自定义网站、统计面板。
- 💾 **导入 / 导出**：JSON 备份（含收藏、历史、设置），也可直接导入 lks 仓库的原始数据文件合并新站点。

> 说明：v1.0.0 曾提供可选的「新标签页自动惊喜」（覆盖浏览器新标签页）。实测在 Edge 上「关闭时把标签页还给系统默认新标签页」会形成无限重定向循环，v1.0.1 起移除该功能，插件不再接管新标签页。

## 安装（开发者模式）

1. 打开 Edge，地址栏输入 `edge://extensions`；
2. 打开左下角「**开发人员模式**」开关；
3. 点「**加载解压缩的扩展**」，选择本项目的 `extension` 目录；
4.（可选）固定工具栏图标，去 `edge://extensions/shortcuts` 确认快捷键。

Chrome 安装方式相同（`chrome://extensions` → 开发者模式 → 加载已解压的扩展程序）。

## 使用指南

| 位置 | 能做什么 |
|------|----------|
| 工具栏弹窗 | 点 **Surprise !** 随机跳转；切换抽取范围；快速搜索并直达任意网站；查看最近访问 |
| 管理页（弹窗右上角 ⚙） | 全部 303+ 站点的筛选与管理、自定义网站、导入导出、设置 |

### Surprise 的抽取规则

- 候选池 = 未屏蔽 且 命中当前范围（全部 / 收藏 / 分类 / 期数）的网站；
- 开启「不重复抽取」时按洗牌袋出袋，屏蔽、删除站点会自动失效重洗；
- 每次通过插件打开网站都会记入历史（保留最近 100 条）并累计访问次数。

## 更新数据

LKs 出新一期后（比如第 13 期），重跑数据脚本再重新加载扩展即可：

```bash
python scripts/fetch_data.py   # 自动发现仓库里最新版数据并清洗
# 然后到 edge://extensions 里点 WebJump 的「重新加载」
```

脚本优先从 GitHub 拉取，失败时回退到本地的 `lks-data-sample.json`。也可以在管理页「导入」直接选择 lks 仓库的 `web.vXX.json` 原始文件，会自动合并新站点、保留收藏状态。

**注意**：重新加载扩展不会丢数据（存在 `chrome.storage.local`），但「恢复默认数据」会清空收藏 / 屏蔽 / 自定义 / 历史。

## 目录结构

```
project-webjump/
├── scripts/
│   ├── fetch_data.py        # 数据拉取 + 清洗 → extension/data/sites.json
│   ├── make_icons.py        # 生成插件图标（需 Pillow）
│   └── test_core.mjs        # 核心逻辑单元测试（node scripts/test_core.mjs）
├── extension/               # 插件本体（加载这个目录）
│   ├── manifest.json
│   ├── background.js        # service worker：安装初始化 / 快捷键 / 右键菜单
│   ├── lib/
│   │   ├── store.js         # chrome.storage 数据层
│   │   ├── surprise.js      # 纯逻辑：范围过滤、洗牌袋（可单测）
│   │   └── jump.js          # 抽取 → 记录 → 跳转 编排
│   ├── popup/               # 工具栏弹窗
│   ├── manage/              # 管理页
│   ├── data/sites.json      # 内置种子数据（303 条）
│   └── icons/
└── README.md
```

## 隐私说明

WebJump **不收集、不上传任何数据**：网站数据、收藏、屏蔽、访问历史与设置全部通过 `chrome.storage` 仅保存在你的浏览器本地；扩展没有任何远程请求、统计埋点或账号体系。卸载扩展即彻底删除全部数据。

## 开发说明

- 纯 HTML / CSS / ES Module，无构建步骤；改动后到扩展页点「重新加载」即可生效。
- 核心逻辑与浏览器 API 解耦：`lib/surprise.js` 是纯函数，测试跑 `node scripts/test_core.mjs`（Node 内置 stub 掉 chrome.storage）。
- 商店发布包用 `python scripts/package.py` 生成（zipfile 正斜杠路径，避免 Compress-Archive 的反斜杠兼容问题）；上架材料与文案见 `docs/edge-store-listing.md`，商店 Logo 由 `scripts/make_icons.py` 一并输出到 `store_assets/`。

## 许可与致谢

- 网站数据：[xiangjianan/lks](https://github.com/xiangjianan/lks)，MIT License —— 感谢 LKs 和整理者。
- 本项目代码同样以 MIT 协议提供。
