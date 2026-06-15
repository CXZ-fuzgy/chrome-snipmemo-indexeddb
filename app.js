/**
 * SnipMemo - app.js
 * Main knowledge base application logic.
 * Handles folder CRUD, notes display/editor, search, and local Q&A.
 */

let state = {
  folders: [],
  notes: [],
  activeFolderId: null,
  searchQuery: '',
  editingNoteId: null
};

/* ------------------------------------------------------------------ */
/*  Initialization                                                     */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  bindEvents();
});

async function initApp() {
  try {
    const folders = await getFolders();
    // Ensure default folders exist
    const hasAll = folders.some((f) => f.id === '_all');
    const hasUncat = folders.some((f) => f.id === '_uncategorized');

    if (!hasAll) await addFolder({ id: '_all', name: 'All Notes' });
    if (!hasUncat) await addFolder({ id: '_uncategorized', name: 'Uncategorized' });

    state.folders = await getFolders();
    state.activeFolderId = '_all';
    renderFolders();
    await loadNotes();
  } catch (err) {
    console.error('App init failed:', err);
  }
}

/* ------------------------------------------------------------------ */
/*  Event bindings                                                     */
/* ------------------------------------------------------------------ */

function bindEvents() {
  // FAB - new note
  document.getElementById('fabNewNote').addEventListener('click', () => openEditor(null));

  // Search
  const searchInput = document.getElementById('searchInput');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = searchInput.value.trim();
      loadNotes();
    }, 300);
  });

  // New folder
  document.getElementById('btnNewFolder').addEventListener('click', promptNewFolder);

  // Mobile menu
  document.getElementById('btnMobileMenu').addEventListener('click', toggleSidebar);
  document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);

  // QA panel
  document.getElementById('qaHeader').addEventListener('click', toggleQAPanel);
  document.getElementById('qaSearchBtn').addEventListener('click', runLocalQA);
  document.getElementById('qaInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runLocalQA();
  });
}

/* ------------------------------------------------------------------ */
/*  Sidebar / Mobile                                                   */
/* ------------------------------------------------------------------ */

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar.classList.toggle('open');
  backdrop.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
}

/* ------------------------------------------------------------------ */
/*  Folders                                                            */
/* ------------------------------------------------------------------ */

async function renderFolders() {
  const list = document.getElementById('folderList');
  list.innerHTML = '';

  state.folders.forEach((folder) => {
    const item = document.createElement('div');
    item.className = 'folder-item';
    if (folder.id === state.activeFolderId) item.classList.add('active');
    item.dataset.folderId = folder.id;

    // Icon
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.setAttribute('class', 'folder-icon');
    if (folder.id === '_all') {
      icon.innerHTML = '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>';
    } else if (folder.id === '_uncategorized') {
      icon.innerHTML = '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>';
    } else {
      icon.innerHTML = '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>';
    }
    item.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = folder.name;
    item.appendChild(name);

    // Count (rendered after notes load)
    const count = document.createElement('span');
    count.className = 'folder-count';
    count.textContent = getFolderCount(folder.id);
    item.appendChild(count);

    // Actions (rename/delete for user-created folders)
    if (folder.id !== '_all' && folder.id !== '_uncategorized') {
      const actions = document.createElement('span');
      actions.className = 'folder-actions';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'mini-btn';
      renameBtn.title = 'Rename';
      renameBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      renameBtn.addEventListener('click', (e) => { e.stopPropagation(); promptRenameFolder(folder); });
      actions.appendChild(renameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'mini-btn';
      deleteBtn.title = 'Delete';
      deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
      deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteFolder(folder); });
      actions.appendChild(deleteBtn);

      item.appendChild(actions);
    }

    item.addEventListener('click', () => selectFolder(folder.id));
    list.appendChild(item);
  });
}

function getFolderCount(folderId) {
  if (folderId === '_all') return state.notes.length;
  return state.notes.filter((n) => n.folderId === folderId).length;
}

function selectFolder(folderId) {
  state.activeFolderId = folderId;
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
  renderFolders();
  loadNotes();
  closeSidebar();
}

async function promptNewFolder() {
  const name = prompt('Folder name:');
  if (!name || !name.trim()) return;
  const folder = await addFolder({ name: name.trim() });
  state.folders = await getFolders();
  renderFolders();
  showToast('Folder created');
}

