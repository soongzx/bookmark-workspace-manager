# 一键清空本地所有书签

## 入口与调用链

```
Popup (popup.tsx)
  → browser.runtime.sendMessage({ name: 'removeAll' })
    → background.ts onMessage listener
      → clearBookmarkTree()
```

## 核心实现逻辑

**文件**: `src/entrypoints/background.ts:190-234`

### 实现步骤

1. 校验设置（Token、Gist ID、文件名）
2. 获取当前书签树
3. 提取根文件夹（如 "1"/"2"/"3" 或 "menu"/"toolbar"/"unfiled"/"mobile"）下的所有一级子节点
4. 逐个调用 `browser.bookmarks.removeTree(node.id)` 删除
5. 更新本地计数
6. 发送成功/失败通知

### 核心代码

```typescript
async function clearBookmarkTree() {
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
    let tempNodes: BookmarkInfo[] = [];
    bookmarks[0].children?.forEach(c => {
      c.children?.forEach(d => {
        tempNodes.push(d)
      })
    });
    if (tempNodes.length > 0) {
      for (let node of tempNodes) {
        if (node.id) {
          await browser.bookmarks.removeTree(node.id)
        }
      }
    }
    if (curOperType === OperType.REMOVE && setting.enableNotify) {
      await browser.notifications.create({
        type: "basic",
        iconUrl: iconLogo,
        title: browser.i18n.getMessage('removeAllBookmarks'),
        message: browser.i18n.getMessage('success')
      });
    }
  }
  catch (error: any) {
    console.error(error);
    await browser.notifications.create({
      type: "basic",
      iconUrl: iconLogo,
      title: browser.i18n.getMessage('removeAllBookmarks'),
      message: `${browser.i18n.getMessage('error')}：${error.message}`
    });
  }
}
```

### 书签树结构与清理策略

```
root (根节点)
├── "0" (Other Bookmarks, parentId=0)
│   ├── 书签 A ──── 遍历并 removeTree
│   ├── 文件夹 B ──── 遍历并 removeTree
│   └── ...
├── "1" (书签栏/Toolbar, parentId=0)
│   ├── 书签 C ──── 遍历并 removeTree
│   └── ...
├── "2" (其他书签/Other, parentId=0)  ── Firebase 中 Chrome 的 "2" = "menu________"
│   ├── ...
│   └── ...
├── "3" (移动设备/Mobile, parentId=0)
│   └── ...
└── (Firefox: "menu________", "toolbar_____", "unfiled_____", "mobile______")
```

### 清理策略要点

- 只删除**根文件夹下的直接子节点**（bookmarks[0].children[].children[]），保留根文件夹结构
- 使用 `browser.bookmarks.removeTree(id)` 递归删除整个子树
- `OperType` 状态控制通知行为：仅在用户主动执行 removeAll 操作时发送成功通知

### Popup 触发入口

**文件**: `src/entrypoints/popup/popup.tsx:42`

```tsx
<Dropdown.Item name='removeAll' as="button"
  title={browser.i18n.getMessage('removeAllBookmarksDesc')}>
  <AiOutlineClear />
  {browser.i18n.getMessage('removeAllBookmarks')}
</Dropdown.Item>
```

### 消息分发

**文件**: `src/entrypoints/background.ts:33-42`

```typescript
if (msg.name === 'removeAll') {
  curOperType = OperType.REMOVE
  clearBookmarkTree().then(() => {
    curOperType = OperType.NONE
    browser.action.setBadgeText({ text: "" });
    refreshLocalCount();
    sendResponse(true);
  });
}
```
