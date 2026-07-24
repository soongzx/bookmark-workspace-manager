// ========== 书签栏识别与扁平化 ==========
function findBookmarksBar(root, preferredRoot) {
    if (!root?.children) return null;

    function hasFolderChildren(node) {
        return node && node.children && node.children.some(function(c) { return !c.url && c.children; });
    }

    // 根据用户配置的策略选择根目录
    if (preferredRoot && preferredRoot !== 'auto') {
        // 自定义路径：在书签树中按名称查找
        if (preferredRoot.indexOf('custom:') === 0) {
            var targetName = preferredRoot.substring(7).trim();
            if (targetName) {
                var found = findNodeByTitle(root, targetName);
                if (found && found.children) return found;
            }
            // 自定义名称未找到，回退到自动检测
        } else if (preferredRoot === 'bookmarks_bar') {
            var chromeBar = root.children.find(function(c) { return c.id === '1'; });
            var fxBar = root.children.find(function(c) { return c.id === 'toolbar_____'; });
            if (hasFolderChildren(chromeBar)) return chromeBar;
            if (hasFolderChildren(fxBar)) return fxBar;
            if (chromeBar && chromeBar.children) return chromeBar;
            if (fxBar && fxBar.children) return fxBar;
        } else if (preferredRoot === 'other_bookmarks') {
            var chromeOther = root.children.find(function(c) { return c.id === '2'; });
            var fxOther = root.children.find(function(c) { return c.id === 'unfiled_____'; });
            if (hasFolderChildren(chromeOther)) return chromeOther;
            if (hasFolderChildren(fxOther)) return fxOther;
            if (chromeOther && chromeOther.children) return chromeOther;
            if (fxOther && fxOther.children) return fxOther;
        } else if (preferredRoot === 'menu_folder') {
            var fxMenu = root.children.find(function(c) { return c.id === 'menu________'; });
            if (hasFolderChildren(fxMenu)) return fxMenu;
            if (fxMenu && fxMenu.children) return fxMenu;
        }
        // 配置的路径无效，回退到自动检测
    }

    // 自动检测（8级兜底）
    // 1. Chrome/Edge: 书签栏 (id: '1')
    var byId = root.children.find(function(c) { return c.id === '1'; });
    if (hasFolderChildren(byId)) return byId;

    // 2. Firefox: 其他书签 (id: 'unfiled_____')
    var byFxUnfiled = root.children.find(function(c) { return c.id === 'unfiled_____'; });
    if (hasFolderChildren(byFxUnfiled)) return byFxUnfiled;

    // 3. Chrome/Edge: 其他书签 (id: '2')
    var byOther = root.children.find(function(c) { return c.id === '2'; });
    if (hasFolderChildren(byOther)) return byOther;

    // 4. Firefox: toolbar folder (id: 'toolbar_____')
    var byFxId = root.children.find(function(c) { return c.id === 'toolbar_____'; });
    if (hasFolderChildren(byFxId)) return byFxId;

    // 5. 标题匹配：书签栏
    var byTitle = root.children.find(function(c) {
        var t = (c.title || '').toLowerCase();
        return hasFolderChildren(c) && (t.indexOf('书签栏') !== -1 || t.indexOf('bookmarks bar') !== -1 || t.indexOf('bookmarks toolbar') !== -1);
    });
    if (byTitle) return byTitle;

    // 6. 标题匹配：其他书签
    var byOtherTitle = root.children.find(function(c) {
        var t = (c.title || '').toLowerCase();
        return hasFolderChildren(c) && (t.indexOf('其他书签') !== -1 || t.indexOf('other bookmark') !== -1);
    });
    if (byOtherTitle) return byOtherTitle;

    // 7. 兜底：第一个有文件夹子项的节点（排除mobile）
    var fallback = root.children.find(function(c) {
        var t = (c.title || '').toLowerCase();
        return hasFolderChildren(c) && t.indexOf('mobile') === -1;
    });
    if (fallback) return fallback;

    // 8. 最后手段：任意有子项的节点
    return root.children.find(function(c) { return c.children && !c.url; }) || null;
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
    if (node.title && path.length > 0) cur.push(node.title);
    if (node.url) result.push({ id: node.id, title: node.title, url: node.url, path: cur, pathStr: cur.join(' ▸ '), node });
    if (node.children) node.children.forEach(c => flattenBookmarks(c, cur, result));
}