// ========== 面板激活 ==========
function setActivePanel(panelId) {
    activePanelId = panelId;
    panel1El.classList.toggle('panel-active', panelId === 'panel1');
    panel2El.classList.toggle('panel-active', panelId === 'panel2');
}

// ========== 清空面板 ==========
function clearPanel(panelId) {
    if (panelId === 'panel1') {
        panel1Path = [];
        panelBody1.innerHTML = '<div class="empty-state"><span>📭 暂无内容</span></div>';
        panel1Title.textContent = '📂 工作区 1';
    } else {
        panel2Path = [];
        panelBody2.innerHTML = '<div class="empty-state"><span>📭 暂无内容</span></div>';
        panel2Title.textContent = '📂 工作区 2';
    }
    saveState();
    showToast('面板已清空');
}

// ========== 面板渲染 ==========
function renderPanel(bodyEl, pathArray, titleEl, titleName) {
    bodyEl.innerHTML = '';
    if (!pathArray || !pathArray.length) {
        bodyEl.innerHTML = '<div class="empty-state"><span>📭 暂无内容</span></div>';
        return;
    }
    pathArray.forEach((colData, i) => {
        const col = createColumn(colData, i, bodyEl);
        bodyEl.appendChild(col);
    });
    if (titleEl) titleEl.textContent = `📂 ${titleName || pathArray[0]?.title || '工作区'}`;
    requestAnimationFrame(() => {
        const last = bodyEl.lastElementChild;
        if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
    });
}

function createColumn(colData, colIndex, currentBodyEl) {
    const div = document.createElement('div');
    div.className = 'column';
    div.style.borderLeft = getLevelBorderStyle(colIndex);

    // 应用持久化的列尺寸
    var savedW = localStorage.getItem('workspace_columnWidth');
    var savedH = localStorage.getItem('workspace_columnMaxHeight');
    if (savedW) div.style.width = savedW + 'px';
    if (savedH) div.style.maxHeight = savedH + 'px';

    // 宽度拖拽把手
    var wHandle = document.createElement('div');
    wHandle.className = 'column-resize-w';
    wHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        wHandle.classList.add('resizing');
        var startX = e.clientX;
        var startW = div.offsetWidth;
        function onMove(ev) {
            var newW = Math.max(120, Math.min(800, startW + (ev.clientX - startX)));
            div.style.width = newW + 'px';
        }
        function onUp() {
            wHandle.classList.remove('resizing');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            localStorage.setItem('workspace_columnWidth', div.offsetWidth);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    div.appendChild(wHandle);

    // 高度拖拽把手
    var hHandle = document.createElement('div');
    hHandle.className = 'column-resize-h';
    hHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        hHandle.classList.add('resizing');
        var startY = e.clientY;
        var startH = div.offsetHeight;
        function onMove(ev) {
            var newH = Math.max(120, Math.min(900, startH + (ev.clientY - startY)));
            div.style.maxHeight = newH + 'px';
        }
        function onUp() {
            hHandle.classList.remove('resizing');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            localStorage.setItem('workspace_columnMaxHeight', parseInt(div.style.maxHeight));
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    div.appendChild(hHandle);

    var header = document.createElement('div');
    header.className = 'column-header';
    header.textContent = colData.title;
    div.appendChild(header);
    var body = document.createElement('div');
    body.className = 'column-body';
    var children = colData.children || [];
    if (!children.length) {
        var empty = document.createElement('div');
        empty.className = 'item';
        empty.style.color = 'var(--text-secondary)';
        empty.textContent = '（空文件夹）';
        body.appendChild(empty);
    } else {
        var folders = children.filter(function(c) { return !c.url && c.children; }).sort(function(a, b) { return a.title.localeCompare(b.title, 'zh-CN'); });
        var bms = children.filter(function(c) { return !!c.url; }).sort(function(a, b) { return a.title.localeCompare(b.title, 'zh-CN'); });
        var allItems = folders.concat(bms);
        allItems.forEach(function(child) { body.appendChild(createItemElement(child, colIndex, currentBodyEl)); });
    }
    div.appendChild(body);
    return div;
}

function createItemElement(node, colIndex, bodyEl) {
    const isFolder = !node.url && node.children;
    const item = document.createElement('div');
    item.className = 'item';
    item.classList.add(isFolder ? 'folder-item' : 'bookmark-item');
    const isPanel1 = bodyEl === panelBody1 || panelBody1.contains(bodyEl);
    const pathRef = isPanel1 ? panel1Path : panel2Path;
    if (isFolder && colIndex + 1 < pathRef.length && pathRef[colIndex + 1].id === node.id) {
        item.classList.add('expanded');
    }
    const icon = document.createElement('span');
    icon.className = 'item-icon';
    icon.textContent = isFolder ? '📁' : '🔗';
    item.appendChild(icon);
    const text = document.createElement('span');
    text.className = 'item-text';
    text.textContent = node.title || '（无标题）';
    text.title = node.title || '';
    item.appendChild(text);
    if (isFolder && node.children) {
        const cnt = document.createElement('span');
        cnt.className = 'item-count';
        cnt.textContent = countAllDescendants(node);
        item.appendChild(cnt);
    }
    if (isFolder) {
        const arrow = document.createElement('span');
        arrow.className = 'item-arrow';
        arrow.textContent = '›';
        item.appendChild(arrow);
    }
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isFolder) handleFolderClick(node, colIndex, bodyEl);
        else handleBookmarkClick(node);
    });
    return item;
}

