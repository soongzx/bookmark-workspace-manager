// ========== 搜索 ==========
function performSearch(query) {
    if (!query || !query.trim()) { exitSearchMode(); return; }
    isSearchMode = true;
    if (dualMode) {
        panel2El.style.display = 'none';
        panelDivider.style.display = 'none';
    }
    const q = query.trim().toLowerCase();
    const results = allBookmarksFlat.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        item.pathStr.toLowerCase().includes(q)
    ).slice(0, 80);
    panelBody1.innerHTML = '';
    if (!results.length) {
        panelBody1.innerHTML = '<div class="empty-state"><span>🔍 无匹配结果</span></div>';
        panel1Title.textContent = '🔎 搜索结果';
        return;
    }
    const container = document.createElement('div');
    container.className = 'search-results';
    results.forEach(function(r) {
        const el = document.createElement('div');
        el.className = 'search-result-item';
        el.innerHTML = `<span class="result-icon">🔗</span><div class="result-info"><div class="result-title">${highlightMatch(escapeHTML(r.title), query)}</div><div class="result-path">${highlightMatch(escapeHTML(r.pathStr), query)}</div><div class="result-url">${escapeHTML(r.url || '')}</div></div>`;
        el.addEventListener('click', function() { chrome.tabs.create({ url: r.url, active: true }); });
        container.appendChild(el);
    });
    panelBody1.appendChild(container);
    panel1Title.textContent = '🔎 搜索结果';
}

function exitSearchMode() {
    if (!isSearchMode) return;
    isSearchMode = false;
    searchInput.value = '';
    searchClear.classList.remove('visible');
    document.documentElement.style.setProperty('--panel-wrap', dualMode ? 'nowrap' : 'wrap');
    if (!panel1Path.length) {
        panelBody1.innerHTML = '<div class="empty-state"><span>📭 暂无内容</span></div>';
    } else {
        renderPanel(panelBody1, panel1Path, panel1Title, panel1Path[0]?.title || '');
    }
    if (dualMode) {
        panel2El.style.display = 'flex';
        panelDivider.style.display = 'block';
    }
}

function highlightMatch(text, query) {
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp('(' + esc + ')', 'gi'), '<mark>$1</mark>');
}

// ========== 主题 ==========
function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('workspace_theme', theme);
    // 同步到统一设置
    try { saveSyncSettings({ theme: theme }, function(){}); } catch(e) {}
    document.querySelectorAll('.theme-dot').forEach(function(d) { d.classList.toggle('active', d.dataset.theme === theme); });
    if (panel1Path.length) renderPanel(panelBody1, panel1Path, panel1Title, panel1Path[0]?.title || '');
    if (dualMode && panel2Path.length) renderPanel(panelBody2, panel2Path, panel2Title, panel2Path[0]?.title || '');
}

function initTheme() {
    const saved = localStorage.getItem('workspace_theme') || 'dark-gold';
    applyTheme(saved);
}

// ========== 缩放 ==========
function setPanelScale(panelId, scale) {
    panelScales[panelId] = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    const bodyEl = panelId === 'panel1' ? panelBody1 : panelBody2;
    bodyEl.style.setProperty('--panel-scale', panelScales[panelId]);
    const valueEl = document.querySelector('.scale-group[data-panel="' + panelId + '"] .scale-value');
    if (valueEl) valueEl.textContent = Math.round(panelScales[panelId] * 100) + '%';
    localStorage.setItem('workspace_scale_' + panelId, panelScales[panelId]);
}

function initScales() {
    ['panel1', 'panel2'].forEach(function(p) {
        const saved = parseFloat(localStorage.getItem('workspace_scale_' + p)) || 1;
        setPanelScale(p, saved);
    });
}

