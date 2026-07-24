# BookmarkHub 核心功能代码参考

> 所有代码片段基于 `src/` 目录下的源码提取，保留原始文件和行号引用。

## 文档索引

| 文档 | 内容 |
|------|------|
| [01-概述](01-overview.md) | 项目架构、消息通信流程、数据模型、依赖关系 |
| [02-上传书签](02-upload-bookmarks.md) | 一键上传书签到 GitHub Gist 的完整实现 |
| [03-下载书签](03-download-bookmarks.md) | 一键从 Gist 下载并重建本地书签树 |
| [04-清空书签](04-clear-bookmarks.md) | 一键清空本地所有书签，保留根文件夹结构 |
| [05-跨浏览器兼容](05-cross-browser-compat.md) | Chrome/Firefox 根文件夹 ID 映射与转换 |
| [06-书签计数](06-bookmark-count-display.md) | 本地/远程书签数量统计与 Badge 提示 |
| [07-设置配置](07-settings-config.md) | Token/GistID/FileName/通知开关配置与持久化 |
| [08-大文件处理](08-large-file-handling.md) | Gist API 截断文件的 raw_url 回退下载 |
| [09-错误通知](09-error-notification.md) | 统一错误处理 + 浏览器原生通知反馈 |
| [10-自动同步](10-auto-sync.md) | 书签变更监听 + Badge 提示 + 待实现方案 |

## 代码片段文件

| 文件 | 内容 |
|------|------|
| [snippets/background.ts](snippets/background.ts) | 完整 background.ts 源码（核心同步逻辑） |
| [snippets/services.ts](snippets/services.ts) | Gist 服务封装 |
| [snippets/http.ts](snippets/http.ts) | HTTP 客户端配置 |
| [snippets/models.ts](snippets/models.ts) | 数据模型定义 |
| [snippets/setting.ts](snippets/setting.ts) | 设置读取 |
| [snippets/optionsStorage.ts](snippets/optionsStorage.ts) | 选项持久化 |
| [snippets/popup.tsx](snippets/popup.tsx) | Popup UI 组件 |
| [snippets/options.tsx](snippets/options.tsx) | 设置页面 UI |

## 快速定位

如需查找特定功能的实现，在源码中的位置：

```
一键上传:  src/entrypoints/background.ts:81-128    (uploadBookmarks)
一键下载:  src/entrypoints/background.ts:129-177   (downloadBookmarks)
一键清空:  src/entrypoints/background.ts:190-234   (clearBookmarkTree)
书签重建:  src/entrypoints/background.ts:236-301   (createBookmarkTree)
格式化:    src/entrypoints/background.ts:325-364   (formatBookmarks, format)
计数统计:  src/entrypoints/background.ts:303-322   (getBookmarkCount, refreshLocalCount)
变更监听:  src/entrypoints/background.ts:50-79     (onCreated/Changed/Moved/Removed)
Gist读取:  src/utils/services.ts:4-20              (BookmarkService.get)
Gist更新:  src/utils/services.ts:24-27             (BookmarkService.update)
HTTP配置:  src/utils/http.ts:13-29                 (ky.create)
数据模型:  src/utils/models.ts:1-27                (BookmarkInfo, SyncDataInfo, Enums)
设置读取:  src/utils/setting.ts:12-23              (Setting.build)
选项存储:  src/utils/optionsStorage.ts:4-27        (OptionsSync)
Popup UI:  src/entrypoints/popup/popup.tsx:12-60    (Popup component)
设置 UI:   src/entrypoints/options/options.tsx:8-68 (Popup component)
```