async function promptRenameFolder(folder) {
  const name = prompt('New name:', folder.name);
  if (!name || !name.trim() || name.trim() === folder.name) return;
  await updateFolder(folder.id, { name: name.trim() });
  state.folders = await getFolders();
  renderFolders();
  showToast('Folder renamed');
}

async function confirmDeleteFolder(folder) {
  if (!confirm('Delete folder "' + folder.name + '"? Notes inside will be moved to Uncategorized.')) return;
  await deleteFolder(folder.id);
  state.folders = await getFolders();
  if (state.activeFolderId === folder.id) state.activeFolderId = '_all';
  renderFolders();
  await loadNotes();
  showToast('Folder deleted');
}

/* ------------------------------------------------------------------ */
/*  Notes loading & rendering                                          */
/* ------------------------------------------------------------------ */

async function loadNotes() {
  try {
    let notes;
    if (state.searchQuery) {
      notes = await searchNotes(state.searchQuery);
      if (state.activeFolderId && state.activeFolderId !== '_all') {
        notes = notes.filter((n) => n.folderId === state.activeFolderId);
      }
    } else if (state.activeFolderId === '_all' || !state.activeFolderId) {
      notes = await getNotes();
    } else {
      notes = await getNotes(state.activeFolderId);
    }
    state.notes = notes;
  } catch (err) {
    console.error('Load notes failed:', err);
    state.notes = [];
  }
  renderNotes();
  renderFolders(); // update counts
}

function renderNotes() {
  const area = document.getElementById('contentArea');
  area.innerHTML = '';

  if (state.notes.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div class="empty-title">No notes yet</div>
        <div class="empty-desc">Click + to create your first note, or use the extension popup to capture a screenshot.</div>
      </div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'notes-grid';

  state.notes.forEach((note) => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.addEventListener('click', () => openEditor(note.id));

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = note.title || 'Untitled';
    card.appendChild(title);

    const preview = document.createElement('div');
    preview.className = 'card-preview';
    preview.textContent = stripHtml(note.content || '').substring(0, 180);
    card.appendChild(preview);

    if (note.images && note.images.length > 0) {
      const imgs = document.createElement('div');
      imgs.className = 'card-images';
      note.images.slice(0, 3).forEach((b64) => {
        const img = document.createElement('img');
        img.src = b64;
        img.alt = '';
        imgs.appendChild(img);
      });
      card.appendChild(imgs);
    }

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const time = document.createElement('span');
    time.textContent = formatTime(note.timestamp);
    meta.appendChild(time);

    if (note.ocrKeywords && note.ocrKeywords.length > 0) {
      const tags = document.createElement('div');
      tags.className = 'card-tags';
      note.ocrKeywords.slice(0, 3).forEach((kw) => {
        const tag = document.createElement('span');
        tag.className = 'card-tag';
        tag.textContent = kw;
        tags.appendChild(tag);
      });
      meta.appendChild(tags);
    }

    card.appendChild(meta);
    grid.appendChild(card);
  });

  area.appendChild(grid);
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Note Editor                                                        */
/* ------------------------------------------------------------------ */

async function openEditor(noteId) {
  state.editingNoteId = noteId;
  const overlay = document.getElementById('editorOverlay');
  const panel = document.getElementById('editorPanel');

  let note = null;
  if (noteId) {
    note = await getNote(noteId);
  }

  const folders = state.folders.filter((f) => f.id !== '_all');
  const folderOpts = folders.map((f) => {
    const sel = (note && note.folderId === f.id) ? ' selected' : '';
    return '<option value="' + f.id + '"' + sel + '>' + escapeHtml(f.name) + '</option>';
  }).join('');

  const imagesHtml = note && note.images && note.images.length > 0
    ? note.images.map((b64) => '<img src="' + b64 + '" alt="">').join('')
    : '';

  panel.innerHTML = `
    <h2 style="font-size:20px;font-weight:600;margin-bottom:20px;letter-spacing:-0.01em;">${noteId ? 'Edit Note' : 'New Note'}</h2>
    <div class="form-group">
      <label class="form-label">Title</label>
      <input type="text" class="form-input" id="editorTitle" value="${escapeAttr(note ? note.title : '')}" placeholder="Note title">
    </div>
    <div class="form-group">
      <label class="form-label">Content</label>
      <textarea class="form-textarea" id="editorContent" placeholder="Write your note here... HTML supported for rich text.">${escapeHtml(note ? note.content : '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Folder</label>
      <select class="form-select" id="editorFolder">
        <option value="_uncategorized" ${(!note || note.folderId === '_uncategorized') ? 'selected' : ''}>Uncategorized</option>
        ${folderOpts}
      </select>
    </div>
    ${imagesHtml ? '<div class="form-group"><label class="form-label">Images</label><div class="editor-images-preview">' + imagesHtml + '</div></div>' : ''}
    <div class="editor-actions">
      ${noteId ? '<button class="btn btn-danger" id="btnDeleteNote">Delete</button>' : ''}
      <button class="btn" id="btnCancelEditor">Cancel</button>
      <button class="btn btn-primary" id="btnSaveEditor">Save</button>
    </div>
  `;

  overlay.classList.add('active');

  // Bind editor events
  document.getElementById('btnCancelEditor').addEventListener('click', closeEditor);
  document.getElementById('btnSaveEditor').addEventListener('click', saveEditor);
  if (noteId) {
    document.getElementById('btnDeleteNote').addEventListener('click', () => deleteEditorNote(noteId));
  }

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeEditor();
  });

  // Escape key
  document.addEventListener('keydown', editorEscHandler);
}

