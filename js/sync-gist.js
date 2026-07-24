// ========== GitHub Gist 书签同步核心逻辑 ==========
// 仅被 background.js 通过 importScripts 加载 (Service Worker 上下文)

var GIST_API_BASE = 'https://api.github.com';

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

function _createBookmarkTree(bookmarkList, callback) {
    if (!bookmarkList || bookmarkList.length === 0) { callback(null); return; }
    var ids = ROOT_FOLDER_IDS;
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
        callback(tree);
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
            callback(null);
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
            callback(null);
            return;
        }
        var pending = nodesToRemove.length;
        function removeDone() {
            pending--;
            if (pending === 0 && callback) callback(null);
        }
        for (var k = 0; k < nodesToRemove.length; k++) {
            chrome.bookmarks.removeTree(nodesToRemove[k].id, removeDone);
        }
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
function downloadBookmarks(callback) {
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
                clearAllBookmarks(function (clearErr) {
                    if (clearErr) { callback(clearErr); return; }
                    createBookmarkTree(syncData.bookmarks, function (createErr) {
                        if (createErr) { callback(createErr); return; }
                        var count = getBookmarkCount(syncData.bookmarks);
                        chrome.storage.local.set({ remoteBookmarkCount: count });
                        if (settings.enableNotify) {
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'icons/icon48.png',
                                title: '下载书签',
                                message: '成功下载 ' + count + ' 条书签'
                            });
                        }
                        callback(null, { count: count });
                    });
                });
            } catch (e) {
                callback(new Error('Gist 数据解析失败: ' + e.message));
            }
        });
    });
}
