# 大文件截断处理

## 问题背景

GitHub Gist API 对文件内容有大小限制。当文件超过一定大小时，API 返回的 JSON 中 `truncated` 字段为 `true`，且 `content` 字段为空或不完整。

## 实现逻辑

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

## 处理流程

```
BookmarkService.get()
  │
  ├─ GET /gists/:gistID
  │    └─ 返回 { files: { [gistFileName]: { content, truncated, raw_url } } }
  │
  ├─ truncated === false
  │    └─ 直接返回 gistFile.content（包含在 API 响应中）
  │
  └─ truncated === true
       └─ 使用 gistFile.raw_url 发起第二次 HTTP GET
            ├─ 设置 prefixUrl: '' 表示使用完整 URL 而非 API base
            └─ 返回完整文件文本内容
```

## GitHub Gist API 返回格式示例

### 未截断的响应

```json
{
  "files": {
    "BookmarkHub": {
      "filename": "BookmarkHub",
      "type": "text/plain",
      "language": null,
      "raw_url": "https://gist.githubusercontent.com/...",
      "size": 1024,
      "truncated": false,
      "content": "{\"browser\":\"...\",\"bookmarks\":[...]}"
    }
  }
}
```

### 已截断的响应

```json
{
  "files": {
    "BookmarkHub": {
      "filename": "BookmarkHub",
      "raw_url": "https://gist.githubusercontent.com/...",
      "size": 2097152,
      "truncated": true,
      "content": ""
    }
  }
}
```

## 关键实现细节

### raw_url 直连下载

```typescript
const txt = http.get(gistFile.raw_url, {prefixUrl: ''}).text();
```

- `prefixUrl: ''` 覆盖了 http 客户端默认的 `'https://api.github.com'` 前缀
- `raw_url` 格式：`https://gist.githubusercontent.com/{user}/{gist_id}/raw/{filename}`
- 使用 `.text()` 而非 `.json()`，因为原始文件可能是 JSON 字符串，需要在调用方自行 parse

### HTTP 客户端配置

**文件**: `src/utils/http.ts:13`

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
        // ...
      }
    ]
  }
});
```

`raw_url` 请求通过 `{prefixUrl: ''}` 临时覆盖 base URL，但认证 Header（Token）仍然生效，因为 `beforeRequest` hook 依然执行。

### wxt.config.ts 中的 host_permissions

```typescript
host_permissions: [
  "https://*.github.com/",
  "https://*.githubusercontent.com/"
]
```

`githubusercontent.com` 域名权限确保 raw URL 的跨域请求不会被浏览器阻止。

## 触发场景

当用户书签数量极大（如数千条，每条包含完整元数据）时，经过 JSON 序列化和 lz-string 压缩（虽然代码中未启用压缩）后，文件可能超过 Gist API 的返回大小阈值，从而触发截断分支。
