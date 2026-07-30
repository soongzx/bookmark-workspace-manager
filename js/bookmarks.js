// ========== 书签栏识别与扁平化 ==========
// 辅助：判断节点是否有文件夹类型子节点
function hasFolderChildren(node) {
    return node && node.children && node.children.some(function(c) { return !c.url && c.children; });
}

// 辅助：根据 ID 精确查找根目录节点
function findById(root, id) {
    return root.children.find(function(c) { return c.id === id; });
}

// ---- 各浏览器识别策略 ----

// Chrome/Edge 书签栏：id='1'
function detectChromeBar(root) {
    var node = findById(root, '1');
    if (hasFolderChildren(node)) return node;
    if (node && node.children && node.children.length > 0) return node;
    return null;
}

// Chrome/Edge 其他书签：id='2'
function detectChromeOther(root) {
    var node = findById(root, '2');
    if (hasFolderChildren(node)) return node;
    if (node && node.children && node.children.length > 0) return node;
    return null;
}

// Firefox 书签工具栏：id='toolbar_____'
function detectFirefoxToolbar(root) {
    var node = findById(root, 'toolbar_____');
    if (hasFolderChildren(node)) return node;
    if (node && node.children && node.children.length > 0) return node;
    return null;
}

// Firefox 其他书签：id='unfiled_____'
function detectFirefoxOther(root) {
    var node = findById(root, 'unfiled_____');
    if (hasFolderChildren(node)) return node;
    if (node && node.children && node.children.length > 0) return node;
    return null;
}

// Firefox 书签菜单：id='menu________'
function detectFirefoxMenu(root) {
    var node = findById(root, 'menu________');
    if (hasFolderChildren(node)) return node;
    if (node && node.children && node.children.length > 0) return node;
    return null;
}

// QQ浏览器 书签栏：优先 id='1'，空则回退到其他书签
function detectQQBar(root) {
    var bar = detectChromeBar(root);
    if (bar) return bar;
    var other = detectChromeOther(root);
    if (other) return other;
    return null;
}

// QQ浏览器 其他书签：优先 id='2'，空则回退到书签栏
function detectQQOther(root) {
    var other = detectChromeOther(root);
    if (other) return other;
    var bar = detectChromeBar(root);
    if (bar) return bar;
    return null;
}

// 标题匹配兜底（含 QQ Browser 特有文件夹名）
function detectByTitle(root) {
    var byBarTitle = root.children.find(function(c) {
        var t = (c.title || '').toLowerCase();
        return hasFolderChildren(c) && (t.indexOf('书签栏') !== -1 || t.indexOf('bookmarks bar') !== -1 || t.indexOf('bookmarks toolbar') !== -1 || t.indexOf('收藏栏') !== -1);
    });
    if (byBarTitle) return byBarTitle;
    var byOtherTitle = root.children.find(function(c) {
        var t = (c.title || '').toLowerCase();
        return hasFolderChildren(c) && (t.indexOf('其他书签') !== -1 || t.indexOf('所有书签') !== -1 || t.indexOf('other bookmark') !== -1 || t.indexOf('unsorted') !== -1);
    });
    if (byOtherTitle) return byOtherTitle;
    return null;
}

// 自动检测（逐级兜底，不依赖特定 ID）
function detectAuto(root) {
    // 1. 标准 Chromium 书签栏 (id='1')
    var bar = detectChromeBar(root);
    if (bar) return bar;

    // 2. Firefox 其他书签 (id='unfiled_____')
    var fxOther = detectFirefoxOther(root);
    if (fxOther) return fxOther;

    // 3. 标准 Chromium 其他书签 (id='2')
    var other = detectChromeOther(root);
    if (other) return other;

    // 4. Firefox 书签工具栏 (id='toolbar_____')
    var fxBar = detectFirefoxToolbar(root);
    if (fxBar) return fxBar;

    // 5. Firefox 书签菜单 (id='menu________')
    var fxMenu = detectFirefoxMenu(root);
    if (fxMenu) return fxMenu;

    // 6. 标题匹配（含 QQ Browser 特有文件夹名）
    var byTitle = detectByTitle(root);
    if (byTitle) return byTitle;

    // 7. 全量兜底：遍历所有 root children，优先返回有文件夹子项的
    var all = root.children.filter(function(c) { return !c.url && c.children && c.children.length > 0; });
    if (all.length === 0) return null;

    var withFolders = all.filter(function(c) { return hasFolderChildren(c); });
    if (withFolders.length > 0) return withFolders[0];

    return all[0];
}

