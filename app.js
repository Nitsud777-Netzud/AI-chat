// AI Chat — pure vanilla JS, no dependencies.
// The API key is stored only in localStorage and sent only to the configured
// Base URL. No analytics, no other network requests.

(function () {
  'use strict';

  var LS_SETTINGS = 'ai-chat.settings.v1';
  var LS_HISTORY = 'ai-chat.history.v1';

  var DEFAULTS = {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant.'
  };

  var settings = loadSettings();
  var history = loadHistory(); // [{role:'user'|'assistant', content:string}]
  var sending = false;

  // ---- DOM ----
  var thread = document.getElementById('thread');
  var emptyState = document.getElementById('emptyState');
  var input = document.getElementById('input');
  var sendBtn = document.getElementById('sendBtn');
  var newChatBtn = document.getElementById('newChatBtn');
  var settingsBtn = document.getElementById('settingsBtn');
  var modal = document.getElementById('settingsModal');
  var apiKeyEl = document.getElementById('apiKey');
  var baseUrlEl = document.getElementById('baseUrl');
  var modelEl = document.getElementById('model');
  var systemPromptEl = document.getElementById('systemPrompt');
  var saveSettingsBtn = document.getElementById('saveSettings');
  var cancelSettingsBtn = document.getElementById('cancelSettings');

  // ---- Storage ----
  function loadSettings() {
    try {
      var raw = localStorage.getItem(LS_SETTINGS);
      if (!raw) return Object.assign({}, DEFAULTS);
      var s = JSON.parse(raw) || {};
      var out = Object.assign({}, DEFAULTS);
      for (var k in DEFAULTS) {
        if (typeof s[k] === 'string' && s[k].length) out[k] = s[k];
      }
      return out;
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveSettings() {
    settings.apiKey = apiKeyEl.value.trim();
    settings.baseUrl = (baseUrlEl.value.trim() || DEFAULTS.baseUrl).replace(/\/+$/, '');
    settings.model = modelEl.value.trim() || DEFAULTS.model;
    settings.systemPrompt = systemPromptEl.value || DEFAULTS.systemPrompt;
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch (e) {}
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(LS_HISTORY);
      var h = raw ? JSON.parse(raw) : [];
      return Array.isArray(h) ? h.filter(function (m) {
        return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
      }) : [];
    } catch (e) {
      return [];
    }
  }

  function persistHistory() {
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(history)); } catch (e) {}
  }

  // ---- Markdown rendering (escape first, then minimal markdown) ----
  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Inline markdown applied to already-escaped text, skipping code spans/blocks
  // handled separately.
  function renderInline(escaped) {
    // `inline code`
    escaped = escaped.replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');
    // **bold**
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // *italic*
    escaped = escaped.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return escaped;
  }

  function renderMarkdown(text) {
    var escaped = escapeHtml(text);
    var out = '';
    var parts = escaped.split(/```/); // odd indexes = code block content
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        // Fenced code block. First line may be a language tag.
        var block = parts[i].replace(/^\n/, '');
        var nl = block.indexOf('\n');
        if (nl !== -1 && /^[a-zA-Z0-9+#-]+$/.test(block.slice(0, nl).trim())) {
          block = block.slice(nl + 1);
        }
        out += '<pre><button class="copy-btn" type="button">Copy</button><code>' + block + '</code></pre>';
      } else {
        // Regular text: escape is done; split into paragraphs.
        var paras = parts[i].split(/\n{2,}/);
        for (var p = 0; p < paras.length; p++) {
          var para = paras[p];
          if (!para.trim()) continue;
          out += '<p>' + renderInline(para.replace(/\n/g, '<br>')) + '</p>';
        }
      }
    }
    return out || '<p></p>';
  }

  // ---- Thread UI ----
  function scrollToBottom() {
    thread.scrollTop = thread.scrollHeight;
  }

  function showTyping() {
    var row = document.createElement('div');
    row.className = 'msg assistant';
    row.id = 'typingRow';
    row.innerHTML = '<div class="bubble typing"><span></span><span></span><span></span></div>';
    thread.appendChild(row);
    scrollToBottom();
  }

  function hideTyping() {
    var row = document.getElementById('typingRow');
    if (row) row.remove();
  }

  function addMessage(role, content) {
    var row = document.createElement('div');
    row.className = 'msg ' + (role === 'user' ? 'user' : 'assistant');
    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (role === 'user') {
      bubble.textContent = content;
    } else {
      bubble.innerHTML = renderMarkdown(content);
    }
    row.appendChild(bubble);
    thread.appendChild(row);
    scrollToBottom();
  }

  function showNotice(text) {
    var el = document.createElement('div');
    el.className = 'sys-notice';
    el.textContent = text;
    thread.appendChild(el);
    scrollToBottom();
  }

  function refreshEmptyState() {
    emptyState.style.display = history.length ? 'none' : 'flex';
  }

  function renderAll() {
    thread.innerHTML = '';
    history.forEach(function (m) { addMessage(m.role, m.content); });
    refreshEmptyState();
  }

  // ---- Copy buttons (event delegation) ----
  thread.addEventListener('click', function (e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;
    var code = btn.parentElement.querySelector('code');
    var text = code ? code.textContent : '';
    function done() {
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta);
      done();
    }
  });

  // ---- Chat logic ----
  function send() {
    var text = input.value.trim();
    if (!text || sending) return;

    if (!settings.apiKey) {
      addMessage('user', text);
      history.push({ role: 'user', content: text });
      persistHistory();
      refreshEmptyState();
      input.value = '';
      autoGrow();
      showNotice('Add your API key in Settings (gear icon) to start chatting.');
      return;
    }

    sending = true;
    sendBtn.disabled = true;

    addMessage('user', text);
    history.push({ role: 'user', content: text });
    persistHistory();
    refreshEmptyState();
    input.value = '';
    autoGrow();

    showTyping();

    var body = {
      model: settings.model,
      messages: [{ role: 'system', content: settings.systemPrompt }].concat(
        history.map(function (m) { return { role: m.role, content: m.content }; })
      ),
      temperature: 0.7
    };

    fetch(settings.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.apiKey
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 401) {
        throw new Error('unauthorized');
      }
      if (!res.ok) {
        throw new Error('http-' + res.status);
      }
      return res.json();
    }).then(function (data) {
      var reply = data && data.choices && data.choices[0] &&
        data.choices[0].message && data.choices[0].message.content;
      hideTyping();
      if (typeof reply === 'string' && reply.length) {
        addMessage('assistant', reply);
        history.push({ role: 'assistant', content: reply });
        persistHistory();
      } else {
        showNotice("The API didn't return a reply — try again.");
      }
    }).catch(function (err) {
      hideTyping();
      if (err && err.message === 'unauthorized') {
        showNotice('That API key was rejected — check it in Settings.');
      } else if (err instanceof TypeError) {
        showNotice("Couldn't reach the API — check your connection and Base URL in Settings.");
      } else {
        showNotice("Something went wrong — check your connection and Base URL in Settings.");
      }
    }).then(function () {
      sending = false;
      sendBtn.disabled = !input.value.trim();
      input.focus();
    });
  }

  function newChat() {
    history = [];
    persistHistory();
    thread.innerHTML = '';
    refreshEmptyState();
    scrollToBottom();
    input.focus();
  }

  // ---- Composer ----
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    sendBtn.disabled = sending || !input.value.trim();
  }

  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  sendBtn.addEventListener('click', send);
  newChatBtn.addEventListener('click', newChat);

  // ---- Suggestion chips ----
  emptyState.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    input.value = chip.getAttribute('data-suggest') || '';
    autoGrow();
    input.focus();
  });

  // ---- Settings modal ----
  function openSettings() {
    apiKeyEl.value = settings.apiKey;
    baseUrlEl.value = settings.baseUrl;
    modelEl.value = settings.model;
    systemPromptEl.value = settings.systemPrompt;
    modal.hidden = false;
    apiKeyEl.focus();
  }

  function closeSettings() {
    modal.hidden = true;
  }

  settingsBtn.addEventListener('click', openSettings);
  cancelSettingsBtn.addEventListener('click', closeSettings);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeSettings();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeSettings();
  });
  saveSettingsBtn.addEventListener('click', function () {
    saveSettings();
    closeSettings();
    if (!settings.apiKey) {
      showNotice('Add your API key in Settings (gear icon) to start chatting.');
    }
  });

  // ---- Init ----
  renderAll();
  autoGrow();
})();
