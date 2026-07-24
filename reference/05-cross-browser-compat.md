# 跨浏览器兼容（Chrome / Firefox）

## 概述

Chrome 和 Firefox 的书签 API 存在关键差异：**根文件夹 ID 不同**。上传时需要统一命名，下载时需要还原到各自浏览器的 ID。

## 浏览器类型检测

**文件**: `src/entrypoints/background.ts:179-188`

```typescript
async function getBookmarks() {
  let bookmarkTree: BookmarkInfo[] = await browser.bookmarks.getTree();
  if (bookmarkTree && bookmarkTree[0].id === "root________") {
    curBrowserType = BrowserType.FIREFOX;
  }
  else {
    curBrowserType = BrowserType.CHROME;
  }
  return bookmarkTree;
}
```

判断依据：Firefox 的根节点 ID 为 `"root________"`，Chrome 为 `"0"`。

## 上传：统一根文件夹名称（formatBookmarks）

**文件**: `src/entrypoints/background.ts:325-350`

```typescript
function formatBookmarks(bookmarks: BookmarkInfo[]): BookmarkInfo[] | undefined {
  if (bookmarks[0].children) {
    for (let a of bookmarks[0].children) {
      switch (a.id) {
        case "1":
        case "toolbar_____":
          a.title = RootBookmarksType.ToolbarFolder;
          break;
        case "menu________":
          a.title = RootBookmarksType.MenuFolder;
          break;
        case "2":
        case "unfiled_____":
          a.title = RootBookmarksType.UnfiledFolder;
          break;
        case "3":
        case "mobile______":
          a.title = RootBookmarksType.MobileFolder;
          break;
      }
    }
  }
  let a = format(bookmarks[0]);
  return a.children;
}
```

### 根文件夹 ID 映射关系

| 文件夹含义 | Chrome ID | Firefox ID | 统一名称（存储用） |
|-----------|-----------|------------|-------------------|
| 书签栏 | `"1"` | `"toolbar_____"` | `RootBookmarksType.ToolbarFolder` |
| 书签菜单 | `"2"` | `"menu________"` | `RootBookmarksType.MenuFolder` |
| 其他书签 | `"2"` | `"unfiled_____"` | `RootBookmarksType.UnfiledFolder` |
| 移动设备 | `"3"` | `"mobile______"` | `RootBookmarksType.MobileFolder` |

注意：Chrome 中"书签菜单"和"其他书签"共用 ID `"2"`。

## 下载：还原根文件夹的 parentId（createBookmarkTree）

**文件**: `src/entrypoints/background.ts:236-301`

```typescript
async function createBookmarkTree(bookmarkList: BookmarkInfo[] | undefined) {
  if (bookmarkList == null) return;

  for (let i = 0; i < bookmarkList.length; i++) {
    let node = bookmarkList[i];
    if (node.title == RootBookmarksType.MenuFolder
      || node.title == RootBookmarksType.MobileFolder
      || node.title == RootBookmarksType.ToolbarFolder
      || node.title == RootBookmarksType.UnfiledFolder) {
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
    // ...创建书签节点
  }
}
```

## 兼容性处理要点

### Firefox 特有兼容

```typescript
// background.ts:288-295
try {
  res = await browser.bookmarks.create({
    parentId: node.parentId,
    title: node.title,
    url: node.url
  });
} catch (err) {
  // 处理 firefox 中创建 chrome:// 格式书签会报错的问题
  console.error(res, err);
}
```

## 数据模型中的浏览器类型枚举

**文件**: `src/utils/models.ts:25-27`

```typescript
export enum BrowserType { FIREFOX, CHROME, EDGE }
export enum OperType { NONE, SYNC, CHANGE, CREATE, MOVE, REMOVE }
export enum RootBookmarksType {
  MenuFolder = "MenuFolder",
  ToolbarFolder = "ToolbarFolder",
  UnfiledFolder = "UnfiledFolder",
  MobileFolder = "MobileFolder"
}
```

## 端到端同步流程

```
浏览器 A (Chrome)                           GitHub Gist                          浏览器 B (Firefox)
─────────────────                          ───────────                          ─────────────────
getBookmarks()                                                                  
  → 检测到 Chrome (id="0")                                                         
formatBookmarks()                                                                
  "1" → "ToolbarFolder"                                                          
  "2" → "UnfiledFolder"        JSON { bookmarks:[                                 
  "3" → "MobileFolder"           { title:"ToolbarFolder", children:[...] },       
                                  { title:"UnfiledFolder", children:[...] },      
                                  { title:"MobileFolder", children:[...] }        
                                }                                                
  → BookmarkService.update() ──→──── GitHub Gist ────→ BookmarkService.get()     
                                                                    → JSON.parse()
                                                                    → 检测到 Firefox
                                                                    createBookmarkTree()
                                                                      "ToolbarFolder" → parentId="toolbar_____"
                                                                      "UnfiledFolder" → parentId="unfiled_____"
                                                                      "MobileFolder" → parentId="mobile______"
```
