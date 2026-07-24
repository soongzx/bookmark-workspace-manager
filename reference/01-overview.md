# BookmarkHub 核心功能总览

## 架构概览

```
src/
├── entrypoints/
│   ├── background.ts          # Service Worker，核心同步逻辑
│   ├── popup/                 # Popup 弹出菜单 UI
│   │   ├── index.html
│   │   ├── popup.tsx
│   │   └── popup.css
│   └── options/               # 设置页面 UI
│       ├── index.html
│       ├── options.tsx
│       └── options.css
└── utils/
    ├── models.ts              # 数据模型定义
    ├── http.ts                # HTTP 客户端（基于 ky）
    ├── services.ts            # Gist API 服务封装
    ├── setting.ts             # 设置读取
    ├── optionsStorage.ts      # 扩展选项持久化存储
    └── icons.ts               # React 图标导出
```

## 核心功能清单

| 序号 | 功能 | 实现文件 | 状态 |
|------|------|----------|------|
| 1 | 一键上传书签到 Gist | `background.ts:81-128` | 完成 |
| 2 | 一键从 Gist 下载书签 | `background.ts:129-177` | 完成 |
| 3 | 一键清空本地所有书签 | `background.ts:190-234` | 完成 |
| 4 | 跨浏览器兼容（Chrome/Firefox） | `background.ts:179-188, 236-301, 325-350` | 完成 |
| 5 | 显示本地/远程书签数量 | `popup.tsx:13,30-36,46-47` `background.ts:318-322` | 完成 |
| 6 | GitHub Token / Gist ID / 文件名配置 | `options.tsx:20-39` | 完成 |
| 7 | 通知开关配置 | `options.tsx:41-50` | 完成 |
| 8 | 大文件截断处理 | `services.ts:11-13` | 完成 |
| 9 | 错误通知机制 | `background.ts:82-128(上传), 129-177(下载), 190-234(清空)` | 完成 |
| 10 | 自动同步书签 + 开关 | `background.ts:50-79, 366-381` | 部分完成 |

## 消息通信流程

```
Popup UI (popup.tsx)
    │ browser.runtime.sendMessage({ name: 'upload'/'download'/'removeAll' })
    ▼
Background Service Worker (background.ts)
    │ browser.runtime.onMessage.addListener
    ├── 'upload'   → uploadBookmarks()  → BookmarkService.update() → GitHub Gist API
    ├── 'download' → downloadBookmarks() → BookmarkService.get()   → GitHub Gist API
    ├── 'removeAll'→ clearBookmarkTree()
    └── 'setting'  → browser.runtime.openOptionsPage()
```

## 数据模型

```
SyncDataInfo (同步数据结构体)
├── browser: string         # 浏览器标识
├── version: string         # 插件版本
├── createDate: number      # 创建时间戳
└── bookmarks: BookmarkInfo[]  # 格式化后的书签树

BookmarkInfo (书签节点)
├── id?: string
├── parentId?: string
├── title: string
├── url?: string
├── dateAdded?: number
├── type?: "bookmark" | "folder" | "separator"
└── children?: BookmarkInfo[]  # 递归子节点
```

## 依赖关系

```
utils/models.ts   ← 数据模型，无外部依赖
utils/setting.ts  ← 依赖 optionsStorage.ts, models.ts（间接）
utils/optionsStorage.ts ← 依赖 webext-options-sync
utils/http.ts     ← 依赖 ky, setting.ts
utils/services.ts ← 依赖 http.ts, setting.ts
background.ts     ← 依赖 services.ts, setting.ts, models.ts
popup.tsx         ← 依赖 React + Bootstrap
options.tsx       ← 依赖 React + Bootstrap + optionsStorage.ts
```
