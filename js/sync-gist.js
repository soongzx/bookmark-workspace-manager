// ========== GitHub Gist 书签同步核心逻辑 ==========
// 仅被 background.js 通过 importScripts 加载 (Service Worker 上下文)

var GIST_API_BASE = 'https://api.github.com';
var _createdBookmarkIds = [];

// Gist API 请求封装
function gistRequest(token, path, method, body, callback) {
    var headers = {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Cache': 'no-store'
    };
    if (body) {
        headers['Content-Type'] = 'application/json;charset=utf-8';
    }
    var options = {
        method: method || 'GET',
        headers: headers
    };
    if (body) options.body = body;

    fetch(GIST_API_BASE + path, options)
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (e) {
                    throw new Error(e.message || 'HTTP ' + res.status + ': ' + res.statusText);
                }).catch(function () {
                    throw new Error('HTTP ' + res.status + ': ' + res.statusText);
                });
            }
            return res.json();
        })
        .then(function (data) { callback(null, data); })
        .catch(function (err) { callback(err); });
}

// 获取 Gist 文件内容 (处理截断回退)
function gistGetContent(token, gistID, fileName, callback) {
    gistRequest(token, '/gists/' + gistID, 'GET', null, function (err, resp) {
        if (err) { callback(err); return; }
        if (!resp || !resp.files) {
            callback(new Error('Gist 响应无 files 字段'));
            return;
        }
        var filenames = Object.keys(resp.files);
        if (filenames.indexOf(fileName) === -1) {
            callback(new Error('Gist 中未找到文件: ' + fileName));
            return;
        }
        var gistFile = resp.files[fileName];
        if (gistFile.truncated) {
            fetch(gistFile.raw_url, {
                headers: {
                    'Cache': 'no-store'
                }
            })
            .then(function (r) { return r.text(); })
            .then(function (txt) { callback(null, txt); })
            .catch(function (err) { callback(err); });
        } else {
            callback(null, gistFile.content);
        }
    });
}

// 更新 Gist 文件内容
function gistUpdateContent(token, gistID, fileName, content, callback) {
    var files = {};
    files[fileName] = { content: content };
    var body = JSON.stringify({
        files: files,
        description: fileName
    });
    gistRequest(token, '/gists/' + gistID, 'PATCH', body, callback);
}

// ========== 书签格式化 (去掉浏览器特有字段) ==========
function format(node) {
    if (!node) return null;
    var cleaned = {
        title: node.title || ''
    };
    if (node.url) cleaned.url = node.url;
    if (node.children && node.children.length > 0) {
        cleaned.children = [];
        for (var i = 0; i < node.children.length; i++) {
            cleaned.children.push(format(node.children[i]));
        }
    }
    return cleaned;
}

// 根据标题识别根文件夹类型 (跨浏览器兼容)
function classifyRootFolderTitle(node) {
    var t = (node.title || '').toLowerCase();
    if (node.id === 'toolbar_____' || t.indexOf('书签栏') !== -1 || t.indexOf('bookmark') !== -1) return 'ToolbarFolder';
    if (node.id === 'unfiled_____' || t.indexOf('其他书签') !== -1 || t.indexOf('other bookmark') !== -1 || t.indexOf('unsorted') !== -1) return 'UnfiledFolder';
    if (node.id === 'mobile______' || t.indexOf('mobile') !== -1 || t.indexOf('移动') !== -1) return 'MobileFolder';
    if (node.id === 'menu________' || t.indexOf('menu') !== -1) return 'MenuFolder';
    return 'UnfiledFolder';
}

function formatBookmarks(bookmarks) {
    if (!bookmarks || !bookmarks[0] || !bookmarks[0].children) return [];
    for (var i = 0; i < bookmarks[0].children.length; i++) {
        var a = bookmarks[0].children[i];
        a.title = classifyRootFolderTitle(a);
    }
    var root = format(bookmarks[0]);
    return root.children || [];
}

// ========== 根文件夹 ID 缓存 (跨浏览器兼容) ==========
var ROOT_FOLDER_IDS = null;
var FOLDER_IDS_PENDING = null;

