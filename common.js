/**
 * SnipMemo - common.js
 * Shared IndexedDB operations, OCR, and keyword extraction.
 * All data stored locally. Zero external API.
 */

/* ------------------------------------------------------------------ */
/*  IndexedDB                                                         */
/* ------------------------------------------------------------------ */

const DB_NAME = 'SnipMemo';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
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

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Utility: generate short unique id                                  */
/* ------------------------------------------------------------------ */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

/* ------------------------------------------------------------------ */
/*  Notes CRUD                                                        */
/* ------------------------------------------------------------------ */

function addNote(note) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const record = {
        id: generateId(),
        title: note.title || 'Untitled',
        content: note.content || '',
        folderId: note.folderId || '_uncategorized',
        images: note.images || [],
        timestamp: note.timestamp || Date.now(),
        ocrKeywords: note.ocrKeywords || []
      };
      const request = store.add(record);
      request.onsuccess = () => resolve(record);
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

function getNotes(folderId) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        let notes = request.result;
        notes.sort((a, b) => b.timestamp - a.timestamp);
        if (folderId !== undefined && folderId !== null) {
          notes = notes.filter((n) => n.folderId === folderId);
        }
        resolve(notes);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

function getNote(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

function updateNote(id, updates) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const note = getReq.result;
        if (!note) { reject(new Error('Note not found')); return; }
        Object.assign(note, updates);
        const putReq = store.put(note);
        putReq.onsuccess = () => resolve(note);
        putReq.onerror = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  });
}

function deleteNote(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Folders CRUD                                                      */
/* ------------------------------------------------------------------ */

function addFolder(folder) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readwrite');
      const store = tx.objectStore('folders');
      const record = {
        id: generateId(),
        name: folder.name || 'New Folder',
        parentId: folder.parentId || null
      };
      const request = store.add(record);
      request.onsuccess = () => resolve(record);
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

function getFolders() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readonly');
      const store = tx.objectStore('folders');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

function updateFolder(id, updates) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readwrite');
      const store = tx.objectStore('folders');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const folder = getReq.result;
        if (!folder) { reject(new Error('Folder not found')); return; }
        Object.assign(folder, updates);
        const putReq = store.put(folder);
        putReq.onsuccess = () => resolve(folder);
        putReq.onerror = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  });
}

function deleteFolder(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['folders', 'notes'], 'readwrite');
      const folderStore = tx.objectStore('folders');
      const noteStore = tx.objectStore('notes');
      const idx = noteStore.index('folderId');

      // Move notes in this folder to uncategorized
      const cursorReq = idx.openCursor(IDBKeyRange.only(id));
      cursorReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const note = cursor.value;
          note.folderId = '_uncategorized';
          cursor.update(note);
          cursor.continue();
        }
      };

      folderStore.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

function searchNotes(query) {
  if (!query || !query.trim()) return getNotes();
  const q = query.toLowerCase().trim();
  const keywords = q.split(/\s+/).filter((k) => k.length > 0);

  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        let notes = request.result;
        notes = notes.filter((n) => {
          const title = (n.title || '').toLowerCase();
          const content = (n.content || '').toLowerCase();
          const ocrKws = (n.ocrKeywords || []).join(' ').toLowerCase();
          const haystack = title + ' ' + content + ' ' + ocrKws;
          return keywords.every((kw) => haystack.includes(kw));
        });
        notes.sort((a, b) => b.timestamp - a.timestamp);
        resolve(notes);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Local Q&A: keyword-match across notes                             */
/* ------------------------------------------------------------------ */

function localQA(question) {
  if (!question || !question.trim()) return Promise.resolve([]);
  const q = question.toLowerCase().trim();
  const keywords = q.split(/\s+/).filter((k) => k.length > 0);

  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result;
        const results = [];

        notes.forEach((n) => {
          const title = (n.title || '').toLowerCase();
          const contentText = (n.content || '').replace(/<[^>]*>/g, '').toLowerCase();
          const ocrKws = (n.ocrKeywords || []).join(' ').toLowerCase();
          const haystack = title + ' ' + contentText + ' ' + ocrKws;

          let matchCount = 0;
          keywords.forEach((kw) => {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(escaped, 'gi');
            const matches = haystack.match(re);
            if (matches) matchCount += matches.length;
          });

          if (matchCount > 0) {
            results.push({ note: n, score: matchCount });
          }
        });

        results.sort((a, b) => b.score - a.score);
        resolve(results);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Keyword extraction (simple TF-based)                               */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','must','can',
  'could','i','me','my','we','our','you','your','he','she','it','they','them',
  'this','that','these','those','in','on','at','to','for','of','with','from',
  'by','about','as','into','through','during','before','after','above','below',
  'between','and','but','or','nor','not','so','if','then','else','when','where',
  'why','how','all','each','every','both','few','more','most','other','some',
  'such','only','own','same','than','too','very','just','now','up','down',
  'out','off','over','under','again','further','once','here','there','which',
  'who','whom','what','no','any','also','its'
]);

function extractKeywords(text, maxKeywords = 8) {
  if (!text || !text.trim()) return [];

  // Normalize: lowercase, strip HTML
  const clean = text.replace(/<[^>]*>/g, ' ').toLowerCase();
  const words = clean.match(/\b[a-z]{2,}\b/g) || [];

  const freq = {};
  words.forEach((w) => {
    if (STOP_WORDS.has(w)) return;
    freq[w] = (freq[w] || 0) + 1;
  });

  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  return sorted;
}

/* ------------------------------------------------------------------ */
/*  OCR via Tesseract.js (CDN-loaded at call site)                     */
/* ------------------------------------------------------------------ */

function performOCR(imageDataUrl) {
  // tesseract.js must be available globally (loaded via <script> in HTML)
  if (typeof Tesseract === 'undefined') {
    return Promise.reject(new Error('Tesseract.js not loaded.'));
  }

  return Tesseract.recognize(imageDataUrl, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        // progress can be emitted via custom event if needed
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('ocr-progress', {
            detail: { progress: m.progress, status: m.status }
          }));
        }
      }
    }
  }).then((result) => {
    const text = result.data.text || '';
    const confidence = result.data.confidence || 0;

    // Suggest title: first line or first ~40 chars
    const lines = text.split('\n').filter((l) => l.trim());
    let suggestedTitle = '';
    if (lines.length > 0) {
      suggestedTitle = lines[0].trim().substring(0, 50);
    }

    const keywords = extractKeywords(text);

    return {
      text: text,
      title: suggestedTitle,
      keywords: keywords,
      confidence: confidence
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Image to base64 Data URL helper                                    */
/* ------------------------------------------------------------------ */

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ */
/*  Open app page helper                                               */
/* ------------------------------------------------------------------ */

function openAppPage() {
  const url = chrome.runtime.getURL('app.html');
  chrome.tabs.create({ url });
}
