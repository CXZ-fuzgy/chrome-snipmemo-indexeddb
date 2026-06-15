/**
 * SnipMemo - background.js
 * Manifest V3 service worker.
 * Handles installation setup and cross-component messaging.
 */

// When the service worker starts, seed default folders if needed
chrome.runtime.onInstalled.addListener(() => {
  seedDefaults();
});

// Also run when worker starts (in case onInstalled already fired)
seedDefaults();

function seedDefaults() {
  const dbReq = indexedDB.open('SnipMemo', 1);

  dbReq.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('notes')) {
      const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
      notesStore.createIndex('folderId', 'folderId', { unique: false });
      notesStore.createIndex('timestamp', 'timestamp', { unique: false });
    }
    if (!db.objectStoreNames.contains('folders')) {
      const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
      foldersStore.createIndex('name', 'name', { unique: false });
    }
  };

  dbReq.onsuccess = (event) => {
    const db = event.target.result;
    seedDefaultFolders(db);
  };

  dbReq.onerror = (err) => {
    console.warn('SnipMemo: DB open failed in SW:', err.target.error);
  };
}

function seedDefaultFolders(db) {
  try {
    const tx = db.transaction('folders', 'readwrite');
    const store = tx.objectStore('folders');

    const defaults = [
      { id: '_all', name: 'All Notes' },
      { id: '_uncategorized', name: 'Uncategorized' }
    ];

    defaults.forEach((d) => {
      const req = store.get(d.id);
      req.onsuccess = () => {
        if (!req.result) {
          store.add(d);
        }
      };
    });
  } catch (e) {
    // Silently ignore if store not ready yet
  }
}

// Handle messages from popup or app pages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openApp') {
    chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
