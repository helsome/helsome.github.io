#!/usr/bin/env node
/**
 * Hexo Blog Admin Panel
 * Run: node admin-server.js
 * Open: http://localhost:3001
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const matter = require('gray-matter');

const app = express();
const PORT = 3001;
const POSTS_DIR = path.join(__dirname, 'source/_posts');

app.use(express.json({ limit: '10mb' }));

// ─── API ────────────────────────────────────────────────────────────────────

// List all posts
app.get('/api/posts', (req, res) => {
  try {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const posts = files.map(filename => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
      const { data } = matter(raw);
      return {
        filename,
        title: data.title || filename.replace('.md', ''),
        date: data.date ? new Date(data.date).toISOString().slice(0, 10) : '',
        tags: data.tags || [],
        categories: data.categories || [],
      };
    });
    posts.sort((a, b) => (b.date > a.date ? 1 : -1));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get post content
app.get('/api/posts/:filename', (req, res) => {
  try {
    const filePath = path.join(POSTS_DIR, req.params.filename);
    if (!filePath.startsWith(POSTS_DIR)) return res.status(403).json({ error: 'Forbidden' });
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content });
  } catch (err) {
    res.status(404).json({ error: 'Post not found' });
  }
});

// Create new post
app.post('/api/posts', (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!filename || !filename.endsWith('.md')) return res.status(400).json({ error: 'Invalid filename' });
    const filePath = path.join(POSTS_DIR, filename);
    if (!filePath.startsWith(POSTS_DIR)) return res.status(403).json({ error: 'Forbidden' });
    if (fs.existsSync(filePath)) return res.status(409).json({ error: 'File already exists' });
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update post
app.put('/api/posts/:filename', (req, res) => {
  try {
    const filePath = path.join(POSTS_DIR, req.params.filename);
    if (!filePath.startsWith(POSTS_DIR)) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    fs.writeFileSync(filePath, req.body.content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename (save as new filename)
app.post('/api/posts/:filename/rename', (req, res) => {
  try {
    const oldPath = path.join(POSTS_DIR, req.params.filename);
    const newPath = path.join(POSTS_DIR, req.body.newFilename);
    if (!oldPath.startsWith(POSTS_DIR) || !newPath.startsWith(POSTS_DIR)) return res.status(403).json({ error: 'Forbidden' });
    fs.renameSync(oldPath, newPath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete post
app.delete('/api/posts/:filename', (req, res) => {
  try {
    const filePath = path.join(POSTS_DIR, req.params.filename);
    if (!filePath.startsWith(POSTS_DIR)) return res.status(403).json({ error: 'Forbidden' });
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run hexo deploy (publish)
app.post('/api/deploy', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  const child = exec('npm run deploy', { cwd: __dirname });
  child.stdout.on('data', d => res.write(d));
  child.stderr.on('data', d => res.write(d));
  child.on('close', code => {
    res.write(`\n[Exit code: ${code}]`);
    res.end();
  });
});

// Run hexo generate (preview)
app.post('/api/generate', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  const child = exec('hexo generate', { cwd: __dirname });
  child.stdout.on('data', d => res.write(d));
  child.stderr.on('data', d => res.write(d));
  child.on('close', code => {
    res.write(`\n[Done: ${code}]`);
    res.end();
  });
});

// ─── UI ─────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send(HTML);
});

app.listen(PORT, () => {
  console.log(`\n  Hexo Admin → http://localhost:${PORT}\n`);
});

// ─── Embedded UI ────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blog Admin — infinite</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.css">
<script src="https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #22263a;
    --border: #2d3147;
    --accent: #7c6af7;
    --accent-hover: #9580ff;
    --text: #e0e0f0;
    --text-dim: #8888aa;
    --danger: #e05c6a;
    --success: #4caf7d;
    --warn: #f0a030;
    --sidebar-w: 280px;
  }

  html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); }

  /* ── Layout ── */
  .layout { display: flex; flex-direction: column; height: 100vh; }

  .topbar {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 20px;
    background: var(--surface); border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .topbar .logo { font-weight: 700; font-size: 15px; color: var(--accent); margin-right: auto; letter-spacing: 1px; }
  .topbar .logo span { color: var(--text-dim); font-weight: 400; }

  .main { display: flex; flex: 1; overflow: hidden; }

  /* ── Sidebar ── */
  .sidebar {
    width: var(--sidebar-w); flex-shrink: 0;
    background: var(--surface); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sidebar-header { padding: 12px 14px; border-bottom: 1px solid var(--border); }
  .search-box {
    width: 100%; background: var(--bg); border: 1px solid var(--border);
    border-radius: 6px; padding: 7px 10px; color: var(--text);
    font-size: 13px; outline: none;
  }
  .search-box:focus { border-color: var(--accent); }
  .post-list { flex: 1; overflow-y: auto; padding: 6px 0; }
  .post-item {
    padding: 10px 14px; cursor: pointer;
    border-left: 3px solid transparent;
    transition: background 0.15s;
  }
  .post-item:hover { background: var(--surface2); }
  .post-item.active { background: var(--surface2); border-left-color: var(--accent); }
  .post-item .pt { font-size: 13px; font-weight: 500; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .post-item .pd { font-size: 11px; color: var(--text-dim); margin-top: 3px; }
  .post-count { padding: 8px 14px; font-size: 11px; color: var(--text-dim); border-top: 1px solid var(--border); }

  /* ── Editor ── */
  .editor-area {
    flex: 1; display: flex; flex-direction: column; overflow: hidden;
    background: var(--bg);
  }
  .editor-toolbar-custom {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 16px; border-bottom: 1px solid var(--border);
    background: var(--surface); flex-shrink: 0; flex-wrap: wrap;
  }
  .editor-toolbar-custom input {
    flex: 1; min-width: 200px; background: var(--bg); border: 1px solid var(--border);
    border-radius: 6px; padding: 6px 10px; color: var(--text); font-size: 14px; font-weight: 600; outline: none;
  }
  .editor-toolbar-custom input:focus { border-color: var(--accent); }
  .editor-wrap { flex: 1; overflow: hidden; position: relative; }
  .editor-wrap .CodeMirror { height: 100% !important; background: var(--bg) !important; color: var(--text) !important; font-size: 14px; }
  .editor-wrap .CodeMirror-scroll { background: var(--bg); }
  .editor-placeholder {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: var(--text-dim); gap: 12px;
  }
  .editor-placeholder .icon { font-size: 48px; opacity: 0.3; }
  .editor-placeholder p { font-size: 14px; }

  /* ── Buttons ── */
  .btn {
    padding: 7px 14px; border-radius: 6px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 500; transition: all 0.15s; white-space: nowrap;
  }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-success { background: var(--success); color: #fff; }
  .btn-success:hover { opacity: 0.85; }
  .btn-danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
  .btn-danger:hover { background: var(--danger); color: #fff; }
  .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
  .btn-secondary:hover { border-color: var(--accent); color: var(--accent); }
  .btn-warn { background: var(--warn); color: #111; }
  .btn-warn:hover { opacity: 0.85; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Log modal ── */
  .modal-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,.7);
    align-items: center; justify-content: center; z-index: 100;
  }
  .modal-overlay.show { display: flex; }
  .modal {
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    width: 700px; max-width: 95vw; display: flex; flex-direction: column;
    max-height: 80vh;
  }
  .modal-header { padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; }
  .modal-header h3 { font-size: 15px; flex: 1; }
  .modal-close { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 20px; }
  .modal-body { padding: 14px 18px; overflow-y: auto; flex: 1; }
  .log-output { font-family: monospace; font-size: 12px; white-space: pre-wrap; line-height: 1.6; color: #a0e0b0; }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 200;
    padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 500;
    opacity: 0; transform: translateY(10px); transition: all 0.25s;
    pointer-events: none;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.ok { background: var(--success); color: #fff; }
  .toast.err { background: var(--danger); color: #fff; }

  /* ── EasyMDE overrides ── */
  .EasyMDEContainer { height: 100%; display: flex; flex-direction: column; }
  .EasyMDEContainer .editor-toolbar { background: #1a1d2b; border-color: var(--border); }
  .EasyMDEContainer .editor-toolbar button { color: var(--text-dim) !important; }
  .EasyMDEContainer .editor-toolbar button:hover { background: var(--surface2) !important; color: var(--text) !important; }
  .EasyMDEContainer .CodeMirror { flex: 1; background: var(--bg) !important; color: var(--text) !important; border-color: transparent !important; }
  .EasyMDEContainer .editor-preview { background: var(--surface) !important; color: var(--text) !important; }
  .EasyMDEContainer .editor-preview pre { background: var(--surface2) !important; }

  /* scrollbar */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
</head>
<body>
<div class="layout">

  <!-- Top bar -->
  <div class="topbar">
    <div class="logo">∞ infinite <span>admin</span></div>
    <button class="btn btn-primary" onclick="newPost()">＋ 新文章</button>
    <button class="btn btn-secondary" onclick="openPreview()">⌖ 本地预览</button>
    <button class="btn btn-warn" onclick="deploy()">⬆ 发布到博客</button>
  </div>

  <div class="main">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="sidebar-header">
        <input class="search-box" id="searchBox" placeholder="搜索文章..." oninput="filterPosts(this.value)">
      </div>
      <div class="post-list" id="postList"></div>
      <div class="post-count" id="postCount">加载中...</div>
    </div>

    <!-- Editor -->
    <div class="editor-area" id="editorArea">
      <div class="editor-placeholder" id="editorPlaceholder">
        <div class="icon">✍️</div>
        <p>选择一篇文章，或点击「新文章」开始写作</p>
      </div>
      <div id="editorPanel" style="display:none; flex:1; flex-direction:column; overflow:hidden; display:none;">
        <div class="editor-toolbar-custom">
          <input id="titleInput" type="text" placeholder="文章标题..." onchange="updateFrontmatter()">
          <input id="tagsInput" type="text" placeholder="标签 (逗号分隔)" style="flex:0.5; min-width:120px;" onchange="updateFrontmatter()">
          <input id="categoryInput" type="text" placeholder="分类" style="flex:0.4; min-width:100px;" onchange="updateFrontmatter()">
          <button class="btn btn-success" onclick="savePost()">💾 保存</button>
          <button class="btn btn-danger" onclick="deletePost()">🗑 删除</button>
        </div>
        <div class="editor-wrap">
          <textarea id="mdEditor"></textarea>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Log Modal -->
<div class="modal-overlay" id="logModal">
  <div class="modal">
    <div class="modal-header">
      <h3 id="logTitle">输出日志</h3>
      <button class="modal-close" onclick="closeLog()">✕</button>
    </div>
    <div class="modal-body">
      <div class="log-output" id="logOutput"></div>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
let posts = [];
let currentFilename = null;
let easyMDE = null;
let isDirty = false;

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  await loadPosts();
  initEditor();
}

function initEditor() {
  easyMDE = new EasyMDE({
    element: document.getElementById('mdEditor'),
    autosave: { enabled: false },
    spellChecker: false,
    renderingConfig: { singleLineBreaks: false },
    toolbar: [
      'bold','italic','heading','|',
      'quote','unordered-list','ordered-list','|',
      'link','image','code','|',
      'preview','side-by-side','fullscreen','|',
      'guide'
    ],
    status: ['lines', 'words', 'cursor'],
  });
  easyMDE.codemirror.on('change', () => { isDirty = true; });
}

// ── Posts ─────────────────────────────────────────────────────────────────

async function loadPosts() {
  const r = await fetch('/api/posts');
  posts = await r.json();
  renderList(posts);
}

function renderList(list) {
  const el = document.getElementById('postList');
  el.innerHTML = list.map(p => \`
    <div class="post-item \${p.filename === currentFilename ? 'active' : ''}"
         onclick="openPost('\${p.filename.replace(/'/g, "\\\\'")}')">
      <div class="pt">\${p.title || p.filename}</div>
      <div class="pd">\${p.date || ''} \${(p.tags||[]).map(t=>'#'+t).join(' ')}</div>
    </div>
  \`).join('');
  document.getElementById('postCount').textContent = \`\${list.length} 篇文章\`;
}

function filterPosts(q) {
  const lq = q.toLowerCase();
  renderList(posts.filter(p =>
    (p.title||'').toLowerCase().includes(lq) ||
    (p.tags||[]).join(' ').toLowerCase().includes(lq)
  ));
}

async function openPost(filename) {
  if (isDirty && !confirm('有未保存的更改，确定要离开吗？')) return;
  const r = await fetch(\`/api/posts/\${encodeURIComponent(filename)}\`);
  const { content } = await r.json();
  currentFilename = filename;
  isDirty = false;
  showEditor(content);
  document.querySelectorAll('.post-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
}

function showEditor(content) {
  document.getElementById('editorPlaceholder').style.display = 'none';
  const panel = document.getElementById('editorPanel');
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.flex = '1';
  panel.style.overflow = 'hidden';

  // Parse frontmatter for form fields
  const fmMatch = content.match(/^---\\n([\\s\\S]*?)\\n---\\n/);
  let bodyContent = content;
  let title = '', tags = '', category = '';
  if (fmMatch) {
    const fm = fmMatch[1];
    const titleM = fm.match(/^title:\\s*(.+)$/m);
    const tagsM = fm.match(/^tags:\\s*\\[([^\\]]*?)\\]/m);
    const catM = fm.match(/^categories:\\s*(.+)$/m);
    title = titleM ? titleM[1].replace(/^['"]|['"]$/g,'').trim() : '';
    tags = tagsM ? tagsM[1].replace(/['"]/g,'').trim() : '';
    category = catM ? catM[1].replace(/^['"]|['"]$/g,'').trim() : '';
    bodyContent = content.slice(fmMatch[0].length);
  }
  document.getElementById('titleInput').value = title;
  document.getElementById('tagsInput').value = tags;
  document.getElementById('categoryInput').value = category;
  easyMDE.value(bodyContent);
  isDirty = false;
}

function buildContent() {
  const title = document.getElementById('titleInput').value.trim();
  const tags = document.getElementById('tagsInput').value.trim();
  const category = document.getElementById('categoryInput').value.trim();
  const body = easyMDE.value();
  const tagsArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const fm = [
    '---',
    \`title: \${title || '未命名'}\`,
    \`date: \${now}\`,
    \`tags: [\${tagsArr.map(t=>'"'+t+'"').join(',')}]\`,
    category ? \`categories: ["\${category}"]\` : 'categories: []',
    '---',
    ''
  ].join('\\n');
  return fm + body;
}

function updateFrontmatter() { isDirty = true; }

async function savePost() {
  if (!currentFilename) return;
  const content = buildContent();
  const r = await fetch(\`/api/posts/\${encodeURIComponent(currentFilename)}\`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (r.ok) {
    isDirty = false;
    toast('已保存 ✓', 'ok');
    await loadPosts();
  } else {
    const e = await r.json();
    toast('保存失败: ' + e.error, 'err');
  }
}

async function deletePost() {
  if (!currentFilename) return;
  if (!confirm(\`确定删除「\${currentFilename}」？此操作不可撤销。\`)) return;
  const r = await fetch(\`/api/posts/\${encodeURIComponent(currentFilename)}\`, { method: 'DELETE' });
  if (r.ok) {
    currentFilename = null;
    isDirty = false;
    document.getElementById('editorPanel').style.display = 'none';
    document.getElementById('editorPlaceholder').style.display = 'flex';
    toast('已删除', 'ok');
    await loadPosts();
  } else {
    toast('删除失败', 'err');
  }
}

function newPost() {
  if (isDirty && !confirm('有未保存的更改，确定要继续吗？')) return;
  const date = new Date().toISOString().replace('T',' ').slice(0,19);
  const slug = 'new-post-' + Date.now();
  const filename = slug + '.md';
  const content = \`---
title: 新文章标题
date: \${date}
tags: []
categories: []
---

在这里开始写作...
\`;

  // Create file then open it
  fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content })
  }).then(async r => {
    if (r.ok) {
      await loadPosts();
      currentFilename = filename;
      showEditor(content);
      renderList(posts);
      toast('新文章已创建', 'ok');
    } else {
      const e = await r.json();
      toast(e.error, 'err');
    }
  });
}

// ── Deploy / Preview ──────────────────────────────────────────────────────

async function deploy() {
  if (!confirm('确定要发布到 GitHub Pages 吗？\\n\\n这将执行：hexo clean → generate → deploy')) return;
  openLog('🚀 发布到博客');
  const r = await fetch('/api/deploy', { method: 'POST' });
  streamLog(r);
}

async function openPreview() {
  openLog('⌖ 生成本地预览');
  const r = await fetch('/api/generate', { method: 'POST' });
  await streamLog(r);
  document.getElementById('logOutput').textContent += '\\n→ 预览: http://localhost:4000\\n';
  // Auto-open preview server hint
}

function openLog(title) {
  document.getElementById('logTitle').textContent = title;
  document.getElementById('logOutput').textContent = '正在执行...\\n\\n';
  document.getElementById('logModal').classList.add('show');
}

async function streamLog(response) {
  const logEl = document.getElementById('logOutput');
  logEl.textContent = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    logEl.textContent += decoder.decode(value);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function closeLog() { document.getElementById('logModal').classList.remove('show'); }

// ── Toast ────────────────────────────────────────────────────────────────

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = \`toast \${type} show\`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Keyboard shortcut ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (currentFilename) savePost();
  }
});

window.addEventListener('beforeunload', e => {
  if (isDirty) { e.preventDefault(); e.returnValue = ''; }
});

init();
</script>
</body>
</html>`;
