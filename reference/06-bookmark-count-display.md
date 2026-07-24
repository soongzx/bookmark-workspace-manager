# 显示本地/远程书签数量

## 功能概述

在插件弹窗中显示本地和远程书签数量，并通过扩展图标 Badge 提示书签变更状态。

## 实现涉及的文件

| 文件 | 作用 |
|------|------|
| `background.ts:303-322` | 计数逻辑 + 存储更新 |
| `background.ts:50-79` | 书签变更监听 + Badge 显示 |
| `popup.tsx:13,30-36,46-47` | UI 显示 |

## 计数逻辑

**文件**: `src/entrypoints/background.ts:303-316`

```typescript
function getBookmarkCount(bookmarkList: BookmarkInfo[] | undefined) {
  let count = 0;
  if (bookmarkList) {
    bookmarkList.forEach(c => {
      if (c.url) {
        count = count + 1;
      }
      else {
        count = count + getBookmarkCount(c.children);
      }
    });
  }
  return count;
}
```

只统计**有 URL 的叶子节点**（`c.url` 存在），文件夹不计数。递归遍历整个书签树。

## 刷新本地计数

**文件**: `src/entrypoints/background.ts:318-322`

```typescript
async function refreshLocalCount() {
  let bookmarkList = await getBookmarks();
  const count = getBookmarkCount(bookmarkList);
  await browser.storage.local.set({ localCount: count });
}
```

调用时机：
- 插件启动时
- 上传/下载/清空操作完成后
- 书签创建/删除事件触发时

## 存储远程计数

上传和下载操作完成后，更新 `remoteCount` 到 storage：

```typescript
// uploadBookmarks() 中
const count = getBookmarkCount(syncdata.bookmarks);
await browser.storage.local.set({ remoteCount: count });

// downloadBookmarks() 中
const count = getBookmarkCount(syncdata.bookmarks);
await browser.storage.local.set({ remoteCount: count });
```

## Popup UI 显示

**文件**: `src/entrypoints/popup/popup.tsx:13,30-36,46-47`

```tsx
const [count, setCount] = useState({ local: "0", remote: "0" })

useEffect(() => {
  let getSetting = async () => {
    let data = await browser.storage.local.get(["localCount", "remoteCount"]);
    setCount({ local: data["localCount"], remote: data["remoteCount"] });
  }
  getSetting();
}, [])

// 渲染
<Badge id="localCount" variant="light"
  title={browser.i18n.getMessage('localCount')}>
  {count["local"]}
</Badge>
/
<Badge id="remoteCount" variant="light"
  title={browser.i18n.getMessage('remoteCount')}>
  {count["remote"]}
</Badge>
```

## 书签变更 Badge 提示

**文件**: `src/entrypoints/background.ts:50-79`

```typescript
browser.bookmarks.onCreated.addListener((id, info) => {
  if (curOperType === OperType.NONE) {
    browser.action.setBadgeText({ text: "!" });
    browser.action.setBadgeBackgroundColor({ color: "#F00" });
    refreshLocalCount();
  }
});
browser.bookmarks.onChanged.addListener((id, info) => {
  if (curOperType === OperType.NONE) {
    browser.action.setBadgeText({ text: "!" });
    browser.action.setBadgeBackgroundColor({ color: "#F00" });
  }
});
browser.bookmarks.onMoved.addListener((id, info) => {
  if (curOperType === OperType.NONE) {
    browser.action.setBadgeText({ text: "!" });
    browser.action.setBadgeBackgroundColor({ color: "#F00" });
  }
});
browser.bookmarks.onRemoved.addListener((id, info) => {
  if (curOperType === OperType.NONE) {
    browser.action.setBadgeText({ text: "!" });
    browser.action.setBadgeBackgroundColor({ color: "#F00" });
    refreshLocalCount();
  }
});
```

`curOperType === OperType.NONE` 确保仅在非程序操作（用户手动增删改书签）时才显示 Badge，避免上传/下载/清空操作期间误触发。

## 状态流图

```
用户点击 Popup
  → useEffect → browser.storage.local.get → setCount

用户修改书签（非程序操作）
  → onCreated/onRemoved → refreshLocalCount() → storage.local.set({ localCount })
  → onCreated/onChanged/onMoved/onRemoved → setBadgeText("!") + 红色 Badge

上传操作完成
  → getBookmarkCount(formatted) → storage.local.set({ remoteCount })
  → refreshLocalCount() → storage.local.set({ localCount })
  → setBadgeText("") (清除 Badge)

下载操作完成
  → getBookmarkCount(downloaded) → storage.local.set({ remoteCount })
  → refreshLocalCount() → storage.local.set({ localCount })
  → setBadgeText("") (清除 Badge)
```