// ========== 双面板切换 & 分隔条拖动 ==========
function setupDualMode() {
    toggleDualBtn.addEventListener('click', function() {
        dualMode = !dualMode;
        panel2El.style.display = dualMode ? 'flex' : 'none';
        panelDivider.style.display = dualMode ? 'block' : 'none';
        toggleDualBtn.classList.toggle('active', dualMode);
        document.documentElement.style.setProperty('--panel-wrap', dualMode ? 'nowrap' : 'wrap');
        if (dualMode) {
            panel1El.style.flex = '2';
            panel2El.style.flex = '1';
            if (!panel2Path.length) {
                panelBody2.innerHTML = '<div class="empty-state"><span>📭 暂无内容</span></div>';
            }
        } else {
            panel1El.style.flex = '1';
            if (activePanelId === 'panel2') setActivePanel('panel1');
        }
        saveState();
    });

    let isResizing = false;
    panelDivider.addEventListener('mousedown', function(e) { isResizing = true; e.preventDefault(); });
    window.addEventListener('mousemove', function(e) {
        if (!isResizing || !dualMode) return;
        const container = document.getElementById('panelsContainer');
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const total = rect.width;
        if (total <= 0) return;
        let leftPercent = x / total;
        leftPercent = Math.max(0.2, Math.min(0.8, leftPercent));
        panel1El.style.flex = '0 0 ' + (leftPercent * 100) + '%';
        panel2El.style.flex = '0 0 ' + ((1 - leftPercent) * 100) + '%';
    });
    window.addEventListener('mouseup', function() { isResizing = false; });
}

// ========== 持久化 ==========
function saveState() {
    localStorage.setItem('workspace_panel1Path', JSON.stringify(panel1Path));
    localStorage.setItem('workspace_panel2Path', JSON.stringify(panel2Path));
    localStorage.setItem('workspace_panel1Scale', panelScales.panel1);
    localStorage.setItem('workspace_panel2Scale', panelScales.panel2);
}

function restoreState() {
    const savedActive = localStorage.getItem('workspace_activePanel');
    if (savedActive) activePanelId = savedActive;
    const savedPath1 = localStorage.getItem('workspace_panel1Path');
    if (savedPath1) try { panel1Path = JSON.parse(savedPath1); } catch (e) {}
    const savedPath2 = localStorage.getItem('workspace_panel2Path');
    if (savedPath2) try { panel2Path = JSON.parse(savedPath2); } catch (e) {}

    dualMode = false;
    toggleDualBtn.classList.remove('active');
    panel2El.style.display = 'none';
    panelDivider.style.display = 'none';
    document.documentElement.style.setProperty('--panel-wrap', 'wrap');
    panel1El.style.flex = '1';
    setActivePanel(activePanelId);

    if (panel1Path.length) {
        renderPanel(panelBody1, panel1Path, panel1Title, panel1Path[0]?.title || '');
    } else {
        panelBody1.innerHTML = '<div class="empty-state"><span>📭 暂无内容</span></div>';
    }
    panelBody2.innerHTML = '';
}

// ========== 清理缓存 ==========
function clearAllCache() {
    localStorage.removeItem('workspace_theme');
    localStorage.removeItem('workspace_dualMode');
    localStorage.removeItem('workspace_activePanel');
    localStorage.removeItem('workspace_panel1Path');
    localStorage.removeItem('workspace_panel2Path');
    localStorage.removeItem('workspace_panel1Scale');
    localStorage.removeItem('workspace_panel2Scale');

    applyTheme('dark-gold');
    setPanelScale('panel1', 1);
    setPanelScale('panel2', 1);
    dualMode = false;
    activePanelId = 'panel1';
    panel2El.style.display = 'none';
    panelDivider.style.display = 'none';
    panel1El.style.flex = '1';
    toggleDualBtn.classList.remove('active');
    panel1Path = [];
    panel2Path = [];
    panelBody1.innerHTML = '<div class="empty-state"><span>📭 暂无内容</span></div>';
    panelBody2.innerHTML = '';
    panel1Title.textContent = '📂 工作区 1';
    panel2Title.textContent = '📂 工作区 2';
    showToast('缓存已清除');
}

// ========== 提示：在激活面板标题栏显示 ==========
function showActivePanelHint() {
    const hintId = 'dropHint' + (activePanelId === 'panel1' ? '1' : '2');
    const hintEl = document.getElementById(hintId);
    if (hintEl) hintEl.style.display = 'inline';
}

