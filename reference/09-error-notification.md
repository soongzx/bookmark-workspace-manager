# 错误通知机制

## 概述

所有核心操作（上传、下载、清空）均包含完整的错误处理链：前置校验 → try/catch 捕获 → 浏览器原生通知反馈。

## 统一通知模式

每个操作函数使用相同的代码结构：

```typescript
async function operation() {
  try {
    // 1. 前置校验（Token / GistID / FileName 是否为空）
    let setting = await Setting.build()
    if (setting.githubToken == '') throw new Error("Gist Token Not Found");
    if (setting.gistID == '') throw new Error("Gist ID Not Found");
    if (setting.gistFileName == '') throw new Error("Gist File Not Found");

    // 2. 执行业务逻辑
    // ...

    // 3. 成功通知（仅在 enableNotify 为 true 时）
    if (setting.enableNotify) {
      await browser.notifications.create({
        type: "basic",
        iconUrl: iconLogo,
        title: browser.i18n.getMessage('operationName'),
        message: browser.i18n.getMessage('success')
      });
    }
  }
  catch (error: any) {
    // 4. 错误日志 + 错误通知（始终发送）
    console.error(error);
    await browser.notifications.create({
      type: "basic",
      iconUrl: iconLogo,
      title: browser.i18n.getMessage('operationName'),
      message: `${browser.i18n.getMessage('error')}：${error.message}`
    });
  }
}
```

## 上传书签的错误处理

**文件**: `src/entrypoints/background.ts:81-128`

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
    // ...业务逻辑...

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

## 下载书签的错误处理

**文件**: `src/entrypoints/background.ts:129-177`

下载操作除通用错误外，还有两类特殊的错误分支：

```typescript
// 分支1：Gist 文件不存在
else {
  await browser.notifications.create({
    type: "basic",
    iconUrl: iconLogo,
    title: browser.i18n.getMessage('downloadBookmarks'),
    message: `${browser.i18n.getMessage('error')}：Gist File ${setting.gistFileName} Not Found`
  });
}

// 分支2：Gist 文件内容为空
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
```

## 清空书签的错误处理

**文件**: `src/entrypoints/background.ts:190-234`

清空操作中，成功通知仅在 `curOperType === OperType.REMOVE` 时发送（区分用户主动清空 vs 下载前的自动清空）：

```typescript
if (curOperType === OperType.REMOVE && setting.enableNotify) {
  await browser.notifications.create({
    type: "basic",
    iconUrl: iconLogo,
    title: browser.i18n.getMessage('removeAllBookmarks'),
    message: browser.i18n.getMessage('success')
  });
}
```

## 通知 icon

所有通知使用扩展图标：`src/assets/icon.png`

```typescript
import iconLogo from '../assets/icon.png';
```

## i18n 翻译 key

| Key | 英文 | 中文 |
|-----|------|------|
| `success` | "Success" | "成功" |
| `failed` | "Failed" | "失败" |
| `error` | "Error" | "错误" |
| `uploadBookmarks` | "Upload Bookmarks" | "上传书签" |
| `downloadBookmarks` | "DownLoad Bookmarks" | "下载书签" |
| `removeAllBookmarks` | "Remove All Bookmarks" | "清空本地书签" |

## 错误通知设计原则

| 原则 | 实现方式 |
|------|----------|
| 用户可见 | 使用浏览器原生 `browser.notifications.create` API |
| 信息完整 | 通知标题 + 内容包含操作名 + 具体错误 message |
| 开发可调试 | 所有错误通过 `console.error` 输出到 Service Worker 控制台 |
| 成功可控 | 成功通知受 `enableNotify` 开关控制 |
| 错误必须 | 错误通知不受开关控制，始终发送 |
| 上下文隔离 | `curOperType` 区分用户主动操作 vs 程序内部操作（避免下载前清空触发误通知） |
