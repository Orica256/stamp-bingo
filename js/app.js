// =====================================================
// CONFIG - スポット定義
// ここを変更してスポット名・アイコンをカスタマイズ
// =====================================================
const STAMP_SPOTS = [
  { id: 'A', label: '入口広場',      icon: '🏛️' },
  { id: 'B', label: 'フードゾーン',  icon: '🍜' },
  { id: 'C', label: '体育館',        icon: '⚽' },
  { id: 'D', label: '理科展示',      icon: '🔬' },
  { id: 'E', label: 'ステージ',      icon: '🎤' },
  { id: 'F', label: '図書館',        icon: '📚' },
  { id: 'G', label: 'アート展',      icon: '🎨' },
  { id: 'H', label: 'ゲームコーナー',icon: '🎮' },
  { id: 'I', label: '出口広場',      icon: '🎪' },
];

// ビンゴライン定義 (3x3, 0-8)
const BINGO_LINES = [
  [0,1,2],[3,4,5],[6,7,8],  // 横
  [0,3,6],[1,4,7],[2,5,8],  // 縦
  [0,4,8],[2,4,6],           // 斜め
];

// =====================================================
// STATE
// =====================================================
function loadState() {
  try {
    const s = localStorage.getItem('sbState');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
function saveState() {
  localStorage.setItem('sbState', JSON.stringify(state));
}

let state = loadState() || {
  stamps: [],
  bingoLines: [],
  prizeCode: null,
  sessionId: Math.random().toString(36).slice(2, 10),
};

function loadPrizeLog() {
  try { return JSON.parse(localStorage.getItem('sbPrizeLog') || '[]'); } catch { return []; }
}
function savePrizeLog(log) {
  localStorage.setItem('sbPrizeLog', JSON.stringify(log));
}

// =====================================================
// SCREEN ROUTING
// =====================================================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nb = document.getElementById('nav-' + name);
  if (nb) nb.classList.add('active');
}

function goToBingo() {
  document.getElementById('bottom-nav').classList.add('visible');
  showScreen('bingo');
  buildGrid();
  renderGrid();
}

function showAdmin() {
  document.getElementById('bottom-nav').classList.add('visible');
  showScreen('admin');
  renderAdmin();
}

// =====================================================
// URL PARAMETER HANDLER (NFC/QR用)
// index.html?stamp=A のようなURLを処理
// =====================================================
function handleURLStamp() {
  const params = new URLSearchParams(window.location.search);
  const stampId = params.get('stamp');
  if (!stampId) return false;

  // URLをきれいにする（ブラウザ履歴にパラメータを残さない）
  const cleanUrl = window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);

  // リダイレクト画面を表示してからスタンプ処理
  showScreen('redirect');
  const spot = STAMP_SPOTS.find(s => s.id === stampId.toUpperCase());

  const iconEl = document.getElementById('redirect-icon');
  const titleEl = document.getElementById('redirect-title');
  const descEl = document.getElementById('redirect-desc');

  if (spot) {
    iconEl.textContent = spot.icon;
    titleEl.textContent = spot.label;
    descEl.textContent = 'スタンプを読み取りました！\nビンゴカードに反映します...';
  } else {
    iconEl.textContent = '❓';
    titleEl.textContent = '無効なスタンプ';
    descEl.textContent = 'このURLは無効です。スタッフにご確認ください。';
    setTimeout(() => goToBingo(), 2000);
    return true;
  }

  setTimeout(() => {
    goToBingo();
    applyStamp(stampId.toUpperCase(), true); // fromNFC=true
  }, 1200);

  return true;
}

// =====================================================
// GRID
// =====================================================
function buildGrid() {
  const grid = document.getElementById('bingo-grid');
  if (grid.children.length > 0) return;
  STAMP_SPOTS.forEach((spot, idx) => {
    const cell = document.createElement('div');
    cell.className = 'bingo-cell';
    cell.id = 'cell-' + idx;
    cell.innerHTML = `
      <div class="stamp-mark"><div class="stamp-mark-inner"></div></div>
      <div class="cell-icon">${spot.icon}</div>
      <div class="cell-label">${spot.label}</div>`;
    grid.appendChild(cell);
  });
}

