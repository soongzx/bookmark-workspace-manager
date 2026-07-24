# 自动同步书签 + 开关

## 当前状态：部分完成

自动同步功能的基础设施已就绪，但核心同步逻辑未启用。

## 已实现的基础设施

### 书签变更监听（已启用）

**文件**: `src/entrypoints/background.ts:50-79`

```typescript
// 操作类型状态管理
let curOperType = OperType.NONE;

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

`OperType` 状态机确保仅在用户手动操作（非程序上传/下载/清空）时触发 Badge 提示：

```
curOperType 状态流转：
  NONE ──(用户点击上传)──→ SYNC ──(上传完成)──→ NONE
  NONE ──(用户点击下载)──→ SYNC ──(下载完成)──→ NONE
  NONE ──(用户点击清空)──→ REMOVE ──(清空完成)──→ NONE
```

### 本地备份功能（已实现但注释掉）

**文件**: `src/entrypoints/background.ts:366-381`

```typescript
///暂时不启用自动备份
/*
async function backupToLocalStorage(bookmarks: BookmarkInfo[]) {
    try {
        let syncdata = new SyncDataInfo();
        syncdata.version = browser.runtime.getManifest().version;
        syncdata.createDate = Date.now();
        syncdata.bookmarks = formatBookmarks(bookmarks);
        syncdata.browser = navigator.userAgent;
        const keyname = 'BookmarkHub_backup_' + Date.now().toString();
        await browser.storage.local.set({ [keyname]: JSON.stringify(syncdata) });
    }
    catch (error:any) {
        console.error(error)
    }
}
*/
```

## 待完善：自动同步逻辑

自动同步功能需要实现以下部分：

### 1. 变更检测后的自动上传

```typescript
// 伪代码 - 需在 onCreated/onChanged/onMoved/onRemoved 中添加
browser.bookmarks.onCreated.addListener((id, info) => {
  if (curOperType === OperType.NONE && autoSyncEnabled) {
    debouncedUpload();  // 防抖上传，避免频繁操作
  }
});
```

### 2. 防抖机制

避免用户连续操作书签时频繁调用 GitHub API：

```typescript
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    uploadBookmarks();
  }, 5000); // 5 秒防抖
}
```

### 3. 自动同步开关

需要在设置页面添加 `autoSync` 开关：

```typescript
// optionsStorage.ts 添加默认值
defaults: {
  // ...existing...
  autoSync: false,
}

// options.tsx 添加 UI 控件
<Form.Group as={Row}>
  <Form.Label>自动同步</Form.Label>
  <Col>
    <Form.Check id="autoSync" name="autoSync"
      ref={register} type="switch" />
  </Col>
</Form.Group>
```

### 4. 定期同步（定时器方案）

```typescript
// 创建定时器 Alarm
browser.alarms.create('autoSync', { periodInMinutes: 30 });

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoSync') {
    uploadBookmarks();
  }
});
```

需要更新 manifest 权限，添加 `alarms`。

## 当前 Badge 提示机制的作用

当前 Badge "!" 提示作为轻量替代方案，提醒用户"书签已变更，请手动同步"。扩展图标出现红色 "!" 表示本地书签与远程不一致。

## 实现路径建议

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| 1 | 添加 `autoSync` 设置项 + UI 开关 | 高 |
| 2 | 实现变更监听 → 防抖 → 自动上传 | 高 |
| 3 | 实现定时同步（Alarm API） | 中 |
| 4 | 启用 `backupToLocalStorage` 本地备份 | 低 |
| 5 | 冲突检测与合并策略 | 低 |
