importScripts('js/sync-settings.js', 'js/sync-gist.js');

chrome.action.onClicked.addListener(function () {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});

// ========== 自动同步（定时任务） ==========
var AUTO_SYNC_ALARM = 'autoSyncAlarm';

function scheduleAutoSync(settings) {
    chrome.alarms.clear(AUTO_SYNC_ALARM, function () {
        if (settings.autoSync && settings.githubToken && settings.gistID && settings.gistFileName) {
            chrome.alarms.create(AUTO_SYNC_ALARM, {
                periodInMinutes: settings.autoSyncInterval || 60
            });
            console.log('[AutoSync] 已启动，间隔:', settings.autoSyncInterval, '分钟，方向:', settings.autoSyncDirection);
        }
    });
}

// 启动时检查是否需要启动自动同步
getSyncSettings(function (settings) {
    scheduleAutoSync(settings);
});

// 监听设置变更，重新调度自动同步
chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync') {
        getSyncSettings(function (settings) {
            scheduleAutoSync(settings);
        });
    }
});

// 定时任务触发
chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm.name !== AUTO_SYNC_ALARM) return;
    getSyncSettings(function (settings) {
        if (!settings.autoSync || !settings.githubToken || !settings.gistID || !settings.gistFileName) return;
        var direction = settings.autoSyncDirection || 'download';
        if (direction === 'download') {
            downloadBookmarks(function (err, result) {
                if (err) {
                    console.error('[AutoSync] 下载失败:', err.message);
                } else {
                    console.log('[AutoSync] 下载完成:', result.count, '条书签');
                    if (settings.enableNotify) {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'icons/icon48.png',
                            title: '自动同步',
                            message: '已从云端下载 ' + result.count + ' 条书签'
                        });
                    }
                }
            });
        } else {
            uploadBookmarks(function (err, result) {
                if (err) {
                    console.error('[AutoSync] 上传失败:', err.message);
                } else {
                    console.log('[AutoSync] 上传完成:', result.count, '条书签');
                    if (settings.enableNotify) {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'icons/icon48.png',
                            title: '自动同步',
                            message: '已上传 ' + result.count + ' 条书签到云端'
                        });
                    }
                }
            });
        }
    });
});

// ========== 消息路由 ==========
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.name === 'upload') {
        uploadBookmarks(function (err, result) {
            sendResponse({
                success: !err,
                message: err ? err.message : ('成功上传 ' + (result ? result.count : 0) + ' 条书签')
            });
        });
        return true;
    }

    if (msg.name === 'download') {
        downloadBookmarks(function (err, result) {
            sendResponse({
                success: !err,
                message: err ? err.message : ('成功下载 ' + (result ? result.count : 0) + ' 条书签')
            });
        });
        return true;
    }

    if (msg.name === 'clearAll') {
        getSyncSettings(function (settings) {
            if (!settings.githubToken || !settings.gistID || !settings.gistFileName) {
                sendResponse({ success: false, message: '请先在设置中配置 GitHub Token、Gist ID 和文件名' });
                return;
            }
            clearAllBookmarks(function (err) {
                if (err) {
                    sendResponse({ success: false, message: err.message });
                } else {
                    if (settings.enableNotify) {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'icons/icon48.png',
                            title: '清空书签',
                            message: '本地所有书签已清空'
                        });
                    }
                    sendResponse({ success: true, message: '本地书签已清空' });
                }
            });
        });
        return true;
    }

    if (msg.name === 'openSettings') {
        chrome.runtime.openOptionsPage();
        sendResponse(true);
        return false;
    }
});