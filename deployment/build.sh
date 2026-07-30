#!/bin/bash
# ==============================================
# 收藏夹工作区管理系统 - 打包交付物脚本
# 从 VERSION 文件读取版本号，注入 manifest.json，
# 分别生成 Firefox (.zip) 和 Chrome (.zip + .crx) 交付物
# ==============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION_FILE="$PROJECT_DIR/VERSION"
MANIFEST_FILE="$PROJECT_DIR/manifest.json"
MANIFEST_BACKUP="$PROJECT_DIR/manifest.json.bak"
OUTPUT_DIR="$PROJECT_DIR/dist"
KEY_FILE="$SCRIPT_DIR/key.pem"
EXTENSION_NAME="bookmark-workspace-manager"

# 读取版本号并自动递增第3位
if [ ! -f "$VERSION_FILE" ]; then
    echo "[ERROR] VERSION 文件不存在: $VERSION_FILE"
    exit 1
fi

RAW_VERSION=$(head -n 1 "$VERSION_FILE" | tr -d '[:space:]')
if [ -z "$RAW_VERSION" ]; then
    echo "[ERROR] VERSION 文件为空"
    exit 1
fi

# 解析 x.x.x 格式，去掉第3位之后的内容
MAJOR=$(echo "$RAW_VERSION" | cut -d. -f1)
MINOR=$(echo "$RAW_VERSION" | cut -d. -f2)
PATCH=$(echo "$RAW_VERSION" | cut -d. -f3 | grep -o '^[0-9]*' || echo "0")

# 自动递增第3位
NEW_PATCH=$((PATCH + 1))
if [ "$NEW_PATCH" -gt 999 ]; then
    echo "[ERROR] 版本号第3位超过 999，请手动重置"
    exit 1
fi

VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
echo "$VERSION" > "$VERSION_FILE"
echo "[INFO] 版本号自动递增: $RAW_VERSION -> $VERSION"

# 备份原始 manifest.json 和 background.js
cp "$MANIFEST_FILE" "$MANIFEST_BACKUP"
cp "$PROJECT_DIR/background.js" "$PROJECT_DIR/background.js.bak"
trap 'echo "[INFO] 恢复原始文件"; mv "$MANIFEST_BACKUP" "$MANIFEST_FILE"; mv "$PROJECT_DIR/background.js.bak" "$PROJECT_DIR/background.js"' EXIT

# ===================
# 通用：注入版本号到 manifest.json
# ===================
inject_version() {
    local file="$1"
    if command -v python3 &> /dev/null; then
        python3 -c "
import json
with open('$file', 'r') as f:
    data = json.load(f)
data['version'] = '$VERSION'
with open('$file', 'w') as f:
    json.dump(data, f, indent=4)
"
    elif command -v node &> /dev/null; then
        node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$file', 'utf-8'));
data.version = '$VERSION';
fs.writeFileSync('$file', JSON.stringify(data, null, 4) + '\n');
"
    else
        echo "[ERROR] 需要 python3 或 node 来解析 JSON"
        exit 1
    fi
}

# ===================
# 通用：打包 ZIP
# ===================
build_zip() {
    local zip_path="$1"
    rm -f "$zip_path"
    cd "$PROJECT_DIR"
    zip -r "$zip_path" . \
        -x ".git/*" \
        -x ".github/*" \
        -x ".trae/*" \
        -x ".monkeycode/*" \
        -x ".monkeycode-tmp-files/*" \
        -x "docs/*" \
        -x "deployment/*" \
        -x "deployment" \
        -x "dist/*" \
        -x "reference/*" \
        -x "AGENTS.md" \
        -x "LICENSE" \
        -x "README.md" \
        -x "*.log" \
        -x ".gitignore" \
        -x ".gitmodules" \
        -x "*.bak" \
        -x "node_modules/*" \
        -x "package*.json" \
        -x "yarn.lock" \
        -x ".env*" \
        -x "*.tmp" \
        -x ".cache/*" \
        -x ".DS_Store" \
        -x "Thumbs.db" \
        -x "web-extension.crx" \
        -x "manifest.json.chrome" \
        -x "manifest.json.firefox" \
        -x "background.firefox.js" \
        -x "temp/*"
}

# 创建输出目录（先清理旧内容）
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# ===================
# 1. 生成 CRX 签名密钥（如不存在）
# ===================
if [ ! -f "$KEY_FILE" ]; then
    echo "[INFO] 未找到密钥文件，正在生成新的 RSA 私钥..."
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$KEY_FILE" 2>/dev/null
    echo "[INFO] 私钥已生成: $KEY_FILE"
    echo "[WARN] 请妥善保管此密钥文件，丢失后无法对扩展进行版本更新签名"
fi

# ===================
# 2. 打包 Firefox ZIP（使用 background.scripts）
# ===================
FX_ZIP_NAME="${EXTENSION_NAME}-firefox-v${VERSION}.zip"
FX_ZIP_PATH="$OUTPUT_DIR/$FX_ZIP_NAME"