function ensureFolderIds(callback) {
    if (ROOT_FOLDER_IDS) { callback(); return; }
    if (FOLDER_IDS_PENDING) { FOLDER_IDS_PENDING.push(callback); return; }
    FOLDER_IDS_PENDING = [callback];
    chrome.bookmarks.getTree(function (tree) {
        var root = tree[0];
        ROOT_FOLDER_IDS = { toolbar: '1', other: '2', mobile: '3' };
        if (root && root.children) {
            root.children.forEach(function (c) {
                var t = (c.title || '').toLowerCase();
                if (c.id === 'toolbar_____') ROOT_FOLDER_IDS.toolbar = c.id;
                if (c.id === 'unfiled_____') ROOT_FOLDER_IDS.other = c.id;
                if (c.id === 'mobile______') ROOT_FOLDER_IDS.mobile = c.id;
                if (t.indexOf('书签栏') !== -1 || t.indexOf('bookmarks bar') !== -1 || t.indexOf('bookmarks toolbar') !== -1) ROOT_FOLDER_IDS.toolbar = c.id;
                if (t.indexOf('其他书签') !== -1 || t.indexOf('other bookmark') !== -1 || t.indexOf('unsorted') !== -1) ROOT_FOLDER_IDS.other = c.id;
                if (t.indexOf('mobile') !== -1 || t.indexOf('移动') !== -1) ROOT_FOLDER_IDS.mobile = c.id;
            });
            // QQ 浏览器适配：标准 id='2'（其他书签）为空时，创建书签回退到书签栏
            if (ROOT_FOLDER_IDS.other === '2') {
                var otherNode = root.children.find(function(c) { return c.id === '2'; });
                if (!otherNode || !otherNode.children || otherNode.children.length === 0) {
                    ROOT_FOLDER_IDS.other = ROOT_FOLDER_IDS.toolbar;
                }
            }
        }
        var cbs = FOLDER_IDS_PENDING;
        FOLDER_IDS_PENDING = null;
        cbs.forEach(function (cb) { cb(); });
    });
}

// ========== 书签树重建 ==========
function createBookmarkTree(bookmarkList, callback) {
    ensureFolderIds(function () {
        _createBookmarkTree(bookmarkList, callback);
    });
}

function createBookmarkTreeInFolder(bookmarkList, parentId, callback) {
    ensureFolderIds(function () {
        _createBookmarkTree(bookmarkList, callback, parentId);
    });
}

function _createBookmarkTree(bookmarkList, callback, storageParentId) {
    if (!bookmarkList || bookmarkList.length === 0) { callback(null); return; }
    var ids = ROOT_FOLDER_IDS;
    _createdBookmarkIds = [];

    if (storageParentId) {
        var allChildren = [];
        for (var si = 0; si < bookmarkList.length; si++) {
            var rootNode = bookmarkList[si];
            if (rootNode.children) {
                for (var sj = 0; sj < rootNode.children.length; sj++) {
                    rootNode.children[sj].parentId = storageParentId;
                    allChildren.push(rootNode.children[sj]);
                }
            }
        }
        if (allChildren.length === 0) { callback(null); return; }
        var pending = allChildren.length;
        function done() {
            pending--;
            if (pending === 0 && callback) callback(null);
        }
        for (var si2 = 0; si2 < allChildren.length; si2++) {
            processNode(allChildren[si2]);
        }
        return;
    }

    var pending = bookmarkList.length;

    function done() {
        pending--;
        if (pending === 0 && callback) callback(null);
    }

    function processNode(node) {
        var title = node.title || '';
        var url = node.url;
        var children = node.children;
        var parentId = node.parentId;

        // 根文件夹节点
        if (title === 'MenuFolder' || title === 'MobileFolder' ||
            title === 'ToolbarFolder' || title === 'UnfiledFolder') {
            if (children && children.length > 0) {
                for (var j = 0; j < children.length; j++) {
                    if (title === 'ToolbarFolder') {
                        children[j].parentId = ids.toolbar;
                    } else if (title === 'MobileFolder') {
                        children[j].parentId = ids.mobile;
                    } else {
                        children[j].parentId = ids.other;
                    }
                }
                createBookmarkTree(children, done);
            } else {
                done();
            }
            return;
        }

        chrome.bookmarks.create({
            parentId: parentId || ids.other,
            title: title,
            url: url || undefined
        }, function (res) {
            if (chrome.runtime.lastError) {
                console.error('创建书签失败:', chrome.runtime.lastError.message, title);
            }
            if (res && res.id) {
                _createdBookmarkIds.push(res.id);
            }
            if (res && res.id && children && children.length > 0) {
                for (var k = 0; k < children.length; k++) {
                    children[k].parentId = res.id;
                }
                createBookmarkTree(children, done);
            } else {
                done();
            }
        });
    }

    for (var i = 0; i < bookmarkList.length; i++) {
        processNode(bookmarkList[i]);
    }
}

