try {
    const manifest = chrome.runtime.getManifest();
    document.getElementById('appVersion').textContent = 'v' + manifest.version;
} catch (e) {
    document.getElementById('appVersion').textContent = 'v1.0';
}

document.getElementById('closeBtn').addEventListener('click', function () {
    window.close();
});