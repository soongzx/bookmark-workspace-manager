// ========== 统一设置页逻辑 ==========

var githubTokenInput, gistIDInput, gistFileNameInput, enableNotifyCheck, autoDownloadCheck;
var autoSyncCheck, autoSyncInterval, autoSyncDirection, autoSyncConfig;
var saveConfigBtn, saveAutoSyncBtn, saveThemeBtn, savePathBtn;
var manualUploadBtn, manualDownloadBtn, manualClearBtn;
var toggleTokenBtn;
var tabBtns, tabContents;
var themeGrid, bookmarkRootPath, customFolderName, customNameGroup, rootCandidates;
var toastEl;

function initDOM() {
    githubTokenInput = document.getElementById('githubToken');
    gistIDInput = document.getElementById('gistID');
    gistFileNameInput = document.getElementById('gistFileName');
    enableNotifyCheck = document.getElementById('enableNotify');
    autoDownloadCheck = document.getElementById('autoDownload');
    autoSyncCheck = document.getElementById('autoSync');
    autoSyncInterval = document.getElementById('autoSyncInterval');
    autoSyncDirection = document.getElementById('autoSyncDirection');
    autoSyncConfig = document.getElementById('autoSyncConfig');
    saveConfigBtn = document.getElementById('saveConfigBtn');
    saveAutoSyncBtn = document.getElementById('saveAutoSyncBtn');
    saveThemeBtn = document.getElementById('saveThemeBtn');
    savePathBtn = document.getElementById('savePathBtn');
    manualUploadBtn = document.getElementById('manualUploadBtn');
    manualDownloadBtn = document.getElementById('manualDownloadBtn');
    manualClearBtn = document.getElementById('manualClearBtn');
    toggleTokenBtn = document.getElementById('toggleTokenBtn');
    tabBtns = document.querySelectorAll('.tab-btn');
    tabContents = document.querySelectorAll('.tab-content');
    themeGrid = document.getElementById('themeGrid');
    bookmarkRootPath = document.getElementById('bookmarkRootPath');
    customFolderName = document.getElementById('customFolderName');
    customNameGroup = document.getElementById('customNameGroup');
    rootCandidates = document.getElementById('rootCandidates');
    toastEl = document.getElementById('toast');
}

function loadSettings() {
    getSyncSettings(function (items) {
        githubTokenInput.value = items.githubToken || '';
        gistIDInput.value = items.gistID || '';
        gistFileNameInput.value = items.gistFileName || 'BookmarkHub';
        enableNotifyCheck.checked = items.enableNotify !== false;
        autoDownloadCheck.checked = items.autoDownload === true;
        autoSyncCheck.checked = items.autoSync === true;
        autoSyncInterval.value = items.autoSyncInterval || 60;
        autoSyncDirection.value = items.autoSyncDirection || 'download';
        autoSyncConfig.style.display = items.autoSync ? 'block' : 'none';

        // 主题
        document.querySelectorAll('.theme-card').forEach(function(c) {
            c.classList.toggle('active', c.dataset.theme === items.theme);
        });

        // 书签路径
        var savedVal = items.bookmarkRootPath || 'auto';
        if (savedVal.indexOf('custom:') === 0) {
            bookmarkRootPath.value = 'custom:';
            if (customFolderName) customFolderName.value = savedVal.substring(7);
            if (customNameGroup) customNameGroup.style.display = 'block';
        } else {
            bookmarkRootPath.value = savedVal;
        }
        updatePathPreview(savedVal);
    });
}