// ========== 获取完整书签树 ==========
function getBookmarks(callback) {
    chrome.bookmarks.getTree(function (tree) {
        if (tree && tree[0] && tree[0].children && tree[0].children.length > 0) {
            var hasContent = false;
            for (var i = 0; i < tree[0].children.length; i++) {
                var c = tree[0].children[i];
                if (c.children && c.children.length > 0) { hasContent = true; break; }
            }
            if (hasContent) { callback(tree); return; }
        }
        // 兜底：QQ 浏览器 getTree() 返回空，改用 search({}) 重建树
        chrome.bookmarks.search({}, function (results) {
            if (results && results.length > 0) {
                var nodeMap = {};
                for (var i = 0; i < results.length; i++) {
                    nodeMap[results[i].id] = results[i];
                }
                var rootChildren = [];
                for (var j = 0; j < results.length; j++) {
                    if (results[j].parentId === '0' && !results[j].url) {
                        rootChildren.push(results[j]);
                    }
                }
                if (rootChildren.length > 0) {
                    for (var k = 0; k < results.length; k++) {
                        results[k].children = [];
                    }
                    for (var m = 0; m < results.length; m++) {
                        var parent = nodeMap[results[m].parentId];
                        if (parent) parent.children.push(results[m]);
                    }
                    callback([{ id: '0', title: '', children: rootChildren }]);
                    return;
                }
            }
            // 最后兜底：getChildren("0")
            chrome.bookmarks.getChildren('0', function (rootChildren) {
                callback([{ id: '0', title: '', children: rootChildren || [] }]);
            });
        });
    });
}

// ========== 书签计数 ==========
function getBookmarkCount(bookmarkList) {
    var count = 0;
    if (!bookmarkList) return 0;
    for (var i = 0; i < bookmarkList.length; i++) {
        var c = bookmarkList[i];
        if (c.url) {
            count++;
        } else {
            count += getBookmarkCount(c.children);
        }
    }
    return count;
}

// ========== 清空所有本地书签 ==========
function clearAllBookmarks(callback) {
    getBookmarks(function (tree) {
        if (!tree || !tree[0] || !tree[0].children) {
            tryClearViaStoredIds(callback);
            return;
        }
        var nodesToRemove = [];
        for (var i = 0; i < tree[0].children.length; i++) {
            var rootFolder = tree[0].children[i];
            if (rootFolder.children) {
                for (var j = 0; j < rootFolder.children.length; j++) {
                    nodesToRemove.push(rootFolder.children[j]);
                }
            }
        }
        if (nodesToRemove.length === 0) {
            tryClearViaStoredIds(callback);
            return;
        }
        var pending = nodesToRemove.length;
        function removeDone() {
            pending--;
            if (pending === 0) tryClearViaStoredIds(callback);
        }
        for (var k = 0; k < nodesToRemove.length; k++) {
            chrome.bookmarks.removeTree(nodesToRemove[k].id, removeDone);
        }
    });
}

function tryClearViaStoredIds(callback) {
    chrome.storage.local.get(['gistBookmarkIds'], function (data) {
        var ids = data.gistBookmarkIds || [];
        if (ids.length === 0) { callback(null); return; }
        var pending = ids.length;
        function done() {
            pending--;
            if (pending === 0) {
                chrome.storage.local.remove(['gistBookmarkIds', 'gistBookmarkSnapshot']);
                if (callback) callback(null);
            }
        }
        // 反向遍历：先删子节点再删父节点；用 remove() 替代 removeTree()
        for (var i = ids.length - 1; i >= 0; i--) {
            chrome.bookmarks.remove(ids[i], function () {
                if (chrome.runtime.lastError) {
                    // remove() 对非空文件夹会失败，忽略
                }
                done();
            });
        }
    });
}

// 仅清空指定文件夹的子节点
function clearFolderContents(folderId, callback) {
    if (!folderId) { callback(null); return; }
    chrome.bookmarks.getChildren(folderId, function (children) {
        if (!children || children.length === 0) {
            tryClearViaStoredIds(callback);
            return;
        }
        var pending = children.length;
        function done() {
            pending--;
            if (pending === 0 && callback) callback(null);
        }
        for (var i = 0; i < children.length; i++) {
            chrome.bookmarks.removeTree(children[i].id, done);
        }
    });
}

// 查找或创建存储文件夹（在书签栏下）
function findOrCreateStorageFolder(folderName, callback) {
    if (!folderName) { callback(null); return; }
    getBookmarks(function (tree) {
        var root = tree && tree[0];
        if (!root || !root.children) { callback(null); return; }
        var bar = root.children.find(function (c) {
            return c.id === '1' || c.id === 'toolbar_____';
        });
        if (!bar) { callback(null); return; }
        var existing = bar.children.find(function (c) {
            return c.title === folderName && !c.url && c.children;
        });
        if (existing) { callback(existing.id); return; }
        chrome.bookmarks.create({ parentId: bar.id, title: folderName }, function (folder) {
            if (chrome.runtime.lastError) { callback(null); return; }
            callback(folder.id);
        });
    });
}

