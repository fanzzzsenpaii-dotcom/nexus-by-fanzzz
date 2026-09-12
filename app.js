// ============================================================
// NEXUS AI - FRONTEND v2 (Vercel Backend)
// Replace file ini di SPCK Editor
// ============================================================

// ⚠️ GANTI INI dengan URL Vercel pakde (tanpa trailing slash)
const BACKEND_URL = 'https://nexus-by-fanzzz-inky.vercel.app/';

// ---------- Element refs ----------
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');

const imgPrompt = document.getElementById('img-prompt');
const aspect = document.getElementById('aspect');
const genImgBtn = document.getElementById('gen-img-btn');
const imageResult = document.getElementById('image-result');

// ---------- State ----------
const MAX_HISTORY = 40;
let history = JSON.parse(localStorage.getItem('nexus_history') || '[]');
let isGenerating = false;

// ---------- Ping backend untuk status ----------
(async function pingBackend() {
  try {
    const r = await fetch(`${BACKEND_URL}/`, { method: 'GET' });
    const d = await r.json();
    if (d.status === 'ok') {
      console.log('✅ Backend aktif:', d.service);
      document.querySelector('.dot').style.background = '#22c55e';
      document.querySelector('.dot').style.boxShadow = '0 0 10px #22c55e';
    }
  } catch (e) {
    console.warn('⚠️ Backend tidak merespon, mungkin cold start...');
    document.querySelector('.dot').style.background = '#f59e0b';
    document.querySelector('.dot').style.boxShadow = '0 0 10px #f59e0b';
  }
})();

// ---------- Fetch dengan retry (handle cold start) ----------
async function fetchWithRetry(url, options, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 413) throw new Error('PAYLOAD_TOO_LARGE');
      if (res.status === 429) throw new Error('RATE_LIMITED');
      return res;
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`Retry ${i + 1}/${retries} karena: ${err.message}`);
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

// ---------- Tab switching ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------- Auto-resize textarea ----------
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

// Enter kirim, Shift+Enter newline
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// ---------- Helpers ----------
function addMsg(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  div.appendChild(bubble);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return bubble;
}

function addLoading() {
  const div = document.createElement('div');
  div.className = 'msg bot loading';
  div.id = 'loading-msg';
  div.innerHTML = '<div class="bubble"></div>';
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div.querySelector('.bubble');
}

function trimHistory() {
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }
}

function restoreHistory() {
  if (history.length === 0) return;
  chatBox.innerHTML = '';
  history.forEach(m => addMsg(m.role === 'assistant' ? 'bot' : 'user', m.content));
}
restoreHistory();

// ---------- Kirim chat ----------
chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (isGenerating) return;

  const text = chatInput.value.trim();
  if (!text) return;

  isGenerating = true;
  sendBtn.disabled = true;
  chatInput.value = '';
  chatInput.style.height = 'auto';

  addMsg('user', text);
  history.push({ role: 'user', content: text });
  trimHistory();

  const bubble = addLoading();

  try {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, model: modelSelect.value })
    });

    const data = await res.json();
    const reply = data.reply || data.error || 'Maaf, terjadi error.';

    bubble.textContent = reply;
    document.getElementById('loading-msg')?.classList.remove('loading');

    history.push({ role: 'assistant', content: reply });
    trimHistory();
    localStorage.setItem('nexus_history', JSON.stringify(history));
  } catch (err) {
    let msg = '❌ Gagal terhubung ke server.';
    if (err.message === 'PAYLOAD_TOO_LARGE') msg = '❌ Request terlalu besar.';
    if (err.message === 'RATE_LIMITED') msg = '⚠️ Rate limit, tunggu sebentar.';
    if (err.name === 'TypeError') msg = '⚠️ Backend cold start, coba lagi sebentar.';
    bubble.textContent = msg;
    document.getElementById('loading-msg')?.classList.remove('loading');
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

// ---------- Generate image ----------
genImgBtn.addEventListener('click', async () => {
  const prompt = imgPrompt.value.trim();
  if (!prompt) return alert('Prompt kosong bos!');

  genImgBtn.disabled = true;
  imageResult.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        aspectRatio: aspect.value,
        count: 1
      })
    });

    const data = await res.json();

    if (!data.images || data.images.length === 0) {
      imageResult.innerHTML = `<p class="placeholder">❌ ${data.error || 'Gagal generate'}</p>`;
      return;
    }

    imageResult.innerHTML = '';
    data.images.forEach((img, i) => {
      const card = document.createElement('div');
      card.className = 'img-card';
      const src = `data:${img.mime};base64,${img.base64}`;
      card.innerHTML = `
        <img src="${src}" alt="Generated ${i}" />
        <a href="${src}" download="nexus-ai-${Date.now()}-${i}.png">⬇ Download</a>
      `;
      imageResult.appendChild(card);
    });
  } catch (err) {
    let msg = '❌ Error: ' + err.message;
    if (err.message === 'PAYLOAD_TOO_LARGE') msg = '❌ Gambar terlalu besar. Coba aspect ratio 1:1.';
    if (err.message === 'RATE_LIMITED') msg = '⚠️ Rate limit, tunggu sebentar.';
    imageResult.innerHTML = `<p class="placeholder">${msg}</p>`;
  } finally {
    genImgBtn.disabled = false;
  }
});