function handleFolderClick(folderNode, colIndex, bodyEl) {
    const isPanel1 = bodyEl === panelBody1 || panelBody1.contains(bodyEl);
    let path = isPanel1 ? [...panel1Path] : [...panel2Path];
    if (colIndex + 1 < path.length && path[colIndex + 1].id === folderNode.id) {
        path = path.slice(0, colIndex + 1);
    } else {
        path = path.slice(0, colIndex + 1);
        path.push({ id: folderNode.id, title: folderNode.title, children: folderNode.children || [] });
    }
    if (isPanel1) panel1Path = path; else panel2Path = path;
    const titleEl = isPanel1 ? panel1Title : panel2Title;
    renderPanel(bodyEl, path, titleEl, path[0]?.title || '');
    saveState();
}

function handleBookmarkClick(node) {
    if (node.url) {
        chrome.tabs.create({ url: node.url, active: true });
        showToast('已打开');
    }
}

// ========== 工作区加载 ==========
async function loadWorkspaceIntoPanel(workspaceId, bodyEl, pathVarName, titleEl, titleName) {
    let newPath = [];
    if (workspaceId === '__all__') {
        newPath.push({ id: '__all_root__', title: '全部工作区', children: workspaceFolders.map(f => ({ ...f })), _isVirtual: true });
    } else {
        const ws = workspaceFolders.find(f => f.id === workspaceId);
        if (!ws) return;
        newPath.push({ id: ws.id, title: ws.title, children: ws.children || [] });
    }
    if (pathVarName === 'panel1Path') panel1Path = newPath; else panel2Path = newPath;
    renderPanel(bodyEl, newPath, titleEl, titleName);
    saveState();
}

// ========== 筛选按钮 ==========
function renderFilterButtons() {
    filterArea.innerHTML = '';
    if (!workspaceFolders.length) {
        filterArea.innerHTML = '<span style="color:var(--text-secondary)">暂无工作区</span>';
        return;
    }
    const total = workspaceFolders.reduce((s, f) => s + countAllDescendants(f), 0);
    filterArea.appendChild(addFilterBtn('__all__', '🌐 全部', total, true));
    workspaceFolders.forEach(f => filterArea.appendChild(addFilterBtn(f.id, f.title, countAllDescendants(f), false)));
}

function addFilterBtn(id, title, count, isAll) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (isAll ? ' all-btn' : '');
    btn.draggable = true;
    btn.dataset.workspaceId = id;
    btn.innerHTML = escapeHTML(title) + '<span class="count-badge">' + count + '</span>';

    btn.addEventListener('click', async function() {
        if (isSearchMode) exitSearchMode();
        const targetBody = activePanelId === 'panel1' ? panelBody1 : panelBody2;
        const targetPathVar = activePanelId === 'panel1' ? 'panel1Path' : 'panel2Path';
        const targetTitle = activePanelId === 'panel1' ? panel1Title : panel2Title;
        await loadWorkspaceIntoPanel(id, targetBody, targetPathVar, targetTitle, title);
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });

    btn.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        btn.classList.add('dragging');
    });
    btn.addEventListener('dragend', function() {
        btn.classList.remove('dragging');
    });
    return btn;
}

// ========== 拖放目标 ==========
function setupDropTargets() {
    [panelBody1, panelBody2].forEach(function(body) {
        body.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; body.classList.add('drag-over'); });
        body.addEventListener('dragleave', function() { body.classList.remove('drag-over'); });
        body.addEventListener('drop', async function(e) {
            e.preventDefault(); body.classList.remove('drag-over');
            const workspaceId = e.dataTransfer.getData('text/plain');
            if (!workspaceId) return;
            const isP1 = body === panelBody1;
            const targetBody = isP1 ? panelBody1 : panelBody2;
            const targetPathVar = isP1 ? 'panel1Path' : 'panel2Path';
            const targetTitle = isP1 ? panel1Title : panel2Title;
            const ws = workspaceId === '__all__' ? { title: '全部' } : workspaceFolders.find(f => f.id === workspaceId);
            if (!ws) return;
            await loadWorkspaceIntoPanel(workspaceId, targetBody, targetPathVar, targetTitle, ws.title);
            setActivePanel(isP1 ? 'panel1' : 'panel2');
        });
    });
}

// ========== 面板内拖拽提示元素 ==========
function initUI() {
    createDropHints();
}

function createDropHints() {
    function addHint(panelId, titleId) {
        const titleEl = document.getElementById(titleId);
        if (!titleEl) return;
        const hint = document.createElement('span');
        hint.id = 'dropHint' + panelId.replace('panel','');
        hint.className = 'drop-hint-panel';
        hint.textContent = '💡 拖拽按钮到此处即可加载内容';
        hint.style.display = 'none';
        hint.style.fontSize = '11px';
        hint.style.color = 'var(--text-secondary)';
        hint.style.marginLeft = '8px';
        hint.style.fontWeight = '400';
        titleEl.parentNode.insertBefore(hint, titleEl.nextSibling);
    }
    addHint('panel1', 'panel1Title');
    addHint('panel2', 'panel2Title');
}