// ========== 上传书签到 Gist ==========
function uploadBookmarks(callback) {
    getSyncSettings(function (settings) {
        if (!settings.githubToken) { callback(new Error('未配置 GitHub Token，请在设置中填写')); return; }
        if (!settings.gistID) { callback(new Error('未配置 Gist ID，请在设置中填写')); return; }
        if (!settings.gistFileName) { callback(new Error('未配置 Gist 文件名')); return; }

        getBookmarks(function (tree) {
            try {
                var formatted = formatBookmarks(tree);
                var syncData = {
                    browser: navigator.userAgent,
                    version: chrome.runtime.getManifest().version,
                    createDate: Date.now(),
                    bookmarks: formatted
                };
                var content = JSON.stringify(syncData);
                gistUpdateContent(settings.githubToken, settings.gistID, settings.gistFileName, content, function (err) {
                    if (err) { callback(err); return; }
                    var count = getBookmarkCount(formatted);
                    chrome.storage.local.set({ remoteBookmarkCount: count });
                    if (settings.enableNotify) {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'icons/icon48.png',
                            title: '上传书签',
                            message: '成功上传 ' + count + ' 条书签'
                        });
                    }
                    callback(null, { count: count });
                });
            } catch (e) {
                callback(e);
            }
        });
    });
}

// ========== 从 Gist 下载书签 ==========
function downloadBookmarks(callback, overrideSyncMode) {
    getSyncSettings(function (settings) {
        if (!settings.githubToken) { callback(new Error('未配置 GitHub Token，请在设置中填写')); return; }
        if (!settings.gistID) { callback(new Error('未配置 Gist ID，请在设置中填写')); return; }
        if (!settings.gistFileName) { callback(new Error('未配置 Gist 文件名')); return; }

        gistGetContent(settings.githubToken, settings.gistID, settings.gistFileName, function (err, content) {
            if (err) { callback(err); return; }
            try {
                var syncData = JSON.parse(content);
                if (!syncData.bookmarks || syncData.bookmarks.length === 0) {
                    callback(new Error('Gist 文件中无书签数据'));
                    return;
                }
                var syncMode = overrideSyncMode || settings.syncMode || 'overwrite';
                var storageFolder = settings.storageFolder || '';

                function doCreateIn(parentId) {
                    if (parentId) {
                        createBookmarkTreeInFolder(syncData.bookmarks, parentId, function (createErr) {
                            if (createErr) { callback(createErr); return; }
                            var count = getBookmarkCount(syncData.bookmarks);
                            chrome.storage.local.set({ remoteBookmarkCount: count, gistBookmarkIds: _createdBookmarkIds, gistBookmarkSnapshot: syncData.bookmarks });
                            if (settings.enableNotify) {
                                chrome.notifications.create({
                                    type: 'basic',
                                    iconUrl: 'icons/icon48.png',
                                    title: '下载书签',
                                    message: '成功下载 ' + count + ' 条书签' + (syncMode === 'append' ? '（追加模式）' : '')
                                });
                            }
                            callback(null, { count: count });
                        });
                    } else {
                        createBookmarkTree(syncData.bookmarks, function (createErr) {
                            if (createErr) { callback(createErr); return; }
                            var count = getBookmarkCount(syncData.bookmarks);
                            chrome.storage.local.set({ remoteBookmarkCount: count, gistBookmarkIds: _createdBookmarkIds, gistBookmarkSnapshot: syncData.bookmarks });
                            if (settings.enableNotify) {
                                chrome.notifications.create({
                                    type: 'basic',
                                    iconUrl: 'icons/icon48.png',
                                    title: '下载书签',
                                    message: '成功下载 ' + count + ' 条书签' + (syncMode === 'append' ? '（追加模式）' : '')
                                });
                            }
                            callback(null, { count: count });
                        });
                    }
                }

                function doCreate() {
                    if (storageFolder) {
                        findOrCreateStorageFolder(storageFolder, function (folderId) {
                            if (folderId) {
                                doCreateIn(folderId);
                            } else {
                                doCreateIn(null);
                            }
                        });
                    } else {
                        doCreateIn(null);
                    }
                }

                if (syncMode === 'overwrite') {
                    if (storageFolder) {
                        findOrCreateStorageFolder(storageFolder, function (folderId) {
                            if (folderId) {
                                clearFolderContents(folderId, function () {
                                    doCreateIn(folderId);
                                });
                            } else {
                                doCreateIn(null);
                            }
                        });
                    } else {
                        clearAllBookmarks(function (clearErr) {
                            if (clearErr) { callback(clearErr); return; }
                            doCreate();
                        });
                    }
                } else {
                    doCreate();
                }
            } catch (e) {
                callback(new Error('Gist 数据解析失败: ' + e.message));
            }
        });
    });
}