function renderGrid() {
  const completedLines = checkBingo();
  const highlightCells = new Set(completedLines.flatMap(li => BINGO_LINES[li]));

  STAMP_SPOTS.forEach((spot, idx) => {
    const cell = document.getElementById('cell-' + idx);
    if (!cell) return;
    const isStamped = state.stamps.includes(spot.id);
    cell.classList.toggle('stamped', isStamped);
    cell.classList.toggle('bingo-line', isStamped && highlightCells.has(idx));
  });

  const count = state.stamps.length;
  document.getElementById('stamp-count-label').textContent = `${count} / 9`;
  document.getElementById('progress-fill').style.width = `${(count / 9) * 100}%`;
  document.getElementById('stamp-count-badge').textContent = count;
  document.getElementById('bingo-count-badge').textContent = completedLines.length;
}

function checkBingo() {
  return BINGO_LINES
    .map((line, i) => ({ i, ok: line.every(idx => state.stamps.includes(STAMP_SPOTS[idx].id)) }))
    .filter(x => x.ok)
    .map(x => x.i);
}

// =====================================================
// STAMP
// =====================================================
function applyStamp(spotId, fromNFC = false) {
  const spot = STAMP_SPOTS.find(s => s.id === spotId);
  if (!spot) { showToast('無効なスポットです'); return; }

  if (state.stamps.includes(spotId)) {
    showStampBanner(spot, true); // already stamped
    return;
  }

  state.stamps.push(spotId);
  saveState();
  buildGrid();
  renderGrid();
  showStampBanner(spot, false);

  // ビンゴチェック
  const lines = checkBingo();
  const newLines = lines.filter(li => !state.bingoLines.includes(li));
  if (newLines.length > 0) {
    state.bingoLines = lines;
    saveState();
    setTimeout(() => triggerBingo(), 700);
  }
}

// =====================================================
// STAMP BANNER
// =====================================================
function showStampBanner(spot, alreadyStamped) {
  const banner = document.getElementById('stamp-banner');
  document.getElementById('banner-icon').textContent = spot.icon;
  document.getElementById('banner-title').textContent = alreadyStamped
    ? `${spot.label} はスタンプ済みです`
    : `${spot.label} のスタンプ獲得！`;
  document.getElementById('banner-sub').textContent = alreadyStamped
    ? '同じスポットは1回のみカウントされます'
    : `スタンプ ${state.stamps.length} / 9 個獲得中`;
  banner.classList.add('active');
  setTimeout(() => banner.classList.remove('active'), 3500);
}

// =====================================================
// BINGO POPUP
// =====================================================
function triggerBingo() {
  if (!state.prizeCode) {
    state.prizeCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    saveState();
    const log = loadPrizeLog();
    log.unshift({
      code: state.prizeCode,
      session: state.sessionId,
      time: new Date().toLocaleString('ja-JP'),
      given: false,
    });
    savePrizeLog(log);
  }
  document.getElementById('popup-prize-code').textContent = state.prizeCode;
  document.getElementById('bingo-popup').classList.add('active');
  launchConfetti();
}

function closeBingoPopup() {
  document.getElementById('bingo-popup').classList.remove('active');
}

function launchConfetti() {
  const wrap = document.getElementById('confetti-wrap');
  wrap.innerHTML = '';
  const colors = ['#ff6b35','#ffd700','#6ee7a0','#7eb8ff','#ff9ef5'];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    const size = 4 + Math.random() * 8;
    el.style.cssText = `
      left:${Math.random()*100}%;top:-10px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${1.5+Math.random()*2}s;
      animation-delay:${Math.random()*1}s;
      width:${size}px;height:${size}px;
    `;
    wrap.appendChild(el);
  }
}

