// ========== 统一设置读写模块 ==========
// 被 background.js (importScripts) 和 settings.html (<script>) 共用
// 使用 chrome.storage.sync 持久化设置

var SYNC_DEFAULTS = {
    githubToken: '',
    gistID: '',
    gistFileName: 'BookmarkHub',
    enableNotify: true,
    autoDownload: false,
    autoSync: false,
    autoSyncInterval: 60,
    autoSyncDirection: 'download',
    theme: 'dark-gold',
    bookmarkRootPath: 'auto'
};

function getSyncSettings(callback) {
    chrome.storage.sync.get(SYNC_DEFAULTS, function (items) {
        callback(items);
    });
}

function saveSyncSettings(data, callback) {
    chrome.storage.sync.set(data, function () {
        if (callback) callback();
    });
}