function hideActivePanelHint() {
    const hint1 = document.getElementById('dropHint1');
    const hint2 = document.getElementById('dropHint2');
    if (hint1) hint1.style.display = 'none';
    if (hint2) hint2.style.display = 'none';
}

// ========== 事件绑定与初始化 ==========
// 下载完成后刷新书签视图
async function refreshBookmarkView() {
    try {
        var tree = await chrome.bookmarks.getTree();
        bookmarkTreeRoot = tree[0];
        bookmarksBarNode = findBookmarksBar(bookmarkTreeRoot, window._bookmarkRootPath || 'auto');
        if (!bookmarksBarNode) {
            panelBody1.innerHTML = '<div class="empty-state"><span>❌ 未找到书签栏</span></div>';
            return;
        }
        workspaceFolders = (bookmarksBarNode.children || []).filter(function(c) { return !c.url && c.children; });
        allBookmarksFlat = [];
        flattenBookmarks(bookmarkTreeRoot, [], allBookmarksFlat);
        renderFilterButtons();
        setupDropTargets();
        document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
        panelBody1.innerHTML = '<div class="empty-state"><span>📭 暂无内容</span></div>';
        panelBody2.innerHTML = '';
        panel1Title.textContent = '📂 工作区 1';
        panel2Title.textContent = '📂 工作区 2';
    } catch (e) {
        console.error(e);
        panelBody1.innerHTML = '<div class="empty-state"><span>❌ 加载失败</span></div>';
    }
}

function bindEvents() {
    // 搜索框事件
    let debounce;
    searchInput.addEventListener('input', function() {
        const val = searchInput.value.trim();
        searchClear.classList.toggle('visible', val.length > 0);
        clearTimeout(debounce);
        if (!val) { exitSearchMode(); return; }
        debounce = setTimeout(function() { performSearch(val); }, 200);
    });
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { clearTimeout(debounce); performSearch(searchInput.value.trim()); }
        if (e.key === 'Escape') { exitSearchMode(); searchInput.blur(); }
    });
    searchClear.addEventListener('click', function() { exitSearchMode(); searchInput.focus(); });
    document.addEventListener('keydown', function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
            e.preventDefault(); searchInput.focus(); searchInput.select();
        }
    });

    // 面板激活事件（鼠标移入/点击切换）
    panel1El.addEventListener('mouseenter', function() { setActivePanel('panel1'); });
    panel1El.addEventListener('click', function() { setActivePanel('panel1'); });
    panel2El.addEventListener('mouseenter', function() { setActivePanel('panel2'); });
    panel2El.addEventListener('click', function() { setActivePanel('panel2'); });

    // 清空面板按钮
    clearPanel1Btn.addEventListener('click', function() { clearPanel('panel1'); });
    clearPanel2Btn.addEventListener('click', function() { clearPanel('panel2'); });

    // 主题切换
    themeSwitcher.addEventListener('click', function(e) {
        const dot = e.target.closest('.theme-dot');
        if (dot) applyTheme(dot.dataset.theme);
    });

    // 缩放按钮
    document.querySelectorAll('.scale-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const panelId = btn.closest('.scale-group').dataset.panel;
            if (btn.classList.contains('zoom-in')) {
                setPanelScale(panelId, panelScales[panelId] + STEP);
            } else if (btn.classList.contains('zoom-out')) {
                setPanelScale(panelId, panelScales[panelId] - STEP);
            }
        });
    });

    // ========== 拖拽提示：鼠标进入筛选区时，在激活面板标题栏显示提示 ==========
    toolbar.addEventListener('mouseenter', function() {
        showActivePanelHint();
    });
    toolbar.addEventListener('mouseleave', function() {
        hideActivePanelHint();
    });

    // 关于页面按钮
    const aboutBtn = document.getElementById('aboutBtn');
    if (aboutBtn) {
        aboutBtn.addEventListener('click', function() {
            chrome.tabs.create({ url: chrome.runtime.getURL('about.html') });
        });
    }

    // 清理缓存按钮
    clearCacheBtn.addEventListener('click', clearAllCache);

    // 同步按钮事件（仅保留手动下载）
    document.getElementById('downloadBtn').addEventListener('click', function () {
        if (!confirm('⚠️ 下载操作将先清空本地所有书签，再从 Gist 拉取数据覆盖。\n\n此操作不可撤销，确定继续？')) return;
        showToast('正在下载书签...');
        chrome.runtime.sendMessage({ name: 'download' }, function (res) {
            if (chrome.runtime.lastError) {
                showToast('下载失败: ' + chrome.runtime.lastError.message);
                return;
            }
            showToast(res.message);
            // 下载完成后刷新视图
            localStorage.removeItem('workspace_panel1Path');
            localStorage.removeItem('workspace_panel2Path');
            panel1Path = [];
            panel2Path = [];
            refreshBookmarkView();
        });
    });

    document.getElementById('settingsBtn').addEventListener('click', function () {
        chrome.runtime.sendMessage({ name: 'openSettings' });
    });

    // 双面板相关（切换、分隔条拖动）
    setupDualMode();
}

