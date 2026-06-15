/**
 * SnipMemo - popup.js
 * Handles screenshot capture, image upload, OCR, and save flow.
 */

let capturedImageDataUrl = null;
let ocrResult = null;

document.addEventListener('DOMContentLoaded', () => {
  // Panel references
  const panelCapture = document.getElementById('panelCapture');
  const panelOCR = document.getElementById('panelOCR');
  const panelSuccess = document.getElementById('panelSuccess');

  // Buttons
  const btnScreenshot = document.getElementById('btnScreenshot');
  const btnOpenApp = document.getElementById('btnOpenApp');
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const btnCancelOCR = document.getElementById('btnCancelOCR');
  const btnSaveOCR = document.getElementById('btnSaveOCR');
  const btnNewCapture = document.getElementById('btnNewCapture');
  const btnViewLibrary = document.getElementById('btnViewLibrary');

  // Show a specific panel
  function showPanel(panel) {
    [panelCapture, panelOCR, panelSuccess].forEach((p) => p.classList.remove('active'));
    panel.classList.add('active');
  }

  // Reset OCR state
  function resetOCR() {
    capturedImageDataUrl = null;
    ocrResult = null;
    document.getElementById('ocrPreview').innerHTML = '';
    document.getElementById('ocrProgress').style.display = 'block';
    document.getElementById('ocrStatus').textContent = 'Processing image...';
    document.getElementById('ocrForm').style.display = 'none';
    document.getElementById('ocrTitle').value = '';
    document.getElementById('ocrContent').value = '';
    document.getElementById('ocrKeywordsGroup').style.display = 'none';
    document.getElementById('ocrKeywords').textContent = '';
  }

  // Load folders into select
  function loadFoldersIntoSelect(selectEl) {
    getFolders().then((folders) => {
      selectEl.innerHTML = '';
      const visible = folders.filter((f) => f.id !== '_all');
      visible.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        selectEl.appendChild(opt);
      });
      if (visible.length === 0) {
        const opt = document.createElement('option');
        opt.value = '_uncategorized';
        opt.textContent = 'Uncategorized';
        selectEl.appendChild(opt);
      }
    }).catch(() => {
      selectEl.innerHTML = '<option value="_uncategorized">Uncategorized</option>';
    });
  }

  // Start OCR on an image
  function startOCR(dataUrl) {
    capturedImageDataUrl = dataUrl;
    resetOCR();
    showPanel(panelOCR);

    // Show preview
    const preview = document.getElementById('ocrPreview');
    const img = document.createElement('img');
    img.src = dataUrl;
    preview.appendChild(img);

    // Attempt OCR
    if (typeof Tesseract !== 'undefined') {
      performOCR(dataUrl).then((result) => {
        ocrResult = result;
        document.getElementById('ocrProgress').style.display = 'none';
        document.getElementById('ocrForm').style.display = 'block';
        document.getElementById('ocrTitle').value = result.title || '';
        document.getElementById('ocrContent').value = result.text || '';

        if (result.keywords && result.keywords.length > 0) {
          document.getElementById('ocrKeywordsGroup').style.display = 'block';
          document.getElementById('ocrKeywords').textContent = result.keywords.join(', ');
        }

        loadFoldersIntoSelect(document.getElementById('ocrFolder'));
      }).catch((err) => {
        console.warn('OCR failed:', err);
        showManualForm('OCR unavailable. You can still save the image.');
      });
    } else {
      showManualForm('Tesseract.js not loaded. You can still save the image.');
    }
  }

  function showManualForm(message) {
    document.getElementById('ocrProgress').style.display = 'none';
    document.getElementById('ocrForm').style.display = 'block';
    document.getElementById('ocrStatus').textContent = message;
    loadFoldersIntoSelect(document.getElementById('ocrFolder'));
  }

  /* ---- Button Handlers ---- */

  // Screenshot
  btnScreenshot.addEventListener('click', () => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        alert('Could not capture: ' + chrome.runtime.lastError.message);
        return;
      }
      startOCR(dataUrl);
    });
  });

  // Upload via click
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileToDataUrl(file).then((dataUrl) => startOCR(dataUrl));
    fileInput.value = '';
  });

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--accent)';
  });
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.borderColor = '';
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    fileToDataUrl(file).then((dataUrl) => startOCR(dataUrl));
  });

  // Cancel OCR
  btnCancelOCR.addEventListener('click', () => {
    resetOCR();
    showPanel(panelCapture);
  });

  // Save note
  btnSaveOCR.addEventListener('click', () => {
    const title = document.getElementById('ocrTitle').value.trim() || 'Untitled';
    const content = document.getElementById('ocrContent').value.trim() || '';
    const folderId = document.getElementById('ocrFolder').value || '_uncategorized';

    const images = capturedImageDataUrl ? [capturedImageDataUrl] : [];
    const keywords = ocrResult ? ocrResult.keywords : extractKeywords(content);

    const note = {
      title,
      content,
      folderId,
      images,
      timestamp: Date.now(),
      ocrKeywords: keywords
    };

    addNote(note).then(() => {
      showPanel(panelSuccess);
    }).catch((err) => {
      alert('Failed to save note: ' + err.message);
    });
  });

  // New capture
  btnNewCapture.addEventListener('click', () => {
    resetOCR();
    showPanel(panelCapture);
  });

  // View library
  btnViewLibrary.addEventListener('click', () => {
    openAppPage();
  });

  // Open app
  btnOpenApp.addEventListener('click', () => {
    openAppPage();
  });

  // OCR progress listener
  window.addEventListener('ocr-progress', (e) => {
    const pct = Math.round((e.detail.progress || 0) * 100);
    document.getElementById('ocrStatus').textContent = 'Recognizing text... ' + pct + '%';
  });
});
