# 一键从 Gist 下载书签

## 入口与调用链

```
Popup (popup.tsx)
  → browser.runtime.sendMessage({ name: 'download' })
    → background.ts onMessage listener
      → downloadBookmarks()
```

## 核心实现逻辑

**文件**: `src/entrypoints/background.ts:129-177`

### 实现步骤

1. 调用 `BookmarkService.get()` 从 Gist 获取书签数据
2. 校验远程数据：检查 `bookmarks` 字段是否为空
3. 调用 `clearBookmarkTree()` 清空本地书签（保护根文件夹结构）
4. 调用 `createBookmarkTree()` 逐节点重建本地书签树
5. 更新远程书签计数到 `browser.storage.local`
6. 发送成功/失败通知

### 核心代码

```typescript
async function downloadBookmarks() {
  try {
    let gist = await BookmarkService.get();
    let setting = await Setting.build()
    if (gist) {
      let syncdata: SyncDataInfo = JSON.parse(gist);
      if (syncdata.bookmarks == undefined || syncdata.bookmarks.length == 0) {
        if (setting.enableNotify) {
          await browser.notifications.create({
            type: "basic",
            iconUrl: iconLogo,
            title: browser.i18n.getMessage('downloadBookmarks'),
            message: `${browser.i18n.getMessage('error')}：Gist File ${setting.gistFileName} is NULL`
          });
        }
        return;
      }
      await clearBookmarkTree();
      await createBookmarkTree(syncdata.bookmarks);
      const count = getBookmarkCount(syncdata.bookmarks);
      await browser.storage.local.set({ remoteCount: count });
      if (setting.enableNotify) {
        await browser.notifications.create({
          type: "basic",
          iconUrl: iconLogo,
          title: browser.i18n.getMessage('downloadBookmarks'),
          message: browser.i18n.getMessage('success')
        });
      }
    }
    else {
      await browser.notifications.create({
        type: "basic",
        iconUrl: iconLogo,
        title: browser.i18n.getMessage('downloadBookmarks'),
        message: `${browser.i18n.getMessage('error')}：Gist File ${setting.gistFileName} Not Found`
      });
    }
  }
  catch (error: any) {
    console.error(error);
    await browser.notifications.create({
      type: "basic",
      iconUrl: iconLogo,
      title: browser.i18n.getMessage('downloadBookmarks'),
      message: `${browser.i18n.getMessage('error')}：${error.message}`
    });
  }
}
```

### Gist 读取 API 调用

**文件**: `src/utils/services.ts:4-20`

```typescript
async get() {
  let setting = await Setting.build();
  let resp = await http.get(`gists/${setting.gistID}`).json() as any
  if (resp?.files) {
    let filenames = Object.keys(resp.files);
    if (filenames.indexOf(setting.gistFileName) !== -1) {
      let gistFile = resp.files[setting.gistFileName]
      if (gistFile.truncated) {
        const txt = http.get(gistFile.raw_url, {prefixUrl: ''}).text();
        return txt;
      } else {
        return gistFile.content
      }
    }
  }
  return null;
}
```

### 书签树重建

**文件**: `src/entrypoints/background.ts:236-301`

```typescript
async function createBookmarkTree(bookmarkList: BookmarkInfo[] | undefined) {
  if (bookmarkList == null) {
    return;
  }
  for (let i = 0; i < bookmarkList.length; i++) {
    let node = bookmarkList[i];
    // 处理根文件夹：根据浏览器类型分配正确的 parentId
    if (node.title == RootBookmarksType.MenuFolder
      || node.title == RootBookmarksType.MobileFolder
      || node.title == RootBookmarksType.ToolbarFolder
      || node.title == RootBookmarksType.UnfiledFolder) {
      // 为子节点设置正确的 parentId（Chrome 用数字, Firefox 用字符串）
      if (curBrowserType == BrowserType.FIREFOX) {
        switch (node.title) {
          case RootBookmarksType.MenuFolder:
            node.children?.forEach(c => c.parentId = "menu________");
            break;
          case RootBookmarksType.MobileFolder:
            node.children?.forEach(c => c.parentId = "mobile______");
            break;
          case RootBookmarksType.ToolbarFolder:
            node.children?.forEach(c => c.parentId = "toolbar_____");
            break;
          case RootBookmarksType.UnfiledFolder:
            node.children?.forEach(c => c.parentId = "unfiled_____");
            break;
        }
      } else {
        switch (node.title) {
          case RootBookmarksType.MobileFolder:
            node.children?.forEach(c => c.parentId = "3");
            break;
          case RootBookmarksType.ToolbarFolder:
            node.children?.forEach(c => c.parentId = "1");
            break;
          case RootBookmarksType.UnfiledFolder:
          case RootBookmarksType.MenuFolder:
            node.children?.forEach(c => c.parentId = "2");
            break;
        }
      }
      await createBookmarkTree(node.children);
      continue;
    }
    // 创建书签节点
    let res: Bookmarks.BookmarkTreeNode = { id: '', title: '' };
    try {
      res = await browser.bookmarks.create({
        parentId: node.parentId,
        title: node.title,
        url: node.url
      });
    } catch (err) {
      // Firefox 中 chrome:// URL 会创建失败
      console.error(res, err);
    }
    // 递归创建子节点
    if (res.id && node.children && node.children.length > 0) {
      node.children.forEach(c => c.parentId = res.id);
      await createBookmarkTree(node.children);
    }
  }
}
```

## 关键数据流

```
GitHub Gist
  → GET /gists/:gistID
    → JSON { files: { [gistFileName]: { content, truncated, raw_url } } }
      → 若 truncated → GET raw_url (绕过截断)
      → JSON.parse → SyncDataInfo { bookmarks: [...] }
        → clearBookmarkTree() 清空本地
        → createBookmarkTree() 逐节点调用 browser.bookmarks.create()
          → 本地浏览器 Chrome Bookmark API
```