function showToast(msg) {
    if (window._toastTimer) clearTimeout(window._toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    window._toastTimer = setTimeout(function () {
        toastEl.classList.remove('show');
    }, 1600);
}

function switchTab(tabId) {
    tabBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.tab === tabId); });
    tabContents.forEach(function(c) { c.classList.toggle('active', c.id === 'tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)); });
    // 切换到书签路径Tab时刷新候选目录
    if (tabId === 'bookmarkPath') {
        refreshRootCandidates();
    }
}

function updatePathPreview(value) {
    var preview = document.getElementById('pathPreview');
    var customName = customFolderName ? customFolderName.value.trim() : '';
    var descs = {
        'auto': '<strong>自动检测</strong>：依次尝试 书签栏 → 其他书签 → 书签工具栏 → 兜底，找到第一个有内容的目录',
        'bookmarks_bar': '<strong>书签栏</strong>：仅从 Chrome 书签栏 / Firefox 书签工具栏读取',
        'other_bookmarks': '<strong>其他书签</strong>：仅从「其他书签」目录读取（QQ同步数据常见位置）',
        'menu_folder': '<strong>书签菜单</strong>：仅从 Firefox 书签菜单读取'
    };
    if (value === 'custom:') {
        preview.innerHTML = '<strong>自定义</strong>：在书签树中递归查找名称为 <strong>"' + (customName || '（未填写）') + '"</strong> 的文件夹';
    } else {
        preview.innerHTML = descs[value] || descs['auto'];
    }
}

function escapeHTML(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function refreshRootCandidates() {
    if (!rootCandidates) return;
    rootCandidates.innerHTML = '<span>正在获取...</span>';
    try {
        chrome.bookmarks.getTree(function(tree) {
            if (!tree || !tree[0] || !tree[0].children) {
                rootCandidates.innerHTML = '<span>无法获取书签树</span>';
                return;
            }
            var html = '';
            tree[0].children.forEach(function(c) {
                if (c.children && !c.url) {
                    var folderCount = c.children.filter(function(ch) { return !ch.url && ch.children; }).length;
                    var bmCount = c.children.filter(function(ch) { return ch.url; }).length;
                    html += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--hairline);">' +
                        '<span><strong>' + escapeHTML(c.title || '（无标题）') + '</strong> ' +
                        (c.id === '1' ? '📌书签栏' : c.id === '2' ? '📂其他书签' : c.id === 'toolbar_____' ? '📌Firefox工具栏' : c.id === 'unfiled_____' ? '📂未分类' : '') +
                        '</span>' +
                        '<span style="color:var(--text-secondary);">' + folderCount + ' 文件夹 · ' + bmCount + ' 书签</span></div>';
                }
            });
            rootCandidates.innerHTML = html || '<span>无可用目录</span>';
        });
    } catch(e) {
        rootCandidates.innerHTML = '<span>需要打开弹窗后刷新</span>';
    }
}

function saveSyncSettingsHandler() {
    var data = {};
    data.githubToken = githubTokenInput.value.trim();
    data.gistID = gistIDInput.value.trim();
    data.gistFileName = gistFileNameInput.value.trim() || 'BookmarkHub';
    data.enableNotify = enableNotifyCheck.checked;
    data.autoDownload = autoDownloadCheck.checked;
    data.autoSync = autoSyncCheck.checked;
    data.autoSyncInterval = parseInt(autoSyncInterval.value, 10) || 60;
    data.autoSyncDirection = autoSyncDirection.value;

    saveConfigBtn.disabled = true;
    saveConfigBtn.textContent = '保存中...';
    saveSyncSettings(data, function () {
        saveConfigBtn.disabled = false;
        saveConfigBtn.textContent = '保存配置';
        showToast('同步配置已保存');
    });
}

function saveThemeHandler() {
    var selected = document.querySelector('.theme-card.active');
    if (!selected) return;
    var theme = selected.dataset.theme;
    saveSyncSettings({ theme: theme }, function () {
        localStorage.setItem('workspace_theme', theme);
        showToast('主题设置已保存');
    });
}

function savePathHandler() {
    var value = bookmarkRootPath.value;
    if (value === 'custom:') {
        var name = customFolderName ? customFolderName.value.trim() : '';
        if (!name) {
            showToast('请输入文件夹名称');
            return;
        }
        value = 'custom:' + name;
    }
    saveSyncSettings({ bookmarkRootPath: value }, function () {
        showToast('书签路径设置已保存');
    });
}

function bindEvents() {
    // Tab 切换
    tabBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            switchTab(btn.dataset.tab);
        });
    });

    // Token 显示/隐藏
    var tokenVisible = false;
    toggleTokenBtn.addEventListener('click', function () {
        tokenVisible = !tokenVisible;
        githubTokenInput.type = tokenVisible ? 'text' : 'password';
        toggleTokenBtn.textContent = tokenVisible ? '隐藏' : '显示';
    });

    // 主题选择
    themeGrid.addEventListener('click', function(e) {
        var card = e.target.closest('.theme-card');
        if (!card) return;
        document.querySelectorAll('.theme-card').forEach(function(c) { c.classList.remove('active'); });
        card.classList.add('active');
    });

    // 书签路径选择变更
    bookmarkRootPath.addEventListener('change', function() {
        var showCustom = this.value === 'custom:';
        if (customNameGroup) customNameGroup.style.display = showCustom ? 'block' : 'none';
        updatePathPreview(this.value);
    });
    if (customFolderName) {
        customFolderName.addEventListener('input', function() {
            updatePathPreview('custom:');
        });
    }

    // 自动同步开关
    if (autoSyncCheck) {
        autoSyncCheck.addEventListener('change', function() {
            if (autoSyncConfig) autoSyncConfig.style.display = this.checked ? 'block' : 'none';
        });
    }

    // 保存按钮
    saveConfigBtn.addEventListener('click', saveSyncSettingsHandler);

    if (saveAutoSyncBtn) {
        saveAutoSyncBtn.addEventListener('click', function() {
            var data = {};
            data.enableNotify = enableNotifyCheck.checked;
            data.autoDownload = autoDownloadCheck.checked;
            data.autoSync = autoSyncCheck.checked;
            data.autoSyncInterval = parseInt(autoSyncInterval.value, 10) || 60;
            data.autoSyncDirection = autoSyncDirection.value;
            saveAutoSyncBtn.disabled = true;
            saveAutoSyncBtn.textContent = '保存中...';
            saveSyncSettings(data, function () {
                saveAutoSyncBtn.disabled = false;
                saveAutoSyncBtn.textContent = '保存配置';
                showToast('同步设置已保存');
            });
        });
    }
    saveThemeBtn.addEventListener('click', saveThemeHandler);
    savePathBtn.addEventListener('click', savePathHandler);

    // 手动同步按钮
    if (manualUploadBtn) {
        manualUploadBtn.addEventListener('click', function() {
            showToast('正在上传书签...');
            chrome.runtime.sendMessage({ name: 'upload' }, function (res) {
                if (chrome.runtime.lastError) {
                    showToast('上传失败: ' + chrome.runtime.lastError.message);
                    return;
                }
                showToast(res.message || '上传成功');
            });
        });
    }
    if (manualDownloadBtn) {
        manualDownloadBtn.addEventListener('click', function() {
            if (!confirm('⚠️ 下载操作将先清空本地所有书签，再从 Gist 拉取数据覆盖。\n\n此操作不可撤销，确定继续？')) return;
            showToast('正在下载书签...');
            chrome.runtime.sendMessage({ name: 'download' }, function (res) {
                if (chrome.runtime.lastError) {
                    showToast('下载失败: ' + chrome.runtime.lastError.message);
                    return;
                }
                showToast(res.message || '下载成功');
            });
        });
    }
    if (manualClearBtn) {
        manualClearBtn.addEventListener('click', function() {
            if (!confirm('⚠️ 将永久删除本地全部书签，此操作不可撤销！\n\n确定继续？')) return;
            showToast('正在清空书签...');
            chrome.runtime.sendMessage({ name: 'clearAll' }, function (res) {
                if (chrome.runtime.lastError) {
                    showToast('清空失败: ' + chrome.runtime.lastError.message);
                    return;
                }
                showToast(res.message || '清空成功');
            });
        });
    }

    // 回车保存（同步设置页）
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            saveSyncSettingsHandler();
        }
    });
}

function init() {
    initDOM();
    loadSettings();
    bindEvents();
}

document.addEventListener('DOMContentLoaded', init);