// =====================================================
// ADMIN
// =====================================================
function renderAdmin() {
  const log = loadPrizeLog();
  const given = log.filter(l => l.given).length;
  const pending = log.filter(l => !l.given).length;

  document.getElementById('stat-total-sessions').textContent = log.length;
  document.getElementById('stat-total-bingo').textContent = log.length;
  document.getElementById('stat-prizes-given').textContent = given;
  document.getElementById('stat-prizes-pending').textContent = pending;

  // prize log
  const logEl = document.getElementById('prize-log');
  if (!log.length) {
    logEl.innerHTML = '<div style="color:var(--muted);font-size:.78rem;text-align:center;padding:10px">まだ記録がありません</div>';
  } else {
    logEl.innerHTML = log.map((e, idx) => `
      <div class="prize-item">
        <div>
          <div class="pi-code">${e.code}</div>
          <div class="pi-time">${e.time}</div>
        </div>
        ${e.given
          ? '<div class="pi-given">渡し済み ✓</div>'
          : `<button onclick="markGiven(${idx})" style="background:var(--accent);border:none;border-radius:7px;padding:5px 11px;color:#fff;font-size:.7rem;cursor:pointer;font-family:inherit">景品渡す</button>`
        }
      </div>`).join('');
  }

  // NFC URL list
  renderNFCSetup();
}

function renderNFCSetup() {
  const base = window.location.origin + window.location.pathname;
  const wrap = document.getElementById('nfc-setup');
  wrap.innerHTML = STAMP_SPOTS.map(spot => {
    const url = `${base}?stamp=${spot.id}`;
    return `
      <div class="spot-row">
        <div class="spot-info">
          <div class="spot-icon">${spot.icon}</div>
          <div>
            <div class="spot-name">${spot.label}</div>
            <div class="spot-url">${url}</div>
          </div>
        </div>
        <button class="btn-copy" onclick="copyURL('${url}', this)">コピー</button>
      </div>`;
  }).join('');
}

function copyURL(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = '✓ コピー済み';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'コピー'; btn.classList.remove('copied'); }, 2000);
  });
}

function markGiven(idx) {
  const log = loadPrizeLog();
  log[idx].given = true;
  savePrizeLog(log);
  renderAdmin();
  showToast('景品を渡しました ✓');
}

function verifyCode() {
  const input = document.getElementById('prize-code-input').value.trim().toUpperCase();
  const res = document.getElementById('verify-result');
  if (!input) return;
  const log = loadPrizeLog();
  const entry = log.find(l => l.code === input);
  if (!entry) {
    res.className = 'verify-result error';
    res.textContent = '❌ このコードは存在しません';
  } else if (entry.given) {
    res.className = 'verify-result used';
    res.textContent = `⚠️ このコードは既に使用済みです（${entry.time}）`;
  } else {
    res.className = 'verify-result success';
    res.textContent = '✅ 有効なコードです！景品を渡してください';
    const idx = log.indexOf(entry);
    setTimeout(() => markGiven(idx), 1500);
  }
}

function resetAll() {
  if (!confirm('全データをリセットしますか？\nこの操作は取り消せません。')) return;
  localStorage.removeItem('sbState');
  localStorage.removeItem('sbPrizeLog');
  state = { stamps: [], bingoLines: [], prizeCode: null, sessionId: Math.random().toString(36).slice(2, 10) };
  document.getElementById('bingo-grid').innerHTML = '';
  buildGrid();
  renderGrid();
  renderAdmin();
  showToast('リセットしました');
}

// =====================================================
// TOAST
// =====================================================
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // NFCタグのURLパラメータを最優先で処理
  const handled = handleURLStamp();

  if (!handled) {
    // 通常起動
    if (state.stamps.length > 0 || state.bingoLines.length > 0) {
      // セッションあり → ビンゴ画面へ
      goToBingo();
    }
    // else → トップ画面のまま
  }
});
