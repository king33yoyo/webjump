# WebJump · 网站惊喜跳跃

一个 Edge / Chrome 扩展（Manifest V3），收录了 B 站 UP 主 **LKs**《良心到难以置信的网站推荐》第 1～12 期的 **303 个有趣网站**，并围绕它做了收藏、屏蔽、分类管理和核心的 **Surprise 一键随机跳转**。当前源码版本：**v1.0.4**。

> 数据来源于开源项目 [xiangjianan/lks](https://github.com/xiangjianan/lks)（[lkssite.vip](https://lkssite.vip/)，MIT License）。

## 功能

- 🎲 **Surprise**：一键随机跳转到一个有趣网站。默认使用「洗牌袋」算法——一轮之内不重复、每个网站都会被抽到，抽完自动重洗。
- 🎯 **抽取范围**：全部网站 / 仅收藏 / 按分类（工具、娱乐、图片…）/ 按期数（第 1～12 期）。
- ⌨️ **快捷键**：`Alt+Shift+S` 直接来一发惊喜；`Alt+Shift+W` 打开弹窗（可在 `edge://extensions/shortcuts` 自定义）。
- 🖱️ **右键菜单**：页面任意位置右键 →「Surprise！随机跳转一个有趣网站」。
- 🗂️ **管理页**：搜索、按期数/分类/状态筛选、排序、收藏 ⭐、屏蔽 🚫、添加/编辑/删除自定义网站、统计面板。
- ➕ **添加当前网页**：在普通 `http/https` 页面点弹窗右上角的「＋」；若网址已经收录，则为它点亮收藏。
- 🕘 **最近访问**：弹窗显示最近 5 条记录，可直接收藏；删除时可以选择只清除访问记录，或连同网站一起从网站库删除。
- 💾 **导入 / 导出**：JSON 备份（含收藏、历史、设置），也可直接导入 lks 仓库的原始数据文件合并新站点。
- 🌐 **中英文界面名称与简介**：通过浏览器扩展本地化文件提供。

> 说明：v1.0.0 曾提供可选的「新标签页自动惊喜」（覆盖浏览器新标签页）。实测在 Edge 上「关闭时把标签页还给系统默认新标签页」会形成无限重定向循环，v1.0.1 起移除该功能，插件不再接管新标签页。

## 安装

- **Edge 用户**：从 [Microsoft Edge 加载项商店的 WebJump 官方页面](https://microsoftedge.microsoft.com/addons/detail/webjump-%C2%B7-%E7%BD%91%E7%AB%99%E6%83%8A%E5%96%9C%E8%B7%B3%E8%B7%83/ehbebdanldkacmlojlgpipcmmmgilphn)安装。商店版本以页面显示为准，可能晚于 GitHub Release。
- **下载当前版本**：从 [GitHub Releases](https://github.com/king33yoyo/webjump/releases)下载 `webjump-v1.0.4.zip`，解压后按下方步骤加载。发布包根目录就是 `manifest.json`，不要直接把 zip 当作解压目录加载。

### 开发者模式加载源码或 Release

1. 打开 Edge，地址栏输入 `edge://extensions`；
2. 打开左下角「**开发人员模式**」开关；
3. 点「**加载解压缩的扩展**」，选择本项目的 `extension` 目录，或 Release 压缩包解压后的目录；
4.（可选）固定工具栏图标，去 `edge://extensions/shortcuts` 确认快捷键。

Chrome 安装方式相同（`chrome://extensions` → 开发者模式 → 加载已解压的扩展程序）。

## 使用指南

| 位置 | 能做什么 |
|------|----------|
| 工具栏弹窗 | 点 **Surprise !** 随机跳转；切换抽取范围；快速搜索并直达任意网站；查看、收藏或删除最近访问；用「＋」添加当前网页 |
| 管理页（弹窗右上角 ⚙） | 全部 303+ 站点的筛选与管理、自定义网站、导入导出、设置 |

### Surprise 的抽取规则

- 候选池 = 未屏蔽 且 命中当前范围（全部 / 收藏 / 分类 / 期数）的网站；
- 开启「不重复抽取」时按洗牌袋出袋，屏蔽、删除站点会自动失效重洗；
- Surprise、搜索结果和管理页的网站卡片打开后会记入历史（保留最近 100 条）并累计访问次数；从「最近访问」再次打开不会新增记录。

## 更新数据

开发者更新内置网站库时，可重跑数据脚本并重新打包：

```bash
python scripts/fetch_data.py   # 发现上游数据并写入 extension/data/sites.json
python scripts/package.py      # 生成新的扩展压缩包
```

脚本优先从 GitHub 拉取，失败时回退到本地的 `lks-data-sample.json`。已经安装的用户不会因重新加载扩展就自动覆盖现有网站库；如需合并新站点，可在管理页「导入」选择 lks 仓库的 `web.vXX.json` 原始文件，已有收藏状态会保留。

**注意**：重新加载扩展不会丢数据（存在 `chrome.storage.local`），但「恢复默认数据」会清空收藏 / 屏蔽 / 自定义 / 历史。

## 目录结构

```
project-webjump/
├── scripts/
│   ├── fetch_data.py        # 数据拉取 + 清洗 → extension/data/sites.json
│   ├── make_icons.py        # 生成插件图标（需 Pillow）
│   └── test_core.mjs        # 核心逻辑单元测试（node scripts/test_core.mjs）
├── extension/               # 插件本体（加载这个目录）
│   ├── _locales/            # 英文与简体中文名称、简介
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
├── docs/                    # 商店上架说明
└── README.md
```

## 隐私说明

WebJump 不设账号，不包含统计埋点，也不会把收藏、屏蔽、访问历史或设置上传到开发者服务器；这些数据保存在浏览器的 `chrome.storage.local`。点击网站后，浏览器会正常访问对应的第三方网站，第三方网站各自的隐私规则仍然适用。

## 开发说明

- 纯 HTML / CSS / ES Module，无构建步骤；改动后到扩展页点「重新加载」即可生效。
- 核心逻辑与浏览器 API 解耦：`lib/surprise.js` 是纯函数，测试跑 `node scripts/test_core.mjs`（Node 内置 stub 掉 chrome.storage）。
- 商店发布包用 `python scripts/package.py` 从 `extension/` 生成（zipfile 正斜杠路径）；包内仅包含插件本体，不包含宣传视频文件；上架材料与文案见 `docs/edge-store-listing.md`，商店 Logo 由 `scripts/make_icons.py` 一并输出到 `store_assets/`。

## 许可与致谢

- 网站数据：[xiangjianan/lks](https://github.com/xiangjianan/lks)，MIT License —— 感谢 LKs 和整理者。
- 本项目代码同样以 MIT 协议提供。
