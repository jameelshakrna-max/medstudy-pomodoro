// ── STATE ─────────────────────────────────────────────────────────────────────
let mode='study', isRunning=false, remaining=25*60, total=25*60;
let ticker=null, done=0, focusMins=0, streak=0, curStreak=0, soundOn=true;
let notionToken='', dbId='', logCount=0;

// ── INIT ──────────────────────────────────────────────────────────────────────
window.onload = () => {
  notionToken = localStorage.getItem('pomo_token') || '';
  dbId        = localStorage.getItem('pomo_db')    || '';
  if (notionToken && dbId) {
    showApp();
  }
};

// ── CONNECTION ────────────────────────────────────────────────────────────────
async function connect() {
  const btn = document.getElementById('connect-btn');
  const err = document.getElementById('setup-err');
  const tok = document.getElementById('inp-token').value.trim();
  let   db  = document.getElementById('inp-db').value.trim();

  err.textContent = '';
  if (!tok) { err.textContent = 'Please enter your Notion token'; return; }
  if (!db)  { err.textContent = 'Please enter your database ID';  return; }

  // Clean up DB id — handle full URLs
  db = db.replace(/https?:\/\/[^/]+\//, '').replace(/\?.*/, '').replace(/-/g,'');
  if (db.length === 32) {
    db = db.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }

  btn.disabled = true;
  btn.textContent = 'Connecting...';

  try {
    const data = await notionFetch('GET', `databases/${db}`, null, tok);
    if (data.object === 'error') throw new Error(data.message);

    localStorage.setItem('pomo_token', tok);
    localStorage.setItem('pomo_db', db);
    notionToken = tok;
    dbId = db;
    showApp();
  } catch(e) {
    err.textContent = '❌ ' + (e.message || 'Check your token and database ID');
    btn.disabled = false;
    btn.textContent = 'Connect to Notion →';
  }
}

function showApp() {
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  setMode('study');
}

function showSetup() {
  document.getElementById('setup-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('inp-token').value = notionToken;
  document.getElementById('inp-db').value    = dbId;
  document.getElementById('connect-btn').disabled = false;
  document.getElementById('connect-btn').textContent = 'Connect to Notion →';
}

// ── NOTION API ────────────────────────────────────────────────────────────────
async function notionFetch(method, path, body, token) {
  const res = await fetch('/notion/' + path, {
    method,
    headers: { 'Content-Type':'application/json', 'x-notion-token': token || notionToken },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function getMins() {
  return {
    study: parseInt(document.getElementById('i-study').value) || 25,
    break: parseInt(document.getElementById('i-break').value) || 5,
    long:  parseInt(document.getElementById('i-long').value)  || 15,
  };
}

function setMode(m) {
  mode = m;
  clearInterval(ticker);
  isRunning = false;

  // Update mode buttons
  ['study','break','long'].forEach(k => {
    const btn = document.getElementById('mb-' + k);
    btn.className = 'mode' + (k === m ? ' active ' + k : ' ' + k);
  });

  // Update ring + clock color
  const ring  = document.getElementById('ring');
  const clock = document.getElementById('t-clock');
  const label = document.getElementById('t-label');
  const play  = document.getElementById('play-btn');

  ring.className  = 'ring-fg ' + m;
  clock.className = 't-clock' + (m !== 'study' ? ' ' + m : '');
  play.className  = 'btn-main ' + m;

  const labels = { study:'FOCUS TIME', break:'SHORT BREAK', long:'LONG BREAK' };
  label.textContent = labels[m];

  const mins = getMins();
  total     = (m === 'study' ? mins.study : m === 'break' ? mins.break : mins.long) * 60;
  remaining = total;

  updatePlayBtn();
  renderClock();
  renderRing();
}

function onSettingsChange() {
  if (!isRunning) setMode(mode);
}

function togglePlay() {
  if (isRunning) {
    clearInterval(ticker);
    isRunning = false;
  } else {
    isRunning = true;
    ticker = setInterval(tick, 1000);
  }
  updatePlayBtn();
  const ring = document.getElementById('ring');
  if (isRunning) ring.classList.add('on'); else ring.classList.remove('on');
}

function tick() {
  remaining--;
  renderClock();
  renderRing();
  if (remaining <= 0) {
    clearInterval(ticker);
    isRunning = false;
    document.getElementById('ring').classList.remove('on');
    updatePlayBtn();
    onDone();
  }
}

function onDone() {
  if (soundOn) playChime();
  if (mode === 'study') {
    done++;
    focusMins += getMins().study;
    curStreak++;
    if (curStreak > streak) streak = curStreak;
    updateStats();
    updateDots();
    autoFillName();
    showToast('🎉 Pomodoro done! Fill in the details and save to Notion.', 'good');
  } else {
    curStreak = 0;
    showToast('Break over — back to work! 💪', 'good');
    setMode('study');
  }
}

function resetTimer()  { clearInterval(ticker); isRunning = false; document.getElementById('ring').classList.remove('on'); setMode(mode); }
function skipNow()     { clearInterval(ticker); isRunning = false; document.getElementById('ring').classList.remove('on'); remaining = 0; renderClock(); renderRing(); onDone(); }

function updatePlayBtn() {
  document.getElementById('play-btn').textContent = isRunning ? '⏸' : '▶';
}

function renderClock() {
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  document.getElementById('t-clock').textContent = `${m}:${s}`;
}

function renderRing() {
  const offset = 816.814 * (1 - remaining / total);
  document.getElementById('ring').style.strokeDashoffset = offset;
}

function updateStats() {
  document.getElementById('s-done').textContent = done;
  document.getElementById('s-mins').textContent = focusMins;
  document.getElementById('s-str').textContent  = streak;
}

function updateDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('d' + i);
    const filled = i < (done % 4 === 0 && done > 0 ? 4 : done % 4);
    dot.className = 'dot' + (filled ? ' on' : '');
  }
}

function autoFillName() {
  const inp = document.getElementById('f-name');
  if (!inp.value) {
    const topic = document.getElementById('f-topic').value;
    inp.value = `Pomodoro ${done}${topic ? ' — ' + topic : ''}`;
  }
}

// ── SAVE SESSION ──────────────────────────────────────────────────────────────
async function saveSession() {
  const btn   = document.getElementById('save-btn');
  const name  = document.getElementById('f-name').value  || `Pomodoro ${done + 1} — ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
  const topic = document.getElementById('f-topic').value || '';
  const notes = document.getElementById('f-notes').value || '';
  const today = new Date().toISOString().split('T')[0];

  btn.disabled = true;
  btn.innerHTML = '⏳ Saving...';

  const logId = addLog(name, topic);

  try {
    const data = await notionFetch('POST', 'pages', {
      parent: { database_id: dbId },
      properties: {
        'Session Label':     { title:  [ { type:'text', text:{ content: name } } ] },
        'Date':              { date:   { start: today } },
        'Completed':         { checkbox: true },
        'Duration (min)':    { number: getMins().study },
        'Focus Quality':     { select: { name: '🎯 Deep focus' } },
        'Type':              { select: { name: 'Study' } },
        'Interruption Note': { rich_text: [ { type:'text', text:{ content: notes } } ] },
        'Date':              { date: { start: today } },
      },
    });

    if (data.object === 'error') throw new Error(data.message);

    updateLog(logId, 'ok', '✅ Saved');
    showToast('✅ Saved to Notion!', 'good');
    document.getElementById('f-name').value  = '';
    document.getElementById('f-notes').value = '';

  } catch(e) {
    updateLog(logId, 'fail', '❌ Failed');
    showToast('❌ ' + (e.message || 'Save failed — check your connection'), 'bad');
  }

  btn.disabled = false;
  btn.innerHTML = '🚀 Save to Notion';
}

// ── LOG ───────────────────────────────────────────────────────────────────────
function addLog(name, topic) {
  const id   = 'log' + (++logCount);
  const now  = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const wrap = document.getElementById('log-wrap');
  const list = document.getElementById('log-list');
  wrap.style.display = 'block';
  const el = document.createElement('div');
  el.className = 'log-item';
  el.id = id;
  el.innerHTML = `
    <div class="li-icon">🍅</div>
    <div class="li-body">
      <div class="li-name">${name}</div>
      <div class="li-meta">${topic ? topic + ' · ' : ''}${now}</div>
    </div>
    <div class="li-badge wait" id="${id}-b">Saving...</div>`;
  list.insertBefore(el, list.firstChild);
  return id;
}

function updateLog(id, cls, msg) {
  const el = document.getElementById(id + '-b');
  if (el) { el.className = 'li-badge ' + cls; el.textContent = msg; }
}

// ── SOUND ─────────────────────────────────────────────────────────────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[523, 0], [659, 0.15], [784, 0.3]].forEach(([freq, t]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.28, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.4);
    });
  } catch(e) {}
}

function toggleSound() {
  soundOn = !soundOn;
  document.getElementById('sound-btn').textContent = soundOn ? '🔔 Sound' : '🔕 Sound';
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastT;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3500);
}