// ---- 主入口 ----
function findBookmarksBar(root, preferredRoot, storageFolder) {
    if (!root || !root.children) return null;

    // 存储文件夹模式：优先在书签栏下查找指定名称的文件夹
    if (storageFolder) {
        var sf = findStorageFolderInBar(root, storageFolder);
        if (sf && hasFolderChildren(sf)) return sf;
        if (sf && sf.children && sf.children.length > 0) return sf;
    }

    // 用户指定策略
    if (preferredRoot && preferredRoot !== 'auto') {
        if (preferredRoot.indexOf('custom:') === 0) {
            var targetName = preferredRoot.substring(7).trim();
            if (targetName) {
                var found = findNodeByTitle(root, targetName);
                if (found && found.children && found.children.length > 0) return found;
            }
        } else {
            var strategies = {
                'chrome_bar':       detectChromeBar,
                'chrome_other':     detectChromeOther,
                'firefox_toolbar':  detectFirefoxToolbar,
                'firefox_other':    detectFirefoxOther,
                'firefox_menu':     detectFirefoxMenu,
                'qq_bar':           detectQQBar,
                'qq_other':         detectQQOther
            };
            // 兼容旧值
            if (preferredRoot === 'bookmarks_bar') preferredRoot = 'chrome_bar';
            if (preferredRoot === 'other_bookmarks') preferredRoot = 'chrome_other';
            if (preferredRoot === 'menu_folder') preferredRoot = 'firefox_menu';
            var fn = strategies[preferredRoot];
            if (fn) {
                var result = fn(root);
                if (result) return result;
            }
        }
        // 配置的策略未找到，回退到自动检测
    }

    return detectAuto(root);
}

// 在书签树中按标题查找节点（递归搜索）
function findNodeByTitle(node, title) {
    if (!node || !node.children) return null;
    for (var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        if (child.title === title && child.children) return child;
        var found = findNodeByTitle(child, title);
        if (found) return found;
    }
    return null;
}

// 在书签栏下查找指定名称的文件夹
function findStorageFolderInBar(root, folderName) {
    if (!root || !root.children || !folderName) return null;
    var bar = root.children.find(function (c) {
        return c.id === '1' || c.id === 'toolbar_____';
    });
    if (bar && bar.children) {
        var found = bar.children.find(function (c) {
            return c.title === folderName && !c.url && c.children;
        });
        if (found) return found;
    }
    // 全量兜底：在任意根节点下查找
    for (var i = 0; i < root.children.length; i++) {
        var node = root.children[i];
        if (!node || !node.children) continue;
        var match = node.children.find(function (c) {
            return c.title === folderName && !c.url && c.children;
        });
        if (match) return match;
    }
    return null;
}

// 获取所有可用的根目录候选（用于设置页面展示）
function getAvailableRootCandidates(root, callback) {
    if (!root || !root.children) { callback([]); return; }
    var candidates = [];
    root.children.forEach(function(c) {
        if (c.children && !c.url) {
            candidates.push({
                id: c.id,
                title: c.title,
                childCount: c.children.filter(function(ch) { return !ch.url; }).length
            });
        }
    });
    callback(candidates);
}

function flattenBookmarks(node, path, result) {
    if (!node) return;
    const cur = [...path];
    if (node.title) cur.push(node.title);
    if (node.url) {
        var parentPath = cur.slice(0, -1);
        result.push({ id: node.id, title: node.title, url: node.url, path: parentPath, pathStr: parentPath.join(' ▸ '), node });
    }
    if (node.children) node.children.forEach(c => flattenBookmarks(c, cur, result));
}

// 从 Gist 快照构建虚拟书签树（QQ 浏览器 getTree() 返回空时使用）
function buildVirtualTree(snapshot) {
    if (!snapshot || !snapshot.length) return null;
    var _vid = 0;
    function nextId() { return 'v_' + (_vid++); }

    function convertNode(node) {
        var converted = { id: nextId(), title: node.title || '', children: [] };
        if (node.url) converted.url = node.url;
        if (node.children) {
            for (var i = 0; i < node.children.length; i++) {
                converted.children.push(convertNode(node.children[i]));
            }
        }
        return converted;
    }

    var rootChildren = [];
    for (var i = 0; i < snapshot.length; i++) {
        var node = snapshot[i];
        if (node.children) {
            for (var j = 0; j < node.children.length; j++) {
                rootChildren.push(convertNode(node.children[j]));
            }
        }
    }

    return {
        id: '0',
        title: '',
        children: [
            { id: '1', title: '书签栏', children: rootChildren }
        ]
    };
}