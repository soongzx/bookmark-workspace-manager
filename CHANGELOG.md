# Changelog

## [2.2.28] - 2026-07-30

### 缺陷修复

- QQ 浏览器根因修复：`ensureFolderIds` 检测到标准 id='2'（其他书签）为空时，将 `ids.other` 重定向到 `ids.toolbar`（书签栏），使 Gist 书签创建在标准存储中
- QQ 浏览器"其他书签"是独立存储层，`chrome.bookmarks` API 无法读写。通过将书签创建到书签栏 (id='1') 绕开此限制
- `tryClearViaStoredIds` 改用 `remove()` 反向遍历，移除后清理 `gistBookmarkIds` 和 `gistBookmarkSnapshot`
- 弹出窗口有快照时优先用虚拟树展示，`refreshBookmarkView` 同步适配

## [2.2.22] - 2026-07-30

### 功能

- 适配 QQ 浏览器 `Bookmarks_01` 文件结构：自动检测不再依赖特定根节点 ID
- `detectAuto` 全量兜底策略：遍历所有 root children 找有内容者，优先返回有文件夹子项的节点
- `detectByTitle` 增加 QQ 浏览器特有文件夹名匹配："所有书签"、"收藏栏"
- `findStorageFolderInBar` 增加全量兜底：在任意根节点下查找存储文件夹
- 设置页"浏览器环境"卡片显示每个节点的 `id` 值，辅助调试

### 缺陷修复

- 修复致命 bug：`controller.js` 中 `bindEvents()` 在书签加载失败时提前 return，导致所有按钮无响应
- 将 `bindEvents()` 移到 `try` 块之前，确保事件绑定独立于书签数据加载

## [2.2.20] - 2026-07-30

### 缺陷修复

- 修复致命 bug：`controller.js` 中 `bindEvents()` 在 bookmarks 加载失败时从不执行，导致所有按钮无响应
- 将 `bindEvents()` 移到 `try` 块之前，确保事件绑定独立于书签数据加载

## [2.2.20] - 2026-07-30

### 功能

- Tab 标签"同步配置"改名为"认证配置"
- 新增一键填充功能：粘贴认证信息文本（Token / Gist ID / 文件名），自动识别并填入对应字段
- `parseAuthPaste` 解析函数支持中文冒号 `：` 和英文冒号 `:`，容错字段间无空格、无换行的粘贴格式

## [2.2.19] - 2026-07-30

### UI 优化

- 书签路径标签页重构为三卡片布局（读取策略 / 存储路径 / 浏览器环境），与同步管理标签页风格统一
- 精简书签路径提示文案

## [2.2.18] - 2026-07-30

### 构建

- 打包脚本 `deployment/build.sh` 新增清理逻辑：每次构建前先清空 `dist/` 目录再写入新文件

## [2.2.17] - 2026-07-30

### 缺陷修复

- 修复自动检测在 Chrome 未登录、书签栏为空时不回退到"其他书签"(id='2') 的缺陷
- 修复 9 处 `children` 真值检查：空数组 `[]` 在 JS 中为 truthy，改为 `children.length > 0` 判断
- 修复 `custom:` 用户指定文件夹名称模式同样受空数组误判影响的问题

## [2.2.16] - 2026-07-30

### 功能

- 同步管理标签页 UI 重构：三张卡片布局（下载模式 / 自动同步 / 危险操作）
- 下载模式从下拉框改为二选一 radio 卡片组（覆盖 / 追加），带高亮态
- 自动同步配置收缩为并排 flex 布局（同步间隔 + 同步方向）
- 移除未使用的 CSS 规则（section-group、section-title、section-danger、btn-icon）

## [2.2.15] - 2026-07-30

### 功能

- 搜索结果美化：favicon 替代 emoji，域名提取显示，标题栏显示命中条数
- 搜索结果样式：卡片化分隔线、hover 高亮、三层信息架构（标题-路径-域名）

## [2.2.14] - 2026-07-30

### 功能

- 书签根目录识别策略按浏览器分类：Chrome/Edge、Firefox、QQ浏览器、自定义、自动检测
- QQ浏览器策略适配登录/未登录状态：`qq_bar` 优先书签栏回退其他书签，`qq_other` 反之
- 识别策略模块化：`detectChromeBar`、`detectChromeOther`、`detectFirefoxToolbar` 等独立函数
- 设置页路径预览为每种策略输出中文说明（含节点 ID 和适用浏览器）
- 旧值兼容映射：`bookmarks_bar` → `chrome_bar`，`other_bookmarks` → `chrome_other`，`menu_folder` → `firefox_menu`

---

## [2.2.13] - 2026-07-30

### 功能

- 下载模式支持（覆盖 / 追加）：`syncMode` 设置项，下拉选择，`downloadBookmarks` 追加模式跳过清空
- 搜索路径修复：`flattenBookmarks` 正确构建父级路径（`书签栏 > Folder > Subfolder`）
- 存储文件夹机制：`storageFolder` 设置项，下载书签统一存入书签栏下指定文件夹
- 设置页关闭按钮：右上角 `x` 关闭按钮
- 弹窗列尺寸拖拽手柄：宽度手柄（col-resize）+ 高度手柄（row-resize），尺寸写入 localStorage
- `clearAll` 操作移除 GitHub 认证校验
- `syncMode` 参数透传：confirm 对话框与实际执行行为一致

### UI

- 设置页标签合并："手动同步"+"同步设置" → "同步管理"，三子区分组（手动同步 / 自动同步 / 本地操作）
- 按钮样式：`.btn-full`、`.btn-upload`、`.btn-download`、`.btn-danger`

---

## [2.2.8] - 2026-07-29

### 功能

- 右上角补充上传按钮
- GitHub Gist 书签同步（上传 / 下载 / 清空）
- 四套主题（暗夜黑金 / 烈焰暗红 / 深海蓝夜 / 暖阳浅金）
- 双面板工作区 + 书签文件夹导航
- 书签搜索与路径过滤

### 架构

- Manifest V3，Service Worker 后台
- `chrome.storage.sync` 持久化同步配置
- `localStorage` 持久化 UI 状态
- 纯 JS/CSS，无构建工具，无包管理器
- `deployment/build.sh` 版本注入 + Firefox/Chrome 双包构建