echo "[INFO] 开始打包 Firefox 扩展..."

# Firefox 不支持 importScripts（background.scripts 运行在页面上下文）
# 合并 sync-gist.js 和 sync-settings.js 到 background.js 中
FX_BG="$PROJECT_DIR/background.firefox.js"
cat "$PROJECT_DIR/js/sync-settings.js" > "$FX_BG"
echo "" >> "$FX_BG"
cat "$PROJECT_DIR/js/sync-gist.js" >> "$FX_BG"
echo "" >> "$FX_BG"
# 追加 background.js 本体（去掉 importScripts 行）
tail -n +2 "$PROJECT_DIR/background.js" >> "$FX_BG"

# 用 Firefox 版 background.js 替换当前文件
cp "$FX_BG" "$PROJECT_DIR/background.js"

# 将 manifest 改为 Firefox 兼容格式（background.scripts）
cp "$MANIFEST_FILE" "$MANIFEST_FILE.firefox"
python3 -c "
import json
with open('$MANIFEST_FILE.firefox', 'r') as f:
    data = json.load(f)
data['version'] = '$VERSION'
# Firefox 使用 scripts 而非 service_worker
if 'service_worker' in data.get('background', {}):
    data['background'] = {'scripts': ['background.js']}
# Firefox 需要 browser_specific_settings
if 'browser_specific_settings' not in data:
    data['browser_specific_settings'] = {'gecko': {'id': 'bookmark-workspace-manager@example.com', 'strict_min_version': '117.0'}}
with open('$MANIFEST_FILE.firefox', 'w') as f:
    json.dump(data, f, indent=4)
"

# 用 Firefox manifest 替换当前 manifest 并打包
cp "$MANIFEST_FILE.firefox" "$MANIFEST_FILE"
build_zip "$FX_ZIP_PATH"
echo "[INFO] Firefox ZIP 打包完成: $FX_ZIP_PATH"
echo "[INFO] ZIP 大小: $(du -h "$FX_ZIP_PATH" | cut -f1)"
rm -f "$MANIFEST_FILE.firefox"
rm -f "$FX_BG"

# ===================
# 3. 打包 Chrome ZIP + CRX（使用 background.service_worker）
# ===================
CHROME_ZIP_NAME="${EXTENSION_NAME}-chrome-v${VERSION}.zip"
CHROME_ZIP_PATH="$OUTPUT_DIR/$CHROME_ZIP_NAME"
CRX_NAME="${EXTENSION_NAME}-chrome-v${VERSION}.crx"
CRX_PATH="$OUTPUT_DIR/$CRX_NAME"

echo "[INFO] 开始打包 Chrome 扩展..."

# 恢复 background.js 为原始版本（含 importScripts，Chrome 使用）
cp "$PROJECT_DIR/background.js.bak" "$PROJECT_DIR/background.js"

# 将 manifest 改为 Chrome 兼容格式
cp "$MANIFEST_FILE" "$MANIFEST_FILE.chrome"
python3 -c "
import json
with open('$MANIFEST_FILE.chrome', 'r') as f:
    data = json.load(f)
data['version'] = '$VERSION'
# Chrome 使用 service_worker
if 'scripts' in data.get('background', {}):
    data['background'] = {'service_worker': 'background.js'}
# Chrome 不需要 browser_specific_settings
data.pop('browser_specific_settings', None)
with open('$MANIFEST_FILE.chrome', 'w') as f:
    json.dump(data, f, indent=4)
"

# 用 Chrome manifest 替换当前 manifest
cp "$MANIFEST_FILE.chrome" "$MANIFEST_FILE"
build_zip "$CHROME_ZIP_PATH"
echo "[INFO] Chrome ZIP 打包完成: $CHROME_ZIP_PATH"
echo "[INFO] ZIP 大小: $(du -h "$CHROME_ZIP_PATH" | cut -f1)"

# 打包 CRX
if command -v node &> /dev/null; then
    echo "[INFO] 开始打包 CRX..."
    node "$SCRIPT_DIR/pack-crx.cjs" "$CHROME_ZIP_PATH" "$KEY_FILE" "$CRX_PATH"
    echo "[INFO] CRX 大小: $(du -h "$CRX_PATH" | cut -f1)"
else
    echo "[WARN] 未检测到 Node.js，跳过 CRX 打包"
fi

# 清理 Chrome manifest 临时文件
rm -f "$MANIFEST_FILE.chrome"

# ===================
# 结果汇总
# ===================
echo ""
echo "============================================"
echo "  打包完成"
echo "============================================"
echo "  版本: v$VERSION"
echo "  Firefox ZIP:  $FX_ZIP_PATH"
echo "  Chrome ZIP:   $CHROME_ZIP_PATH"
if [ -f "$CRX_PATH" ]; then
    echo "  Chrome CRX:   $CRX_PATH"
fi
echo "============================================"