// ========== 主初始化 ==========
async function init() {
    initDOM();
    // 版本号从 manifest.json 动态获取
    try {
        const manifest = chrome.runtime.getManifest();
        document.getElementById('appVersion').textContent = 'v' + manifest.version;
    } catch (e) {}
    initUI();           // 初始化提示元素等 UI 组件

    // 读取统一设置中的主题和书签路径
    try {
        var settings = await new Promise(function(resolve) {
            getSyncSettings(function(items) { resolve(items); });
        });
        if (settings.theme) {
            localStorage.setItem('workspace_theme', settings.theme);
        }
        window._bookmarkRootPath = settings.bookmarkRootPath || 'auto';

        // 自动下载：如果开启且配置完整，先下载再显示
        if (settings.autoDownload && settings.githubToken && settings.gistID && settings.gistFileName) {
            panelBody1.innerHTML = '<div class="empty-state"><span>⏳ 正在自动同步书签...</span></div>';
            var dlResult = await new Promise(function(resolve) {
                chrome.runtime.sendMessage({ name: 'download' }, function(res) {
                    resolve(res);
                });
            });
            if (dlResult && dlResult.success) {
                // 下载完成后，清除旧路径，重新加载书签树
                localStorage.removeItem('workspace_panel1Path');
                localStorage.removeItem('workspace_panel2Path');
                panel1Path = [];
                panel2Path = [];
            }
        }
    } catch (e) {
        window._bookmarkRootPath = 'auto';
    }

    initTheme();
    initScales();
    panel2El.style.display = 'none';
    panelDivider.style.display = 'none';
    panel1El.style.flex = '1';
    document.documentElement.style.setProperty('--panel-wrap', 'wrap');
    setActivePanel('panel1');

    panelBody1.innerHTML = '<div class="empty-state"><span>⏳ 加载书签中...</span></div>';
    panelBody2.innerHTML = '';

    try {
        const tree = await chrome.bookmarks.getTree();
        bookmarkTreeRoot = tree[0];
        bookmarksBarNode = findBookmarksBar(bookmarkTreeRoot, window._bookmarkRootPath || 'auto');
        if (!bookmarksBarNode) {
            panelBody1.innerHTML = '<div class="empty-state"><span>❌ 未找到书签栏</span></div>';
            return;
        }
        workspaceFolders = (bookmarksBarNode.children || []).filter(function(c) { return !c.url && c.children; });
        allBookmarksFlat = [];
        flattenBookmarks(bookmarkTreeRoot, [], allBookmarksFlat);
        renderFilterButtons();
        setupDropTargets();

        // 确保初始化后没有任何按钮处于高亮状态
        document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });

        const hasSaved = localStorage.getItem('workspace_panel1Path');
        if (hasSaved) {
            restoreState();
        } else {
            panelBody1.innerHTML = '<div class="empty-state"><span>📭 暂无内容</span></div>';
        }
        bindEvents();
    } catch (e) {
        console.error(e);
        panelBody1.innerHTML = '<div class="empty-state"><span>❌ 加载失败</span></div>';
    }
}

document.addEventListener('DOMContentLoaded', init);