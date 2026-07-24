# 一键上传书签到 Gist

## 入口与调用链

```
Popup (popup.tsx)
  → browser.runtime.sendMessage({ name: 'upload' })
    → background.ts onMessage listener
      → uploadBookmarks()
```

## 核心实现逻辑

**文件**: `src/entrypoints/background.ts:81-128`

### 实现步骤

1. 校验设置：检查 `githubToken`、`gistID`、`gistFileName` 是否为空
2. 获取本地书签树：调用 `browser.bookmarks.getTree()`
3. 格式化书签数据：通过 `formatBookmarks()` 去掉浏览器特有字段（id、index、parentId 等），统一书签文件夹名称
4. 构建同步数据结构体 `SyncDataInfo`，写入版本、时间、浏览器信息
5. 调用 `BookmarkService.update()` 将 JSON 写入 GitHub Gist
6. 更新远程书签计数：写入 `browser.storage.local`
7. 发送成功/失败通知

### 核心代码

```typescript
async function uploadBookmarks() {
  try {
    let setting = await Setting.build()
    if (setting.githubToken == '') {
      throw new Error("Gist Token Not Found");
    }
    if (setting.gistID == '') {
      throw new Error("Gist ID Not Found");
    }
    if (setting.gistFileName == '') {
      throw new Error("Gist File Not Found");
    }
    let bookmarks = await getBookmarks();
    let syncdata = new SyncDataInfo();
    syncdata.version = browser.runtime.getManifest().version;
    syncdata.createDate = Date.now();
    syncdata.bookmarks = formatBookmarks(bookmarks);
    syncdata.browser = navigator.userAgent;
    await BookmarkService.update({
      files: {
        [setting.gistFileName]: {
          content: JSON.stringify(syncdata)
        }
      },
      description: setting.gistFileName
    });
    const count = getBookmarkCount(syncdata.bookmarks);
    await browser.storage.local.set({ remoteCount: count });
    if (setting.enableNotify) {
      await browser.notifications.create({
        type: "basic",
        iconUrl: iconLogo,
        title: browser.i18n.getMessage('uploadBookmarks'),
        message: browser.i18n.getMessage('success')
      });
    }
  }
  catch (error: any) {
    console.error(error);
    await browser.notifications.create({
      type: "basic",
      iconUrl: iconLogo,
      title: browser.i18n.getMessage('uploadBookmarks'),
      message: `${browser.i18n.getMessage('error')}：${error.message}`
    });
  }
}
```

### Gist 更新 API 调用

**文件**: `src/utils/services.ts:24-27`

```typescript
async update(data: any) {
  let setting = await Setting.build();
  return http.patch(`gists/${setting.gistID}`, { json: data }).json();
}
```

### HTTP 客户端自动注入认证

**文件**: `src/utils/http.ts:13-29`

```typescript
export const http = ky.create({
  prefixUrl: 'https://api.github.com',
  timeout: 60000,
  retry: 1,
  hooks: {
    beforeRequest: [
      async request => {
        let setting = await Setting.build();
        request.headers.set('Authorization', `Bearer ${setting.githubToken}`);
        request.headers.set('Content-Type', `application/json;charset=utf-8`);
        request.headers.set('X-GitHub-Api-Version', `2022-11-28`);
        request.headers.set('Accept', `application/vnd.github+json`);
        request.headers.set('cache', 'no-store');
      }
    ]
  }
});
```

## 关键数据流

```
browser.bookmarks.getTree()
  → [{ id, title, children: [...] }] (原始书签树)
    → formatBookmarks()
      → 统一根文件夹名称 (menu→"MenuFolder", toolbar→"ToolbarFolder" 等)
      → format() 递归清除浏览器特有字段 (id, index, parentId, dateAdded 等)
    → SyncDataInfo JSON
      → BookmarkService.update() → PATCH /gists/:gistID
        → GitHub Gist 存储
```