function editorEscHandler(e) {
  if (e.key === 'Escape') {
    closeEditor();
  }
}

function closeEditor() {
  document.getElementById('editorOverlay').classList.remove('active');
  state.editingNoteId = null;
  document.removeEventListener('keydown', editorEscHandler);
}

async function saveEditor() {
  const title = document.getElementById('editorTitle').value.trim() || 'Untitled';
  const content = document.getElementById('editorContent').value.trim();
  const folderId = document.getElementById('editorFolder').value || '_uncategorized';

  try {
    if (state.editingNoteId) {
      await updateNote(state.editingNoteId, { title, content, folderId });
      showToast('Note updated');
    } else {
      await addNote({
        title,
        content,
        folderId,
        images: [],
        timestamp: Date.now(),
        ocrKeywords: extractKeywords(content)
      });
      showToast('Note created');
    }
    closeEditor();
    await loadNotes();
  } catch (err) {
    alert('Failed to save: ' + err.message);
  }
}

async function deleteEditorNote(noteId) {
  if (!confirm('Delete this note permanently?')) return;
  try {
    await deleteNote(noteId);
    closeEditor();
    await loadNotes();
    showToast('Note deleted');
  } catch (err) {
    alert('Failed to delete: ' + err.message);
  }
}

/* ------------------------------------------------------------------ */
/*  Local Q&A                                                          */
/* ------------------------------------------------------------------ */

function toggleQAPanel() {
  document.getElementById('qaPanel').classList.toggle('expanded');
}

async function runLocalQA() {
  const input = document.getElementById('qaInput');
  const question = input.value.trim();
  if (!question) return;

  const panel = document.getElementById('qaPanel');
  if (!panel.classList.contains('expanded')) {
    panel.classList.add('expanded');
  }

  const resultsEl = document.getElementById('qaResults');
  resultsEl.innerHTML = '<div style="font-size:13px;color:var(--text-secondary);padding:12px;">Searching...</div>';

  try {
    const results = await localQA(question);
    if (results.length === 0) {
      resultsEl.innerHTML = '<div style="font-size:13px;color:var(--text-tertiary);padding:12px;">No matching notes found.</div>';
    } else {
      resultsEl.innerHTML = results.slice(0, 20).map((r) => {
        const note = r.note;
        const snippet = stripHtml(note.content || '').substring(0, 120);
        return `
          <div class="qa-result-item" data-note-id="${note.id}">
            <div class="qa-result-title">${escapeHtml(note.title || 'Untitled')}</div>
            <div class="qa-result-snippet">${escapeHtml(snippet)}</div>
            <div class="qa-result-score">Relevance: ${r.score}</div>
          </div>`;
      }).join('');

      // Click to open note
      resultsEl.querySelectorAll('.qa-result-item').forEach((el) => {
        el.addEventListener('click', () => {
          const noteId = el.dataset.noteId;
          openEditor(noteId);
        });
      });
    }
  } catch (err) {
    resultsEl.innerHTML = '<div style="font-size:13px;color:var(--text-secondary);padding:12px;">Search error: ' + err.message + '</div>';
  }
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 2200);
}
