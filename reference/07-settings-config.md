# 设置配置（Token / GistID / GistFileName / 通知开关）

## 实现涉及的文件

| 文件 | 作用 |
|------|------|
| `src/utils/optionsStorage.ts` | 选项持久化存储（基于 webext-options-sync） |
| `src/utils/setting.ts` | 设置读取封装 |
| `src/entrypoints/options/options.tsx` | 设置页面 UI |
| `src/entrypoints/options/index.html` | 设置页面入口 HTML |
| `wxt.config.ts` | manifest 权限声明 |

## 选项存储

**文件**: `src/utils/optionsStorage.ts`

```typescript
import OptionsSync from 'webext-options-sync';

export default new OptionsSync({
  defaults: {
    githubToken: '',
    gistID: '',
    gistFileName: 'BookmarkHub',
    enableNotify: true,
    githubURL: 'https://api.github.com',
  },
  migrations: [
    (savedOptions, currentDefaults) => {
      // 版本迁移钩子（当前为空）
    },
    OptionsSync.migrations.removeUnused
  ],
  logging: false
});
```

## 设置读取

**文件**: `src/utils/setting.ts`

```typescript
import { Options } from 'webext-options-sync';
import optionsStorage from './optionsStorage'

export class SettingBase implements Options {
  constructor() { }
  [key: string]: string | number | boolean;
  githubToken: string = '';
  gistID: string = '';
  gistFileName: string = 'BookmarkHub';
  enableNotify: boolean = true;
  githubURL: string = 'https://api.github.com';
}

export class Setting extends SettingBase {
  private constructor() { super() }
  static async build() {
    let options = await optionsStorage.getAll();
    let setting = new Setting();
    setting.gistID = options.gistID;
    setting.gistFileName = options.gistFileName;
    setting.githubToken = options.githubToken;
    setting.enableNotify = options.enableNotify;
    return setting;
  }
}
```

## 设置页面 UI

**文件**: `src/entrypoints/options/options.tsx`

```tsx
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client';
import { Container, Form, Button, Col, Row, InputGroup } from 'react-bootstrap';
import { useForm } from "react-hook-form";
import 'bootstrap/dist/css/bootstrap.min.css';
import './options.css'
import optionsStorage from '../../utils/optionsStorage'

const Popup: React.FC = () => {
  const { register, setValue } = useForm();

  useEffect(() => {
    optionsStorage.syncForm('#formOptions');
  }, [])

  return (
    <Container>
      <Form id='formOptions' name='formOptions'>
        {/* GitHub Token */}
        <Form.Group as={Row}>
          <Form.Label column="sm" sm={3} lg={2} xs={3}>
            {browser.i18n.getMessage('githubToken')}
          </Form.Label>
          <Col sm={9} lg={10} xs={9}>
            <InputGroup size="sm">
              <Form.Control name="githubToken" ref={register}
                type="text" placeholder="github token" size="sm" />
              <InputGroup.Append>
                <Button variant="outline-secondary" as="a" target="_blank"
                  href="https://github.com/settings/tokens/new"
                  size="sm">Get Token</Button>
              </InputGroup.Append>
            </InputGroup>
          </Col>
        </Form.Group>

        {/* Gist ID */}
        <Form.Group as={Row}>
          <Form.Label column="sm" sm={3} lg={2} xs={3}>
            {browser.i18n.getMessage('gistID')}
          </Form.Label>
          <Col sm={9} lg={10} xs={9}>
            <Form.Control name="gistID" ref={register}
              type="text" placeholder="gist ID" size="sm" />
          </Col>
        </Form.Group>

        {/* Gist 文件名 */}
        <Form.Group as={Row}>
          <Form.Label column="sm" sm={3} lg={2} xs={3}>
            {browser.i18n.getMessage('gistFileName')}
          </Form.Label>
          <Col sm={9} lg={10} xs={9}>
            <Form.Control name="gistFileName" ref={register}
              type="text" placeholder="gist file name" size="sm" />
          </Col>
        </Form.Group>

        {/* 通知开关 */}
        <Form.Group as={Row}>
          <Form.Label column="sm" sm={3} lg={2} xs={3}>
            {browser.i18n.getMessage('enableNotifications')}
          </Form.Label>
          <Col sm={9} lg={10} xs={9}>
            <Form.Check id="enableNotify" name="enableNotify"
              ref={register} type="switch" />
          </Col>
        </Form.Group>

        {/* 帮助链接 */}
        <Form.Group as={Row}>
          <Form.Label column="sm" sm={3} lg={2} xs={3}></Form.Label>
          <Col sm={9} lg={10} xs={9}>
            <a href="https://github.com/dudor/BookmarkHub"
              target="_blank">
              {browser.i18n.getMessage('help')}
            </a>
          </Col>
        </Form.Group>
      </Form>
    </Container>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
```

## 表单自动同步机制

`optionsStorage.syncForm('#formOptions')` 利用 `webext-options-sync` 的自动绑定：
- 表单字段 `name` 属性与 storage key 对应
- 用户修改表单自动保存到 `browser.storage.sync`
- 页面加载时从 storage 回填表单

## 设置页面入口

**文件**: `src/entrypoints/popup/popup.tsx:44`

```tsx
<Dropdown.Item name='setting' as="button">
  <AiOutlineSetting />
  {browser.i18n.getMessage('settings')}
</Dropdown.Item>
```

**文件**: `src/entrypoints/background.ts:43-47`

```typescript
if (msg.name === 'setting') {
  browser.runtime.openOptionsPage().then(() => {
    sendResponse(true);
  });
}
```

## manifest 权限

**文件**: `wxt.config.ts:12-14`

```typescript
permissions: ['storage', 'bookmarks', 'notifications'],
host_permissions: ["https://*.github.com/", "https://*.githubusercontent.com/"],
```

- `storage`: 读取/写入 `browser.storage.local` 和 `browser.storage.sync`
- `bookmarks`: 操作浏览器书签 API
- `notifications`: 显示系统通知
- `host_permissions`: 访问 GitHub API 和 GitHub raw content 域名

## 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `githubToken` | string | `""` | GitHub Personal Access Token，需 `gist` scope |
| `gistID` | string | `""` | GitHub Gist ID（URL 中最后一段） |
| `gistFileName` | string | `"BookmarkHub"` | Gist 中存储书签数据的文件名 |
| `enableNotify` | boolean | `true` | 操作完成/失败后是否弹出浏览器通知 |
| `githubURL` | string | `"https://api.github.com"` | GitHub API 基础地址（已定义但实际由 http.ts 硬编码） |
