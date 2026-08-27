/* ─── SUPABASE ─────────────────────────────── */
const SUPA_URL = 'https://lcsscdpaffiorizgovfu.supabase.co';
const SUPA_KEY = 'sb_publishable_VQ8kWeHxvk2KseqO3_5wFw_EA3Xcl5M';
const sb = supabase.createClient(SUPA_URL, SUPA_KEY);

/* ─── STATE ────────────────────────────────── */
let members = [];
let records = [];
let currentAtt = null;
let _pastMs = [];
let viewingRecordId = null;
let _editMode = false;          // are we in edit mode for a saved record?
let _editOriginalMs = null;     // snapshot of statuses before editing (for cancel revert)

// Cache flags — true means data is fresh, no need to re-fetch
let _membersCached = false;
let _recordsCached = false;

const PRELOADED = [
  ['Girdhar','Dudani'],['Pooja','Hurkat'],['Nemish','Mahendra'],['Saurav','Chhangani'],
  ['Goraj','Bawankule'],['Rohit','Bhojwani'],['Pparas','Chhabria'],['Ketan','Fiske'],
  ['Shreyansh','Jain'],['Aman','Bobde'],['Suraj','Gupta'],['Abhishek','Jhawar'],
  ['Shiril','Vaswani'],['Satyendra','Tiwari'],['Lallit','Nathhani'],['Girish','Palod'],
  ['Gopikishan','Dayani'],['Rahul','Kishnani'],['Deepak','Krishnani'],['Mayur','Wadhwani'],
  ['Disha','Anwani'],['Harshvardhan','Pasari'],['Rajiv','Singh'],['Vijaykumar','Salwe'],
  ['Kamal','Rathii'],['Hussain','Bharmall'],['Rashi','Laddha'],['Vijay','Patel'],
  ['Sanjay','Basantani'],['Santosh','Mane'],['Mohsin','Khan'],['Bhavin','Patel'],
  ['Kaushik','Patel'],['Mithun','Patil'],['Chetan','Chavhan'],['Dinesh','Gyanchandani'],
  ['Vikram','Keswani'],['Swapnil','Kalamkar'],['Roshan','Sadhwani'],['Hitesh','Parse'],
  ['Mohammad','Rehan'],['Minal','Kharwade'],['Romit','Patel'],['Akshay','Mandankar'],
  ['Dhammadeep','Gajbe'],['Sohel','Ahmed'],['Aniket','Dumanwar'],['Sougat','Nandy'],
  ['Quresh','Ezzi'],['Ankit','Kothari'],['Gopal','Gadewar']
];

/* ─── HELPERS ──────────────────────────────── */
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const formatDate = iso => { if(!iso)return''; const[y,mo,d]=iso.split('-'); return `${d.padStart(2,'0')}/${mo.padStart(2,'0')}/${y.slice(2)}`; };
const getCounts = ms => ({ P:ms.filter(m=>m.status==='P').length, A:ms.filter(m=>m.status==='A').length, L:ms.filter(m=>m.status==='L').length, S:ms.filter(m=>m.status==='S').length, unmarked:ms.filter(m=>m.status==='').length });
const chevron = () => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:14px;height:14px;color:var(--text3);flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;
const statChevron = () => `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" class="stat-tile-chevron"><path d="M11 18L16 13L11 8" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const xIcon = () => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#xclip)"><path d="M14.0625 3.9375L3.9375 14.0625" stroke="#202322" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.0625 14.0625L3.9375 3.9375" stroke="#202322" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="xclip"><rect width="18" height="18" fill="white"/></clipPath></defs></svg>`;

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.getElementById('app').appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* ─── SCREENS ──────────────────────────────── */
function _show(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  closeModal();
  closeMemberMenu();
}
function setLoading(msg='Loading...') {
  document.getElementById('loading-text').textContent = msg;
  _show('screen-loading');
}
function goHome() {
  _show('screen-home');
  setNavActive('home');
  renderHomeMembers();
  // Silently refresh members in background if cache stale
  if(!_membersCached) _loadMembers();
}
async function goRecords() {
  if(_recordsCached) {
    // Instant — use cached data
    _show('screen-records');
    setNavActive('records');
    renderRecords();
  } else {
    setLoading('Loading records...');
    await _loadRecords();
    _show('screen-records');
    setNavActive('records');
    renderRecords();
  }
}

async function _loadMembers() {
  const {data:m, error} = await sb.from('members').select('*').eq('is_active',true).order('first_name');
  if(error) return;
  members = m||[];
  _membersCached = true;
  renderHomeMembers(document.getElementById('home-search')?.value||'');
}

async function _loadRecords() {
  const {data,error} = await sb.from('records').select('*').order('date',{ascending:false});
  if(error){ showToast('Error loading records'); return; }
  records = data||[];
  _recordsCached = true;
}
function setNavActive(tab) {
  document.getElementById('nav-h1').className = 'nav-item' + (tab==='home'?' active':'');
  document.getElementById('nav-h2').className = 'nav-item' + (tab==='home'?' active':'');
  document.getElementById('nav-r1').className = 'nav-item' + (tab==='records'?' active':'');
  document.getElementById('nav-r2').className = 'nav-item' + (tab==='records'?' active':'');
}

/* ─── MODAL ────────────────────────────────── */
let _modalGen = 0;
function showModal(html, centered=false) {
  const gen = ++_modalGen;
  document.getElementById('modal-root').innerHTML =
    `<div class="modal-overlay${centered?' centered':''} t-backdrop-fade" id="modal-overlay" data-open="false" onclick="if(event.target.id==='modal-overlay')closeModal()">${html}</div>`;
  const overlay = document.getElementById('modal-overlay');
  const panel = overlay?.firstElementChild;
  if(centered){
    // Backdrop should fade at the popup's own pace, not the sheet's.
    overlay.style.setProperty('--panel-open-dur', 'var(--modal-open-dur)');
    overlay.style.setProperty('--panel-close-dur', 'var(--modal-close-dur)');
    if(panel) panel.classList.add('t-modal');
  } else if(panel){
    panel.classList.add('t-panel-slide');
    panel.dataset.open = 'false';
    panel.style.setProperty('--panel-translate-y', (panel.offsetHeight * 0.5) + 'px');
  }
  // Two rAFs: the first commits the closed state to a rendered frame,
  // the second flips to open so the transition actually has something
  // to animate from instead of the element appearing already-open.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if(gen !== _modalGen) return; // a newer modal replaced this one already
    overlay.dataset.open = 'true';
    if(panel){
      if(centered) panel.classList.add('is-open');
      else panel.dataset.open = 'true';
    }
  }));
}
function closeModal() {
  const gen = _modalGen;
  const overlay = document.getElementById('modal-overlay');
  if(!overlay) return;
  const panel = overlay.firstElementChild;
  const centered = overlay.classList.contains('centered');
  overlay.dataset.open = 'false';
  let closeDur = 350; // matches --panel-close-dur (sheet)
  if(panel){
    if(centered){
      panel.classList.remove('is-open');
      panel.classList.add('is-closing');
      closeDur = 150; // matches --modal-close-dur (popup)
    } else {
      panel.dataset.open = 'false';
    }
  }
  setTimeout(() => {
    if(gen !== _modalGen) return; // a new modal opened before this close finished
    const root = document.getElementById('modal-root');
    if(root) root.innerHTML = '';
  }, closeDur);
}

/* Shared confirm-dialog icons — currentColor so each button's
   text color (set by .action-btn.cancel / .save / .danger) also
   drives the icon color. */
const ICON_CROSS = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 2.84961C12.6723 2.84961 12.838 2.91826 12.96 3.04004C13.0818 3.16192 13.1503 3.32764 13.1504 3.5C13.1504 3.67246 13.0819 3.83801 12.96 3.95996L8.91895 8L12.96 12.04C13.0202 12.1003 13.0679 12.1723 13.1006 12.251C13.1332 12.3298 13.1504 12.4147 13.1504 12.5C13.1504 12.5854 13.1333 12.6701 13.1006 12.749C13.0679 12.8279 13.0203 12.8996 12.96 12.96C12.8996 13.0203 12.8279 13.0679 12.749 13.1006C12.6701 13.1333 12.5854 13.1504 12.5 13.1504C12.4147 13.1504 12.3298 13.1332 12.251 13.1006C12.1723 13.0679 12.1003 13.0202 12.04 12.96L8 8.91895L3.95996 12.96C3.83801 13.0819 3.67246 13.1504 3.5 13.1504C3.32764 13.1503 3.16192 13.0818 3.04004 12.96C2.91826 12.838 2.84961 12.6723 2.84961 12.5C2.84968 12.3276 2.91815 12.1619 3.04004 12.04L7.08105 8L3.04004 3.95996C2.91826 3.83804 2.84961 3.67233 2.84961 3.5C2.84968 3.32764 2.91815 3.16192 3.04004 3.04004C3.16192 2.91815 3.32764 2.84968 3.5 2.84961C3.67233 2.84961 3.83804 2.91826 3.95996 3.04004L8 7.08105L12.04 3.04004C12.1619 2.91815 12.3276 2.84968 12.5 2.84961Z" fill="currentColor" stroke="currentColor" stroke-width="0.3"/></svg>`;
const ICON_X = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 3.5L3.5 12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 12.5L3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_PLUS = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8H13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 2.5V13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CHECK = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.5547 3.90918C13.7403 3.90918 13.9185 3.9831 14.0498 4.11426C14.1811 4.24552 14.2548 4.42375 14.2549 4.60938C14.2549 4.7951 14.1811 4.97316 14.0498 5.10449L6.0498 13.1045C5.98484 13.1695 5.90813 13.2216 5.82324 13.2568C5.73826 13.2921 5.64668 13.3096 5.55469 13.3096C5.46287 13.3095 5.37194 13.292 5.28711 13.2568C5.20213 13.2216 5.12458 13.1696 5.05957 13.1045L1.55957 9.60449C1.42842 9.47319 1.35449 9.29497 1.35449 9.10938C1.35457 8.92375 1.42831 8.74552 1.55957 8.61426C1.69083 8.483 1.86906 8.40925 2.05469 8.40918C2.24028 8.40918 2.4185 8.4831 2.5498 8.61426L5.55469 11.6191L13.0596 4.11426C13.1908 3.983 13.3691 3.90925 13.5547 3.90918Z" fill="currentColor" stroke="currentColor" stroke-width="0.4"/></svg>`;
const ICON_TRASH = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_529_4122)"><path d="M13.5 3.5H2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 6.5V10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 6.5V10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 3.5V13C12.5 13.1326 12.4473 13.2598 12.3536 13.3536C12.2598 13.4473 12.1326 13.5 12 13.5H4C3.86739 13.5 3.74021 13.4473 3.64645 13.3536C3.55268 13.2598 3.5 13.1326 3.5 13V3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 3.5V2.5C10.5 2.23478 10.3946 1.98043 10.2071 1.79289C10.0196 1.60536 9.76522 1.5 9.5 1.5H6.5C6.23478 1.5 5.98043 1.60536 5.79289 1.79289C5.60536 1.98043 5.5 2.23478 5.5 2.5V3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_529_4122"><rect width="16" height="16" fill="white"/></clipPath></defs></svg>`;
const ICON_SIGNOUT = `<svg width="16" height="16" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_529_4505)"><path d="M7.4375 2.65625H3.1875V14.3438H7.4375" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.4375 8.5H14.875" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.2188 5.84375L14.875 8.5L12.2188 11.1562" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_529_4505"><rect width="17" height="17" fill="white"/></clipPath></defs></svg>`;

let _pendingConfirmOk = null;
function showConfirm(title, msg, okLabel, onOk, opts = {}) {
  const { cancelLabel='Cancel', okIcon=ICON_CHECK, cancelIcon=ICON_CROSS } = opts;
  _pendingConfirmOk = onOk;
  showModal(`<div class="confirm-card">
    <div class="confirm-header">
      <span class="confirm-header-spacer"></span>
      <div class="confirm-title">${title}</div>
      <button class="confirm-close" onclick="closeModal()">${ICON_CROSS}</button>
    </div>
    <div class="confirm-body">
      <div class="confirm-msg">${msg}</div>
    </div>
    <div class="action-bar">
      <button class="action-btn cancel" onclick="closeModal()">${cancelIcon}${cancelLabel}</button>
      <button class="action-btn save" onclick="_confirmOk()">${okIcon}${okLabel}</button>
    </div>
  </div>`, true);
}
function _confirmOk() {
  const fn = _pendingConfirmOk;
  _pendingConfirmOk = null;
  closeModal();
  if(fn) fn();
}

/* ─── AUTH ─────────────────────────────────── */
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  errEl.textContent = '';
  if(!email||!pass){ errEl.textContent='Please enter email and password.'; return; }
  btn.disabled=true; btn.textContent='Signing in...';
  const {error} = await sb.auth.signInWithPassword({email, password:pass});
  if(error){ errEl.textContent='Incorrect email or password.'; btn.disabled=false; btn.textContent='Sign In'; return; }
  await initApp();
}

async function doLogout() {
  showConfirm('Sign Out','Are you sure you want to Sign Out?','Sign Out', async function(){
    await sb.auth.signOut();
    members=[]; records=[]; currentAtt=null;
    closeModal();
    _show('screen-login');
    document.getElementById('login-pass').value='';
    document.getElementById('login-btn').disabled=false;
    document.getElementById('login-btn').textContent='Sign In';
  }, {okIcon: ICON_SIGNOUT});
}

/* ─── INIT ─────────────────────────────────── */
async function initApp() {
  setLoading('Loading members...');
  // Kick off records fetch in parallel while members load
  const [membersResult, recordsResult, statsResult] = await Promise.all([
    sb.from('members').select('*').eq('is_active',true).order('first_name'),
    sb.from('records').select('*').order('date',{ascending:false}),
    sb.from('member_stats').select('*')
  ]);
  if(membersResult.error){
    document.getElementById('loading-text').textContent = 'Error: ' + membersResult.error.message;
    return;
  }
  members = membersResult.data||[];
  records = recordsResult.data||[];
  memberStats = statsResult.data||[];
  _membersCached = true;
  _recordsCached = true;

  // One-time self-heal: if member_stats is empty but saved attendance
  // already exists (e.g. recorded before this feature was added), backfill
  // stats for every member now instead of leaving sliders permanently blank.
  const hasSavedRecords = records.some(r=>r.status==='saved');
  if(memberStats.length===0 && hasSavedRecords && members.length){
    setLoading('Setting up attendance stats...');
    try{
      await _refreshMemberStats(members.map(m=>m.id));
    }catch(e){
      console.error('Stats backfill failed:', e);
    }
  }

  goHome();
}

/* ─── HOME ─────────────────────────────────── */
function renderHomeMembers(filter='') {
  const el = document.getElementById('home-members-list');
  const q = filter.toLowerCase();
  const filtered = members.filter(m=>`${m.first_name} ${m.last_name}`.toLowerCase().includes(q));
  if(!filtered.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No members found</div><div class="empty-sub">Try a different search term</div></div>`;
    return;
  }
  el.innerHTML = filtered.map((m,i) => {
    const stats = memberStats.find(s => s.member_id === m.id);
    const pct = stats?.attendance_percentage ?? null;
    return `<div class="member-row" onclick="openMemberProfile('${m.id}')">
      <div class="member-row-main">
        <span class="sr-num">${i+1}</span>
        <span class="member-name-text">${esc(m.first_name)} ${esc(m.last_name)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        ${renderSlider(pct)}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 13L11 8L6 3" stroke="#8B8C8C" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>`;
  }).join('');
}

function renderSlider(pct) {
  if(pct === null || pct === undefined) {
    return `<div class="att-slider att-slider--blank"><div class="att-slider__track"><div class="att-slider__fill"></div></div></div>`;
  }
  const colorClass = pct <= 33 ? 'bad' : pct <= 66 ? 'moderate' : 'good';
  const pos = Math.min(Math.max(Math.round(pct), 2), 98);
  return `<div class="att-slider att-slider--${colorClass}">
    <div class="att-slider__track">
      <div class="att-slider__fill"></div>
      <div class="att-slider__dot" style="left:calc(${pos}% - 4.5px)"></div>
    </div>
  </div>`;
}


/* ── Member Profile Screen ─────────────────────────────────────── */
async function openMemberProfile(memberId) {
  viewingMemberId = memberId;
  const m = members.find(x => x.id === memberId);
  if(!m) return;
  const stats = memberStats.find(s => s.member_id === memberId) || {};

  document.getElementById('mp-name').textContent = `${m.first_name} ${m.last_name}`;
  document.getElementById('mp-delete-btn').onclick = () => deleteMember(memberId);
  document.getElementById('mp-edit-btn').onclick = () => openEditMember(memberId);

  const tileHtml = (label, count, status) =>
    `<div class="stat-tile ${count===0?'inactive':''}" onclick="openMemberStatDrawer('${memberId}','${status}','${label}')">
      <span class="stat-tile-label">${label}</span>
      <span style="display:flex;align-items:center;gap:8px;"><span class="stat-tile-count">${count}</span>${statChevron()}</span>
    </div>`;

  document.getElementById('mp-stat-tiles').innerHTML = `<div class="stat-tiles">
    ${tileHtml('Present', stats.present_count||0, 'P')}
    ${tileHtml('Absent', stats.absent_count||0, 'A')}
    ${tileHtml('Late', stats.late_count||0, 'L')}
    ${tileHtml('Substitute', stats.substitute_count||0, 'S')}
  </div>`;

  let last7 = stats.last_7_statuses || [];
  if(typeof last7 === 'string'){
    try{ last7 = JSON.parse(last7); }catch(e){ last7 = []; }
  }
  if(!Array.isArray(last7)) last7 = [];
  const trendEl = document.getElementById('mp-trend');
  if(last7.length === 7) {
    const pills = [...last7].reverse().map(s => {
      const cls = ['P','A','L','S'].includes(s) ? `status-sq status-sq--${s}` : 'status-sq';
      const style = ['P','A','L','S'].includes(s) ? '' : 'style="background:#F6F6F6;color:#8B8E8D;"';
      return `<div class="${cls}" ${style}>${s}</div>`;
    }).join('');
    trendEl.innerHTML = `<div class="mp-section">
      <div class="mp-section-title">Trend</div>
      <div class="mp-section-sub">Attendance trend since last 7 meetings</div>
      <div class="trend-row">${pills}</div>
    </div>`;
    trendEl.style.display = '';
  } else {
    trendEl.style.display = 'none';
  }

  await loadMemberAttendance(memberId);
  renderMemberCalendar(memberId, new Date().getFullYear(), new Date().getMonth());
  _show('screen-member-profile');
}

async function loadMemberAttendance(memberId) {
  const {data} = await sb.from('attendance')
    .select('status, records!inner(date,status)')
    .eq('member_id', memberId)
    .eq('records.status', 'saved');
  const map = {};
  (data||[]).forEach(a => { if(a.records?.date) map[a.records.date] = a.status; });
  if(!window._memberAttCache) window._memberAttCache = {};
  window._memberAttCache[memberId] = map;
  return map;
}

function getMemberAttBounds(memberId) {
  const cache = window._memberAttCache?.[memberId] || {};
  const keys = Object.keys(cache).sort();
  if(!keys.length) return null;
  const first = keys[0], last = keys[keys.length-1];
  const [minY,minM] = first.split('-').map(Number);
  const [maxY,maxM] = last.split('-').map(Number);
  return { minY, minM: minM-1, maxY, maxM: maxM-1 };
}

function renderMemberCalendar(memberId, year, month) {
  const calEl = document.getElementById('mp-calendar');
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayHeaders = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const cache = window._memberAttCache?.[memberId] || {};
  const bounds = getMemberAttBounds(memberId);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const allCells = [];
  for(let i = firstDay-1; i >= 0; i--)
    allCells.push(`<div class="cal-cell cal-cell--other">${prevDays-i}</div>`);
  for(let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const s = cache[ds];
    if(s && ['P','A','L','S'].includes(s)) {
      allCells.push(`<div class="status-sq status-sq--${s}">${d}</div>`);
    } else {
      allCells.push(`<div class="cal-cell">${d}</div>`);
    }
  }
  const rem = (7 - (allCells.length % 7)) % 7;
  for(let d = 1; d <= rem; d++)
    allCells.push(`<div class="cal-cell cal-cell--other">${d}</div>`);

  // Build one flex row per week (7 cells each), matching Figma's row-by-row
  // structure, instead of a single CSS grid which stretches column widths.
  let weekRows = '';
  for(let i = 0; i < allCells.length; i += 7) {
    weekRows += `<div class="cal-row">${allCells.slice(i, i+7).join('')}</div>`;
  }

  const atMin = bounds && (year < bounds.minY || (year === bounds.minY && month <= bounds.minM));
  const atMax = bounds && (year > bounds.maxY || (year === bounds.maxY && month >= bounds.maxM));

  calEl.innerHTML = `<div class="mp-section">
    <div class="mp-section-title" style="margin-bottom:20px;">Calendar View</div>
    <div class="cal-body">
      <div class="cal-nav">
        <button class="cal-nav-btn" ${atMin?'disabled':''} onclick="shiftCalendar('${memberId}',${year},${month},-1)">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.125 10.5625L4.0625 6.5L8.125 2.4375" stroke="#606264" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span class="cal-month-label">${monthNames[month]} ${year}</span>
        <button class="cal-nav-btn" ${atMax?'disabled':''} onclick="shiftCalendar('${memberId}',${year},${month},1)">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4.875 10.5625L8.9375 6.5L4.875 2.4375" stroke="#606264" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="cal-rows">
        <div class="cal-row cal-row--header">
          ${dayHeaders.map(d=>`<div class="cal-day-header">${d}</div>`).join('')}
        </div>
        ${weekRows}
      </div>
    </div>
  </div>`;
}

function shiftCalendar(memberId, year, month, dir) {
  const bounds = getMemberAttBounds(memberId);
  let m = month + dir, y = year;
  if(m < 0){ m = 11; y--; }
  if(m > 11){ m = 0; y++; }
  if(bounds){
    if(y < bounds.minY || (y === bounds.minY && m < bounds.minM)) return;
    if(y > bounds.maxY || (y === bounds.maxY && m > bounds.maxM)) return;
  }
  renderMemberCalendar(memberId, y, m);
}

async function openMemberStatDrawer(memberId, status, label) {
  const {data} = await sb.from('attendance')
    .select('status, records!inner(id,date,status)')
    .eq('member_id', memberId)
    .eq('status', status)
    .eq('records.status', 'saved')
    .order('created_at', {ascending:false});

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const fmtDate = d => new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  const ARROW = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.1875 7H11.8125" stroke="#8B8E8D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.875 3.0625L11.8125 7L7.875 10.9375" stroke="#8B8E8D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CLOSE = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><g clip-path="url(#xc3)"><path d="M14.0625 3.9375L3.9375 14.0625" stroke="#202322" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.0625 14.0625L3.9375 3.9375" stroke="#202322" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="xc3"><rect width="18" height="18" fill="white"/></clipPath></defs></svg>`;

  const rows = (data||[]).map(a => {
    const dt = new Date(a.records.date);
    return `<div style="display:flex;align-items:center;height:48px;padding:0 16px;border-bottom:1px solid #F5F5F5;">
      <span style="width:110px;flex-shrink:0;font-size:14px;color:#252525;font-weight:500;font-family:var(--font);">${fmtDate(a.records.date)}</span>
      <span style="width:90px;flex-shrink:0;margin-left:32px;text-align:left;font-size:14px;color:#252525;font-weight:500;font-family:var(--font);">${dayNames[dt.getDay()]}</span>
      <span style="flex:1;display:flex;justify-content:flex-end;">
        <button onclick="closeModal();viewRecord('${a.records.id}')" style="width:28px;height:28px;background:#fff;border-radius:8px;border:none;outline:1px solid #E8E8E8;outline-offset:-1px;display:flex;align-items:center;justify-content:center;cursor:pointer;">${ARROW}</button>
      </span>
    </div>`;
  }).join('') || `<div style="padding:24px;text-align:center;color:#B3B3B3;font-size:14px;font-family:var(--font);">No records</div>`;

  showModal(`<div class="modal-sheet">
    <div class="modal-sheet-header" id="filter-sticky-top">
      <div class="filter-drawer-header">
        <div class="filter-drawer-spacer"></div>
        <div class="filter-drawer-title">${label}</div>
        <button class="filter-drawer-close" onclick="closeModal()">${CLOSE}</button>
      </div>
      <div style="display:flex;align-items:center;padding:8px 16px;border-top:1px solid #E8E8E8;border-bottom:1px solid #E8E8E8;">
        <span style="width:110px;flex-shrink:0;font-size:14px;font-weight:500;color:#767676;font-family:var(--font);">Date</span>
        <span style="width:90px;flex-shrink:0;margin-left:32px;text-align:left;font-size:14px;font-weight:500;color:#767676;font-family:var(--font);">Day</span>
        <span style="flex:1;text-align:right;font-size:14px;font-weight:500;color:#767676;font-family:var(--font);">View</span>
      </div>
    </div>
    <div class="modal-sheet-body" style="padding:0;max-height:432px;overflow-y:auto;" onscroll="onFilterScroll(this)">${rows}</div>
  </div>`);
}


function openMemberMenu(id, btn) {
  closeMemberMenu();
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'member-menu';
  menu.id = 'member-menu-popup';
  menu.style.top = (rect.bottom + 6) + 'px';
  menu.style.left = (rect.right - 114) + 'px';
  menu.innerHTML = `
    <div class="member-menu-item edit" onclick="closeMemberMenu();openEditMember('${id}')">
      Edit
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_2019_2500)"><path d="M9.48633 1.0058C9.75796 1.03281 10.0132 1.15296 10.208 1.3476L12.6523 3.78998L12.7314 3.87689C12.9045 4.08819 13 4.35429 13 4.62982C12.9999 4.94452 12.8748 5.24607 12.6523 5.46869L5.9082 12.2148C5.68568 12.4371 5.38386 12.5623 5.06934 12.5624H2.625C2.31006 12.5624 2.00786 12.4375 1.78516 12.2148C1.56248 11.9921 1.4375 11.6899 1.4375 11.3749V8.9306L1.44336 8.81342C1.47042 8.54195 1.59067 8.28643 1.78516 8.09174L8.5293 1.3476C8.75197 1.12507 9.05433 0.999939 9.36914 0.999939L9.48633 1.0058Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.4375 3.5L10.5 6.5625" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_2019_2500"><rect width="14" height="14" fill="white"/></clipPath></defs></svg>
    </div>
    <div class="member-menu-item delete" onclick="closeMemberMenu();deleteMember('${id}')">
      Delete
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_2019_2506)"><path d="M13.5 3.5H2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 6.5V10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 6.5V10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 3.5V13C12.5 13.1326 12.4473 13.2598 12.3536 13.3536C12.2598 13.4473 12.1326 13.5 12 13.5H4C3.86739 13.5 3.74021 13.4473 3.64645 13.3536C3.55268 13.2598 3.5 13.1326 3.5 13V3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 3.5V2.5C10.5 2.23478 10.3946 1.98043 10.2071 1.79289C10.0196 1.60536 9.76522 1.5 9.5 1.5H6.5C6.23478 1.5 5.98043 1.60536 5.79289 1.79289C5.60536 1.98043 5.5 2.23478 5.5 2.5V3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_2019_2506"><rect width="16" height="16" fill="white"/></clipPath></defs></svg>
    </div>`;
  document.body.appendChild(menu);
  const catcher = document.createElement('div');
  catcher.id = 'member-menu-catcher';
  catcher.style.cssText = 'position:fixed;inset:0;z-index:199;';
  catcher.onclick = closeMemberMenu;
  document.body.appendChild(catcher);
}
function closeMemberMenu() {
  const m = document.getElementById('member-menu-popup'); if(m) m.remove();
  const c = document.getElementById('member-menu-catcher'); if(c) c.remove();
}
function onHomeScroll(el) {
  const top = document.getElementById('home-sticky-top');
  if(top) top.classList.toggle('scrolled', el.scrollTop > 0);
}

function openAddMember() {
  showModal(`<div class="modal-sheet">
    <div class="modal-sheet-header" id="filter-sticky-top">
      <div class="filter-drawer-header">
        <div class="filter-drawer-spacer"></div>
        <div class="filter-drawer-title">Add Member</div>
        <button class="filter-drawer-close" onclick="closeModal()">${xIcon()}</button>
      </div>
    </div>
    <div class="modal-sheet-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:20px;">
      <div class="form-field">
        <label class="form-label">First Name</label>
        <input class="form-input" id="add-fn" placeholder="e.g. Abhishek" onkeydown="if(event.key==='Enter')document.getElementById('add-ln').focus()"/>
      </div>
      <div class="form-field">
        <label class="form-label">Last Name</label>
        <input class="form-input" id="add-ln" placeholder="e.g. Jhawar" onkeydown="if(event.key==='Enter')confirmAdd()"/>
      </div>
    </div>
    <div class="action-bar">
      <button class="action-btn cancel" onclick="closeModal()">${ICON_X} Cancel</button>
      <button class="action-btn save" onclick="confirmAdd()">${ICON_PLUS} Add</button>
    </div>
  </div>`);
  setTimeout(()=>document.getElementById('add-fn')?.focus(),100);
}
async function confirmAdd() {
  const fn=(document.getElementById('add-fn')?.value||'').trim();
  const ln=(document.getElementById('add-ln')?.value||'').trim();
  if(!fn) return;
  const {data:sess}=await sb.auth.getSession(); const uid=sess?.session?.user?.id;
  const {data,error}=await sb.from('members').insert({first_name:fn,last_name:ln,is_active:true,user_id:uid}).select().single();
  if(error){showToast('Error adding member');return;}
  members.push(data);
  members.sort((a,b)=>a.first_name.localeCompare(b.first_name));
  // Insert blank stats row for new member
  await sb.from('member_stats').insert({
    user_id:uid, member_id:data.id,
    member_name:`${fn} ${ln}`,
    total_meetings:0,present_count:0,absent_count:0,late_count:0,substitute_count:0,
    attendance_percentage:null,last_7_statuses:[]
  });
  memberStats = (await sb.from('member_stats').select('*')).data||[];
  _membersCached = true;
  closeModal();
  renderHomeMembers(document.getElementById('home-search').value);
  showToast('Member added ✓');
}

function openEditMember(id) {
  const m=members.find(x=>x.id===id); if(!m)return;
  showModal(`<div class="modal-sheet">
    <div class="modal-sheet-header" id="filter-sticky-top">
      <div class="filter-drawer-header">
        <div class="filter-drawer-spacer"></div>
        <div class="filter-drawer-title">Edit Member</div>
        <button class="filter-drawer-close" onclick="closeModal()">${xIcon()}</button>
      </div>
    </div>
    <div class="modal-sheet-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:20px;">
      <div class="form-field">
        <label class="form-label">First Name</label>
        <input class="form-input" id="edit-fn" value="${esc(m.first_name)}" onkeydown="if(event.key==='Enter')document.getElementById('edit-ln').focus()"/>
      </div>
      <div class="form-field">
        <label class="form-label">Last Name</label>
        <input class="form-input" id="edit-ln" value="${esc(m.last_name)}" onkeydown="if(event.key==='Enter')confirmEdit('${id}')"/>
      </div>
    </div>
    <div class="action-bar">
      <button class="action-btn cancel" onclick="closeModal()">${ICON_X} Cancel</button>
      <button class="action-btn save" onclick="confirmEdit('${id}')">${ICON_CHECK} Save</button>
    </div>
  </div>`);
  setTimeout(()=>{const el=document.getElementById('edit-fn');if(el){el.focus();el.select();}},100);
}
async function confirmEdit(id) {
  const fn=(document.getElementById('edit-fn')?.value||'').trim();
  const ln=(document.getElementById('edit-ln')?.value||'').trim();
  if(!fn)return;
  const {error}=await sb.from('members').update({first_name:fn,last_name:ln}).eq('id',id);
  if(error){showToast('Error saving');return;}
  const m=members.find(x=>x.id===id);
  if(m){m.first_name=fn;m.last_name=ln;}
  _membersCached = true;
  closeModal();
  renderHomeMembers(document.getElementById('home-search').value);
  showToast('Saved ✓');
}

async function deleteMember(id) {
  const m=members.find(x=>x.id===id); if(!m)return;
  const name = `${esc(m.first_name)} ${esc(m.last_name)}`;
  showConfirm('Delete Member', `Are you sure you want to remove <strong>${name}</strong> from the member list?`, 'Delete', function(){ confirmDeleteMember(id); }, {okIcon: ICON_TRASH});
}

async function confirmDeleteMember(id) {
  console.log('Deleting member id:', id);
  if(!id || id === 'undefined'){ showToast('Error: invalid id'); return; }
  const {error} = await sb.from('members').update({is_active: false}).eq('id', id);
  if(error){
    console.error('Delete error:', error);
    showToast('Error: ' + error.message);
    return;
  }
  members = members.filter(x => x.id !== id);
  _membersCached = true;
  closeModal();
  renderHomeMembers(document.getElementById('home-search').value);
  showToast('Member removed');
}

/* ─── ATTENDANCE ───────────────────────────── */
function startAttendance() {
  if(!members.length){showToast('Add members first');return;}
  currentAtt = {
    id: null,
    date: todayStr(),
    status: 'draft',
    members: members.map(m=>({id:m.id, name:`${m.first_name} ${m.last_name}`, status:''}))
  };
  document.getElementById('att-date-text').textContent = formatDate(currentAtt.date);
  document.getElementById('att-date-input').value = currentAtt.date;
  document.getElementById('att-search').value = '';
  renderAttStats();
  renderAttMembers();
  _show('screen-attendance');
  pushHistory('screen-attendance');
}

function resumeDraft() {
  document.getElementById('att-date-text').textContent = formatDate(currentAtt.date);
  document.getElementById('att-date-input').value = currentAtt.date;
  document.getElementById('att-search').value = '';
  renderAttStats();
  renderAttMembers();
  _show('screen-attendance');
}

function openDatePicker() {
  const inp=document.getElementById('att-date-input');
  try{ inp.showPicker(); }catch(e){ inp.click(); }
}
function onAttScroll(el) {
  document.getElementById('att-sticky-top').classList.toggle('scrolled', el.scrollTop > 0);
}
function onMpScroll(el) {
  const top = document.getElementById('mp-sticky-top');
  if(top) top.classList.toggle('scrolled', el.scrollTop > 0);
}
function onPastScroll(el) {
  const top = document.getElementById('past-sticky-top');
  if(top) top.classList.toggle('scrolled', el.scrollTop > 0);
}
function onFilterScroll(el) {
  const top = document.getElementById('filter-sticky-top');
  if(top) top.classList.toggle('scrolled', el.scrollTop > 0);
}
function onDateChange(val) {
  if(!currentAtt||!val)return;
  currentAtt.date=val;
  document.getElementById('att-date-text').textContent=formatDate(val);
}

function setStatus(idx, s) {
  if(!currentAtt)return;
  currentAtt.members[idx].status = currentAtt.members[idx].status===s ? '' : s;
  renderAttStats();
  renderAttMembers(document.getElementById('att-search').value);
}

function updateSaveBtn() {
  const btn = document.getElementById('save-record-btn');
  if(!btn) return;
  const unmarked = currentAtt.members.filter(m=>m.status==='').length;
  // Disabled only when nobody is marked yet. Once at least one member
  // is marked, Save becomes clickable — saveRecord() itself decides
  // whether that click saves a draft (some unmarked) or the final
  // record (everyone marked).
  btn.disabled = unmarked === currentAtt.members.length;
}

function renderAttStats() {
  const c=getCounts(currentAtt.members);
  document.getElementById('att-stat-tiles').innerHTML=`<div class="stat-tiles">
    <div class="stat-tile full unmarked ${c.unmarked===0?'inactive':''}" onclick="openAttFilter('')">
      <span class="stat-tile-label">Unmarked</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.unmarked}</span>${statChevron()}</span>
    </div>
    <div class="stat-tile ${c.P===0?'inactive':''}" onclick="openAttFilter('P')">
      <span class="stat-tile-label">Present</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.P}</span>${statChevron()}</span>
    </div>
    <div class="stat-tile ${c.A===0?'inactive':''}" onclick="openAttFilter('A')">
      <span class="stat-tile-label">Absent</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.A}</span>${statChevron()}</span>
    </div>
    <div class="stat-tile ${c.L===0?'inactive':''}" onclick="openAttFilter('L')">
      <span class="stat-tile-label">Late</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.L}</span>${statChevron()}</span>
    </div>
    <div class="stat-tile ${c.S===0?'inactive':''}" onclick="openAttFilter('S')">
      <span class="stat-tile-label">Substitute</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.S}</span>${statChevron()}</span>
    </div>
  </div>`;
}

function renderAttMembers(filter='') {
  const q=filter.toLowerCase();
  const filtered=currentAtt.members.filter(m=>m.name.toLowerCase().includes(q));
  document.getElementById('att-members-list').innerHTML=filtered.map(m=>{
    const ri=currentAtt.members.indexOf(m);
    return `<div class="att-row">
      <span class="att-sr">${ri+1}</span>
      <span class="att-name">${esc(m.name)}</span>
      <div class="pals">${['P','A','L','S'].map(s=>`<button class="pals-btn${m.status===s?' active-'+s:''}" onclick="setStatus(${ri},'${s}')">${s}</button>`).join('')}</div>
    </div>`;
  }).join('');
  updateSaveBtn();
}

let _attFilterKey = null;
function openAttFilter(sf) {
  const target=sf===''?currentAtt.members.filter(m=>m.status===''):currentAtt.members.filter(m=>m.status===sf);
  const labels={'':'Unmarked Members','P':'Present Members','A':'Absent Members','L':'Late Members','S':'Substitute Members'};
  if(!target.length)return;
  _attFilterKey = sf;
  const rows=target.map((m,i)=>{
    const ri=currentAtt.members.indexOf(m);
    return `<div class="filter-member-row" data-ri="${ri}">
    <span class="filter-sr">${i+1}</span><span class="filter-name">${esc(m.name)}</span>
    <div class="filter-pals">${['P','A','L','S'].map(s=>
      `<button class="pals-btn${m.status===s?' active-'+s:''}" onclick="setStatusModal(${ri},'${s}')">${s}</button>`
    ).join('')}</div>
  </div>`;
  }).join('');
  showModal(`<div class="modal-sheet">
    <div class="modal-sheet-header" id="filter-sticky-top">
      <div class="filter-drawer-header"><div class="filter-drawer-spacer"></div><div class="filter-drawer-title">${labels[sf]}</div><button class="filter-drawer-close" onclick="closeModal()">${xIcon()}</button></div>
      <div class="att-table-header"><span class="att-th att-th-sr">Sr.</span><span class="att-th att-th-name">Name</span><span class="att-th att-th-status">Status</span></div>
    </div>
    <div class="modal-sheet-body filter-modal-body" onscroll="onFilterScroll(this)">${rows}</div>
  </div>`);
}
function setStatusModal(ri,s){
  currentAtt.members[ri].status=currentAtt.members[ri].status===s?'':s;
  renderAttStats();
  renderAttMembers(document.getElementById('att-search').value);

  const row = document.querySelector(`.filter-member-row[data-ri="${ri}"]`);
  if(!row || _attFilterKey === null) return;

  // Show the new selection immediately — no delay on the feedback itself.
  const m = currentAtt.members[ri];
  const btnsHtml = ['P','A','L','S'].map(st =>
    `<button class="pals-btn${m.status===st?' active-'+st:''}" onclick="setStatusModal(${ri},'${st}')">${st}</button>`
  ).join('');
  const palsEl = row.querySelector('.filter-pals');
  if(palsEl) palsEl.innerHTML = btnsHtml;
  row.style.pointerEvents = 'none'; // lock the row for the rest of this sequence

  // Any status change always removes the member from whichever single-status
  // (or Unmarked) filter this drawer is showing, so the row always needs to
  // leave: hold briefly so the selection registers, then slide it out before
  // actually removing it from the DOM.
  setTimeout(() => {
    row.classList.add('row-slide-out');
    setTimeout(() => {
      row.remove();
      document.querySelectorAll('.filter-member-row .filter-sr').forEach((el, idx) => {
        el.textContent = idx + 1;
      });
      if(!document.querySelector('.filter-member-row')){
        closeModal();
      }
    }, 350); // matches --panel-close-dur, same as the CSS transition above
  }, 400);
}

function backFromAttendance() {
  const marked=currentAtt.members.filter(m=>m.status!=='').length;
  if(marked===0){
    currentAtt=null; goHome();
  } else {
    showBackModal(marked);
  }
}

function showBackModal(marked) {
  showModal(`<div class="confirm-card">
    <div class="confirm-header">
      <span class="confirm-header-spacer"></span>
      <div class="confirm-title">Cancel Record</div>
      <button class="confirm-close" onclick="closeModal()">${ICON_CROSS}</button>
    </div>
    <div class="confirm-body">
      <div class="confirm-msg">You've marked <strong>${marked} members</strong>. Save as a draft to resume later, or delete this record completely.</div>
    </div>
    <div class="action-bar">
      <button class="action-btn cancel danger" onclick="discardAttendance()">${ICON_TRASH}Delete</button>
      <button class="action-btn save" onclick="saveDraftAndGoBack()">${ICON_CHECK}Save Draft</button>
    </div>
  </div>`, true);
}

async function saveDraftAndGoBack() {
  await upsertAtt('draft');
  currentAtt=null;
  closeModal();
  goHome();
}

async function discardAttendance() {
  // If record already exists in DB (resumed draft), delete it
  if(currentAtt && currentAtt.id) {
    await sb.from('attendance').delete().eq('record_id', currentAtt.id);
    await sb.from('records').delete().eq('id', currentAtt.id);
  }
  currentAtt=null;
  closeModal();
  goHome();
}

async function saveRecord() {
  const unmarked=currentAtt.members.filter(m=>m.status==='').length;
  if(unmarked>0){
    showConfirm('Save Draft',`There are still <strong>${unmarked} member(s)</strong> unmarked. Save this record as a draft.`,'Save Draft',async function(){
      await upsertAtt('draft'); currentAtt=null; closeModal(); await goRecords();
    });
    return;
  }
  setLoading('Saving...');
  await upsertAtt('saved');
  currentAtt=null;
  await goRecords();
  showToast('Attendance saved ✓');
}

async function upsertAtt(status) {
  const att=currentAtt; att.status=status;
  if(!att.id){
    const {data:rec,error}=await sb.from('records').insert({date:att.date,status}).select().single();
    if(error){showToast('Error saving');return;}
    att.id=rec.id;
    await sb.from('attendance').insert(att.members.map(m=>({record_id:rec.id,member_id:m.id,member_name:m.name,status:m.status})));
  } else {
    await sb.from('records').update({date:att.date,status}).eq('id',att.id);
    await sb.from('attendance').delete().eq('record_id',att.id);
    await sb.from('attendance').insert(att.members.map(m=>({record_id:att.id,member_id:m.id,member_name:m.name,status:m.status})));
  }
  _recordsCached = false; // force refresh on next records visit
  // Refresh member_stats after every saved record
  if(status === 'saved') {
    await _refreshMemberStats(att.members.map(m=>m.id));
  }
}

async function _refreshMemberStats(memberIds) {
  // Re-fetch stats for affected members from Supabase
  // Supabase computes the stats via a direct re-insert with upsert
  const {data:sess} = await sb.auth.getSession();
  const uid = sess?.session?.user?.id;
  for(const mid of memberIds){
    // Fetch all saved attendance for this member
    const {data:att} = await sb.from('attendance')
      .select('status, records(date,status)')
      .eq('member_id', mid)
      .eq('records.status','saved');
    const saved = (att||[]).filter(a=>a.records?.status==='saved');
    const total = saved.length;
    const P = saved.filter(a=>a.status==='P').length;
    const A = saved.filter(a=>a.status==='A').length;
    const L = saved.filter(a=>a.status==='L').length;
    const S = saved.filter(a=>a.status==='S').length;
    const pct = total > 0 ? Math.round(P*100/total*100)/100 : null;
    // Last 7 statuses ordered by date desc
    const sorted = [...saved].sort((a,b)=>new Date(b.records.date)-new Date(a.records.date));
    const last7 = sorted.slice(0,7).map(a=>a.status);
    const m = members.find(x=>x.id===mid);
    const name = m ? `${m.first_name} ${m.last_name}` : '';
    await sb.from('member_stats').upsert({
      user_id:uid, member_id:mid, member_name:name,
      total_meetings:total, present_count:P, absent_count:A, late_count:L, substitute_count:S,
      attendance_percentage:pct, last_7_statuses:last7, updated_at:new Date().toISOString()
    },{onConflict:'user_id,member_id'});
  }
  // Reload memberStats cache
  memberStats = (await sb.from('member_stats').select('*')).data||[];
}

/* ─── RECORDS ──────────────────────────────── */
const ICON_TAG_SAVED = `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1.3125C5.87512 1.3125 4.7755 1.64607 3.8402 2.27102C2.90489 2.89597 2.17591 3.78423 1.74544 4.82349C1.31496 5.86274 1.20233 7.00631 1.42179 8.10958C1.64124 9.21284 2.18292 10.2263 2.97833 11.0217C3.77374 11.8171 4.78716 12.3588 5.89043 12.5782C6.99369 12.7977 8.13726 12.685 9.17651 12.2546C10.2158 11.8241 11.104 11.0951 11.729 10.1598C12.3539 9.2245 12.6875 8.12488 12.6875 7C12.6859 5.49207 12.0862 4.04636 11.0199 2.98009C9.95365 1.91382 8.50793 1.31409 7 1.3125ZM9.49703 5.99703L6.43453 9.05953C6.3939 9.10021 6.34565 9.13248 6.29254 9.1545C6.23943 9.17651 6.1825 9.18784 6.125 9.18784C6.06751 9.18784 6.01058 9.17651 5.95747 9.1545C5.90435 9.13248 5.8561 9.10021 5.81547 9.05953L4.50297 7.74703C4.42088 7.66494 4.37476 7.5536 4.37476 7.4375C4.37476 7.3214 4.42088 7.21006 4.50297 7.12797C4.58506 7.04588 4.69641 6.99976 4.8125 6.99976C4.9286 6.99976 5.03994 7.04588 5.12203 7.12797L6.125 8.13148L8.87797 5.37797C8.91862 5.33732 8.96688 5.30508 9.01999 5.28308C9.07309 5.26108 9.13002 5.24976 9.1875 5.24976C9.24499 5.24976 9.30191 5.26108 9.35502 5.28308C9.40813 5.30508 9.45639 5.33732 9.49703 5.37797C9.53768 5.41862 9.56993 5.46687 9.59192 5.51998C9.61392 5.57309 9.62525 5.63001 9.62525 5.6875C9.62525 5.74499 9.61392 5.80191 9.59192 5.85502C9.56993 5.90813 9.53768 5.95638 9.49703 5.99703Z" fill="currentColor"/></svg>`;
const ICON_TAG_DRAFT = `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1.3125C5.87512 1.3125 4.7755 1.64607 3.8402 2.27102C2.90489 2.89597 2.17591 3.78423 1.74544 4.82349C1.31496 5.86274 1.20233 7.00631 1.42179 8.10958C1.64124 9.21284 2.18292 10.2263 2.97833 11.0217C3.77374 11.8171 4.78716 12.3588 5.89043 12.5782C6.99369 12.7977 8.13726 12.685 9.17651 12.2546C10.2158 11.8241 11.104 11.0951 11.729 10.1598C12.3539 9.2245 12.6875 8.12488 12.6875 7C12.6859 5.49207 12.0862 4.04636 11.0199 2.98009C9.95365 1.91382 8.50793 1.31409 7 1.3125ZM2.87953 4.51545C3.08239 4.18 3.54188 4.16094 3.81907 4.43813C4.05748 4.67654 4.07388 5.05264 3.91407 5.34952C3.8045 5.55307 3.71547 5.76705 3.6483 5.98826C3.55069 6.30975 3.27381 6.5625 2.93783 6.5625C2.54573 6.5625 2.23438 6.2238 2.32862 5.84319C2.44443 5.37544 2.63018 4.92778 2.87953 4.51545ZM2.32899 8.15829C2.23443 7.77691 2.54643 7.4375 2.93935 7.4375C3.27602 7.4375 3.55347 7.69079 3.65139 8.01291C3.71834 8.23312 3.80696 8.44616 3.91594 8.64888C4.07603 8.94665 4.05931 9.32384 3.8199 9.56255C3.54213 9.83951 3.08246 9.82012 2.87948 9.48446C2.63041 9.07259 2.44481 8.62546 2.32899 8.15829ZM6.5625 11.0614C6.5625 11.454 6.22351 11.7658 5.84243 11.6715C5.37542 11.5561 4.92841 11.3709 4.51656 11.1223C4.18055 10.9194 4.16132 10.4594 4.43884 10.1819C4.67699 9.94371 5.05252 9.92689 5.34942 10.0859C5.55241 10.1946 5.76569 10.2829 5.9861 10.3495C6.30866 10.447 6.5625 10.7245 6.5625 11.0614ZM6.5625 2.93993C6.5625 3.27627 6.30947 3.55345 5.98765 3.65122C5.76718 3.7182 5.55389 3.80691 5.35096 3.91603C5.05329 4.07609 4.67622 4.05937 4.4376 3.82004C4.16061 3.54225 4.18015 3.08251 4.51596 2.87973C4.92806 2.63089 5.37537 2.44556 5.84269 2.33004C6.22363 2.23587 6.5625 2.54752 6.5625 2.93993ZM11.6711 5.8421C11.7656 6.22328 11.4538 6.5625 11.0611 6.5625C10.7243 6.5625 10.4468 6.30891 10.3492 5.98656C10.2824 5.76601 10.1939 5.55263 10.0849 5.34957C9.92562 5.0526 9.94228 4.67679 10.1806 4.43849C10.458 4.1611 10.9178 4.18018 11.1207 4.51588C11.3698 4.92777 11.5553 5.37491 11.6711 5.8421ZM7.4375 2.93768C7.4375 2.5456 7.77609 2.23421 8.15673 2.32825C8.62428 2.44377 9.0718 2.62916 9.48408 2.87811C9.81981 3.08084 9.83922 3.5405 9.56214 3.81807C9.32363 4.057 8.947 4.07359 8.64969 3.91365C8.44642 3.80429 8.23276 3.71542 8.01189 3.64834C7.69032 3.5507 7.4375 3.27374 7.4375 2.93768ZM8.1579 11.6711C7.77673 11.7656 7.4375 11.4538 7.4375 11.0611C7.4375 10.7243 7.6911 10.4468 8.01344 10.3492C8.23399 10.2824 8.44738 10.1939 8.65044 10.0849C8.9474 9.92561 9.32322 9.94228 9.56151 10.1806C9.8389 10.458 9.81982 10.9178 9.48413 11.1207C9.07223 11.3698 8.62509 11.5553 8.1579 11.6711ZM11.1207 9.48413C10.9178 9.81982 10.458 9.8389 10.1806 9.56151C9.94228 9.32322 9.92562 8.9474 10.0849 8.65044C10.1939 8.44738 10.2824 8.23399 10.3492 8.01344C10.4468 7.69109 10.7243 7.4375 11.0611 7.4375C11.4538 7.4375 11.7656 7.77673 11.6711 8.1579C11.5553 8.62509 11.3698 9.07223 11.1207 9.48413Z" fill="currentColor"/></svg>`;

function renderRecords(filter='') {
  const el=document.getElementById('records-list');
  const q=filter.toLowerCase();
  const filtered=records.filter(r=>formatDate(r.date).includes(q));
  if(!filtered.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">${records.length?'No results':'No records yet'}</div><div class="empty-sub">Take your first attendance to see records here.</div></div>`;
    return;
  }
  el.innerHTML=filtered.map(r=>`
    <div class="record-row" onclick="viewRecord('${r.id}')">
      <span class="record-date-text">${formatDate(r.date)}</span>
      <div style="display:flex;align-items:center;gap:10px">
        ${r.status==='draft'
          ?`<span class="tag tag-draft">${ICON_TAG_DRAFT}Draft</span>`
          :`<span class="tag tag-saved">${ICON_TAG_SAVED}Saved</span>`}
        <span class="record-chevron"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></span>
      </div>
    </div>`).join('');
}
function onRecordsScroll(el) {
  const top = document.getElementById('records-sticky-top');
  if(top) top.classList.toggle('scrolled', el.scrollTop > 0);
}

async function viewRecord(id) {
  setLoading('Loading...');
  viewingRecordId = id;
  const rec=records.find(r=>r.id===id); if(!rec)return;
  const {data:rows}=await sb.from('attendance').select('*').eq('record_id',id).order('member_name');
  _pastMs=(rows||[]).map(a=>({id:a.member_id,name:a.member_name,status:a.status}));
  if(rec.status==='draft') currentAtt={id:rec.id,date:rec.date,status:'draft',members:_pastMs.map(m=>({...m}))};
  document.getElementById('past-record-title').textContent = rec.status==='draft' ? 'Draft' : 'Past Record';
  const c=getCounts(_pastMs);
  document.getElementById('past-record-body').innerHTML=`
    <div style="display:flex;flex-direction:column;height:100%;min-height:0;">
      <!-- STICKY TOP -->
      <div id="past-sticky-top" style="padding:16px 16px 0;background:var(--bg);flex-shrink:0;">
        <div class="date-bar locked">

          <span class="date-bar-text">${formatDate(rec.date)}</span>

        </div>
        <div class="search-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="search-input" placeholder="Search contacts" oninput="filterPast(this.value)"/>
        </div>
        <div class="stat-tiles" style="margin-bottom:12px">
          <div class="stat-tile full unmarked ${c.unmarked===0?'inactive':''}" onclick="openPastFilter('')">
            <span class="stat-tile-label">Unmarked</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.unmarked}</span>${statChevron()}</span>
          </div>
          <div class="stat-tile ${c.P===0?'inactive':''}" onclick="openPastFilter('P')">
            <span class="stat-tile-label">Present</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.P}</span>${statChevron()}</span>
          </div>
          <div class="stat-tile ${c.A===0?'inactive':''}" onclick="openPastFilter('A')">
            <span class="stat-tile-label">Absent</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.A}</span>${statChevron()}</span>
          </div>
          <div class="stat-tile ${c.L===0?'inactive':''}" onclick="openPastFilter('L')">
            <span class="stat-tile-label">Late</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.L}</span>${statChevron()}</span>
          </div>
          <div class="stat-tile ${c.S===0?'inactive':''}" onclick="openPastFilter('S')">
            <span class="stat-tile-label">Substitute</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.S}</span>${statChevron()}</span>
          </div>
        </div>
        <div class="att-table-header"><span class="att-th att-th-sr">Sr.</span><span class="att-th att-th-name">Name</span><span class="att-th att-th-status">Status</span></div>
      </div>
      <!-- SCROLLABLE LIST -->
      <div style="flex:1;overflow-y:auto;padding:0 16px 16px;-webkit-overflow-scrolling:touch;" onscroll="onPastScroll(this)">
        <div id="past-list"></div>
      </div>
    </div>`;
  _show('screen-past-record');
  renderPastList();
  _editMode = false;
  document.getElementById('draft-resume-bar').style.display=rec.status==='draft'?'flex':'none';
  document.getElementById('pdf-download-bar').style.display=rec.status==='saved'?'flex':'none';
  document.getElementById('edit-mode-bar').style.display='none';
  document.getElementById('delete-record-btn').style.display=rec.status==='saved'?'flex':'none';
  // Hide edit button if record was already edited once
  const editBtn = document.getElementById('edit-record-btn');
  if(editBtn) editBtn.style.display = rec.is_edited ? 'none' : '';
  pushHistory('screen-past-record');
}

function deleteRecord() {
  if(!viewingRecordId) return;
  showConfirm('Delete Record', 'Are you sure you want to delete this attendance record? This cannot be undone.', 'Delete', function(){ confirmDeleteRecord(); }, {okIcon: ICON_TRASH});
}

async function confirmDeleteRecord() {
  const id = viewingRecordId;
  await sb.from('attendance').delete().eq('record_id', id);
  await sb.from('records').delete().eq('id', id);
  viewingRecordId = null;
  _recordsCached = false;
  closeModal();
  await goRecords();
  showToast('Record deleted');
}

async function downloadPDF() {
  const rec = records.find(r=>r.id===viewingRecordId);
  if(!rec) return;
  const ms = _pastMs;
  const date = formatDate(rec.date);
  const [d,mo,y] = date.split('/');
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayName = dayNames[new Date(`20${y}-${mo}-${d}`).getDay()];
  const counts = getCounts(ms);
  const filename = `Markd-Attendance-${date.replace(/\//g,'-')}.pdf`;

  // ── Pill images embedded as base64 — pixel-perfect, no rendering issues
  const PILL_IMGS = {
    'P': 'data:image/png;base64,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',
    'A': 'data:image/png;base64,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',
    'L': 'data:image/png;base64,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',
    'S': 'data:image/png;base64,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'
  };
  const palsPill = (status) => {
    const src = PILL_IMGS[status] || PILL_IMGS['P'];
    return `<img src="${src}" width="112" height="28" style="flex-shrink:0;display:block;image-rendering:auto;" />`;
  };

  // ── Row builder
  const buildRows = (arr, startIdx) => arr.map((m,i) => `
    <div style="display:flex;align-items:center;height:42px;border-bottom:1px solid #F5F5F5;gap:6px;">
      <span style="width:22px;font-size:11px;color:#B3B3B3;font-weight:500;flex-shrink:0;">${startIdx+i+1}</span>
      <span style="flex:1;font-size:12px;color:#252525;font-weight:500;padding-left:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.name}</span>
      ${palsPill(m.status)}
    </div>`).join('');

  // ── Column header
  const colHeader = `<div style="display:flex;align-items:center;padding:7px 0;border-top:1px solid #E8E8E8;border-bottom:1px solid #E8E8E8;margin-bottom:0;">
    <span style="width:22px;flex-shrink:0;font-size:11px;font-weight:600;color:#767676;font-family:Arial,sans-serif;">Sr.</span>
    <span style="flex:1;padding-left:6px;font-size:11px;font-weight:600;color:#767676;font-family:Arial,sans-serif;">Name</span>
    <span style="width:112px;font-size:11px;font-weight:600;color:#767676;font-family:Arial,sans-serif;">Status</span>
  </div>`;

  // ── Stat cards
  const statCards = `<div style="display:flex;gap:8px;margin-bottom:18px;">
    <div style="flex:1;background:#F7F7F7;border-radius:7px;padding:9px 10px;border:1px solid #E9E9E9;">
      <div style="font-size:16px;font-weight:700;color:#025A28;line-height:1;margin-bottom:3px;">${counts.P}</div>
      <div style="font-size:8px;color:#787575;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;font-family:Arial,sans-serif;">Present</div>
    </div>
    <div style="flex:1;background:#F7F7F7;border-radius:7px;padding:9px 10px;border:1px solid #E9E9E9;">
      <div style="font-size:16px;font-weight:700;color:#6E2001;line-height:1;margin-bottom:3px;">${counts.A}</div>
      <div style="font-size:8px;color:#787575;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;font-family:Arial,sans-serif;">Absent</div>
    </div>
    <div style="flex:1;background:#F7F7F7;border-radius:7px;padding:9px 10px;border:1px solid #E9E9E9;">
      <div style="font-size:16px;font-weight:700;color:#023379;line-height:1;margin-bottom:3px;">${counts.L}</div>
      <div style="font-size:8px;color:#787575;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;font-family:Arial,sans-serif;">Late</div>
    </div>
    <div style="flex:1;background:#F7F7F7;border-radius:7px;padding:9px 10px;border:1px solid #E9E9E9;">
      <div style="font-size:16px;font-weight:700;color:#765901;line-height:1;margin-bottom:3px;">${counts.S}</div>
      <div style="font-size:8px;color:#787575;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;font-family:Arial,sans-serif;">Substitute</div>
    </div>
    <div style="flex:1;background:#F7F7F7;border-radius:7px;padding:9px 10px;border:1px solid #E9E9E9;">
      <div style="font-size:16px;font-weight:700;color:#212325;line-height:1;margin-bottom:3px;">${ms.length}</div>
      <div style="font-size:8px;color:#787575;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;font-family:Arial,sans-serif;">Total</div>
    </div>
  </div>`;

  const ROWS_PER_PAGE = 40;
  const totalPages = Math.ceil(ms.length / ROWS_PER_PAGE);

  const buildPage = (pageMs, pageNum, pageOffset) => {
    const half = Math.ceil(pageMs.length / 2);
    const leftMs = pageMs.slice(0, half);
    const rightMs = pageMs.slice(half);
    const isFirst = pageNum === 1;
    const header = isFirst
      ? `<div style="padding-bottom:16px;border-bottom:1px solid #E7E7E8;margin-bottom:18px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#B3B3B3;margin-bottom:5px;font-family:Arial,sans-serif;">Markd</div>
          <div style="font-size:22px;font-weight:700;color:#212325;letter-spacing:0.02em;font-family:Arial,sans-serif;">Attendance Record</div>
          <div style="font-size:12px;color:#606264;margin-top:4px;font-weight:500;font-family:Arial,sans-serif;">${dayName}, ${date.replace(/\//g,' / ')}</div>
        </div>${statCards}`
      : `<div style="padding-bottom:12px;border-bottom:1px solid #E7E7E8;margin-bottom:16px;display:flex;justify-content:space-between;align-items:baseline;">
          <div style="font-size:13px;font-weight:700;color:#212325;font-family:Arial,sans-serif;">Attendance Record <span style="font-size:11px;color:#B3B3B3;font-weight:400;">continued</span></div>
          <div style="font-size:11px;color:#B3B3B3;font-family:Arial,sans-serif;">${dayName}, ${date.replace(/\//g,' / ')}</div>
        </div>`;
    return `<div style="padding:44px 44px 36px;width:794px;height:1123px;box-sizing:border-box;background:#fff;overflow:hidden;position:relative;">
      ${header}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;">
        <div>${colHeader}${buildRows(leftMs, pageOffset)}</div>
        <div>${colHeader}${buildRows(rightMs, pageOffset + half)}</div>
      </div>
      <div style="position:absolute;bottom:36px;left:44px;right:44px;padding-top:10px;border-top:1px solid #E7E7E8;display:flex;justify-content:space-between;font-size:8px;color:#B3B3B3;font-weight:500;letter-spacing:0.04em;font-family:Arial,sans-serif;">
        <span>Markd &bull; Attendance Record &bull; ${date}</span>
        <span>Page ${pageNum} of ${totalPages}</span>
      </div>
    </div>`;
  };

  showToast('Generating PDF...');

  const renderPage = (pageHtml) => new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:794px;height:1123px;border:none;';
    document.body.appendChild(iframe);
    const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;background:#fff;width:794px;height:1123px;overflow:hidden;position:relative;}</style>
</head><body>${pageHtml}</body></html>`;
    iframe.contentDocument.open();
    iframe.contentDocument.write(doc);
    iframe.contentDocument.close();
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(iframe.contentDocument.body, {
          scale:2, useCORS:true, backgroundColor:'#ffffff',
          width:794, height:1123, windowWidth:794, windowHeight:1123
        });
        document.body.removeChild(iframe);
        resolve(canvas);
      } catch(e) { document.body.removeChild(iframe); reject(e); }
    }, 700);
  });

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    for (let p = 0; p < totalPages; p++) {
      const pageMs = ms.slice(p * ROWS_PER_PAGE, (p+1) * ROWS_PER_PAGE);
      const canvas = await renderPage(buildPage(pageMs, p+1, p * ROWS_PER_PAGE));
      if (p > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW, pdfH);
    }

    const pdfFile = new File([pdf.output('blob')], filename, { type:'application/pdf' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files:[pdfFile] })) {
      await navigator.share({ title:`Markd Attendance - ${date}`, text:`Markd Attendance Record - ${dayName}, ${date}`, files:[pdfFile] });
      showToast('Shared successfully ✓');
    } else {
      const url = URL.createObjectURL(pdfFile);
      const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
      URL.revokeObjectURL(url);
      showToast('PDF downloaded ✓');
    }
  } catch(e) {
    console.error('PDF error:', e);
    showToast('Error generating PDF');
  }
}

function enterEditMode() {
  showConfirm(
    'Edit Saved Record',
    'Are you sure you want to edit this attendance record?',
    'Yes, Edit',
    function() {
      closeModal();
      _editMode = true;
      _editOriginalMs = JSON.parse(JSON.stringify(_pastMs)); // snapshot
      // Swap bars
      document.getElementById('pdf-download-bar').style.display='none';
      document.getElementById('edit-mode-bar').style.display='flex';
      document.getElementById('delete-record-btn').style.display='none';
      // Re-render with editable PALS buttons
      renderPastList();
    }
  );
}

function cancelEditMode() {
  // Revert all changes to original snapshot
  _pastMs = JSON.parse(JSON.stringify(_editOriginalMs));
  _editMode = false;
  _editOriginalMs = null;
  // Swap bars back
  const rec = records.find(r=>r.id===viewingRecordId);
  document.getElementById('pdf-download-bar').style.display='flex';
  document.getElementById('edit-mode-bar').style.display='none';
  document.getElementById('delete-record-btn').style.display=rec&&rec.status==='saved'?'flex':'none';
  renderPastStats();
  renderPastList();
}

function editStatusTap(idx, newStatus) {
  const m = _pastMs[idx];
  if(!m) return;
  if(m.status === newStatus) {
    // Toggle off — confirm removal
    showConfirm(
      'Remove Status',
      `Remove ${newStatus === 'P' ? 'Present' : newStatus === 'A' ? 'Absent' : newStatus === 'L' ? 'Late' : 'Substitute'} status from <strong>${m.name}</strong>?`,
      'Yes, Remove',
      function() { _pastMs[idx].status=''; closeModal(); renderPastStats(); renderPastList(); }
    );
  } else {
    const statusLabel = {'P':'Present','A':'Absent','L':'Late','S':'Substitute'};
    showConfirm(
      'Change Status',
      `Are you sure you want to change <strong>${m.name}</strong>'s status to <strong>${statusLabel[newStatus]}</strong>?`,
      'Yes, Edit',
      function() { _pastMs[idx].status=newStatus; closeModal(); renderPastStats(); renderPastList(); }
    );
  }
}

async function saveEditedRecord() {
  setLoading('Saving changes...');
  const id = viewingRecordId;
  // Delete old attendance rows and re-insert with updated statuses
  await sb.from('attendance').delete().eq('record_id', id);
  await sb.from('attendance').insert(_pastMs.map(m=>({
    record_id: id,
    member_id: m.id,
    member_name: m.name,
    status: m.status
  })));
  // Mark record as edited so edit button disappears
  await sb.from('records').update({is_edited: true}).eq('id', id);
  // Update local records cache
  const rec = records.find(r=>r.id===id);
  if(rec) rec.is_edited = true;
  _recordsCached = true;
  _editMode = false;
  _editOriginalMs = null;
  // Go back to past record view
  _show('screen-past-record');
  document.getElementById('pdf-download-bar').style.display='flex';
  document.getElementById('edit-mode-bar').style.display='none';
  document.getElementById('delete-record-btn').style.display='flex';
  // Hide edit button permanently
  const editBtn = document.getElementById('edit-record-btn');
  if(editBtn) editBtn.style.display='none';
  // Update stats display
  renderPastStats();
  renderPastList();
  showToast('Changes saved ✓');
}

function renderPastList(filter='') {
  const q = (filter||'').toLowerCase();
  const el = document.getElementById('past-list');
  if(!el) return;
  el.innerHTML = _pastMs.filter(m=>m.name.toLowerCase().includes(q)).map((m,i)=>{
    const ri = _pastMs.indexOf(m);
    if(_editMode) {
      return `<div class="att-row">
        <span class="att-sr">${ri+1}</span>
        <span class="att-name">${m.name}</span>
        <div class="pals">${['P','A','L','S'].map(s=>`<button class="pals-btn${m.status===s?' active-'+s:''}" onclick="editStatusTap(${ri},'${s}')">${s}</button>`).join('')}</div>
      </div>`;
    } else {
      return `<div class="att-row">
        <span class="att-sr">${ri+1}</span>
        <span class="att-name">${m.name}</span>
        <div class="pals">${['P','A','L','S'].map(s=>`<button class="pals-btn${m.status===s?' active-'+s:''} readonly" disabled>${s}</button>`).join('')}</div>
      </div>`;
    }
  }).join('');
}

function renderPastStats() {
  const c = getCounts(_pastMs);
  // Update the stat tiles in place without rebuilding the whole screen
  const tiles = document.querySelector('#past-record-body .stat-tiles');
  if(!tiles) return;
  tiles.innerHTML = `
    <div class="stat-tile full unmarked ${c.unmarked===0?'inactive':''}" onclick="openPastFilter('')">
      <span class="stat-tile-label">Unmarked</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.unmarked}</span>${statChevron()}</span>
    </div>
    <div class="stat-tile ${c.P===0?'inactive':''}" onclick="openPastFilter('P')">
      <span class="stat-tile-label">Present</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.P}</span>${statChevron()}</span>
    </div>
    <div class="stat-tile ${c.A===0?'inactive':''}" onclick="openPastFilter('A')">
      <span class="stat-tile-label">Absent</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.A}</span>${statChevron()}</span>
    </div>
    <div class="stat-tile ${c.L===0?'inactive':''}" onclick="openPastFilter('L')">
      <span class="stat-tile-label">Late</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.L}</span>${statChevron()}</span>
    </div>
    <div class="stat-tile ${c.S===0?'inactive':''}" onclick="openPastFilter('S')">
      <span class="stat-tile-label">Substitute</span><span style="display:flex;align-items:center;gap:8px"><span class="stat-tile-count">${c.S}</span>${statChevron()}</span>
    </div>`;
}

function pastRows(ms, filter='') {
  const q=filter.toLowerCase();
  return ms.filter(m=>m.name.toLowerCase().includes(q)).map((m,i)=>`
    <div class="att-row">
      <span class="att-sr">${ms.indexOf(m)+1}</span>
      <span class="att-name">${esc(m.name)}</span>
      <div class="pals">${['P','A','L','S'].map(s=>`<button class="pals-btn${m.status===s?' active-'+s:''} readonly" disabled>${s}</button>`).join('')}</div>
    </div>`).join('');
}
function filterPast(q) { renderPastList(q); }
function openPastFilter(sf) {
  const labels={'':'Unmarked Members','P':'Present Members','A':'Absent Members','L':'Late Members','S':'Substitute Members'};
  const target=sf===''?_pastMs.filter(m=>m.status===''):_pastMs.filter(m=>m.status===sf);
  if(!target.length)return;
  const rows=target.map((m,i)=>{
    const ri=_pastMs.indexOf(m);
    if(_editMode){
      return `<div class="filter-member-row">
        <span class="filter-sr">${i+1}</span><span class="filter-name">${esc(m.name)}</span>
        <div class="filter-pals">${['P','A','L','S'].map(s=>`<button class="pals-btn${m.status===s?' active-'+s:''}" onclick="editStatusFromFilter(${ri},'${s}')">${s}</button>`).join('')}</div>
      </div>`;
    } else {
      return `<div class="filter-member-row">
        <span class="filter-sr">${i+1}</span><span class="filter-name">${esc(m.name)}</span>
        <div class="filter-pals">${['P','A','L','S'].map(s=>`<button class="pals-btn${m.status===s?' active-'+s:''} readonly" disabled>${s}</button>`).join('')}</div>
      </div>`;
    }
  }).join('');
  showModal(`<div class="modal-sheet">
    <div class="modal-sheet-header" id="filter-sticky-top">
      <div class="filter-drawer-header"><div class="filter-drawer-spacer"></div><div class="filter-drawer-title">${labels[sf]}</div><button class="filter-drawer-close" onclick="closeModal()">${xIcon()}</button></div>
      <div class="att-table-header"><span class="att-th att-th-sr">Sr.</span><span class="att-th att-th-name">Name</span><span class="att-th att-th-status">Status</span></div>
    </div>
    <div class="modal-sheet-body filter-modal-body" onscroll="onFilterScroll(this)">${rows}</div>
  </div>`);
}

function editStatusFromFilter(ri, newStatus) {
  closeModal();
  setTimeout(() => editStatusTap(ri, newStatus), 150);
}

/* ─── ANDROID BACK BUTTON ──────────────────── */
// Push a state whenever we navigate to a screen so back button can be intercepted
function pushHistory(screenId) {
  history.pushState({ screen: screenId }, '', '');
}

window.addEventListener('popstate', function(e) {
  const currentScreen = document.querySelector('.screen.active')?.id;

  if (currentScreen === 'screen-home') {
    // On home screen — let the phone go to its own home screen
    // Don't push state, just let it propagate naturally
    return;
  }

  if (currentScreen === 'screen-records') {
    // Go back to app home
    goHome();
    pushHistory('screen-home');
    return;
  }

  if (currentScreen === 'screen-past-record') {
    // Go back to records
    goRecords();
    pushHistory('screen-records');
    return;
  }

  if (currentScreen === 'screen-attendance') {
    // Trigger the same logic as the in-app back button
    backFromAttendance();
    // Re-push state so back button keeps working if they stay on the screen
    pushHistory('screen-attendance');
    return;
  }

  if (currentScreen === 'screen-loading' || currentScreen === 'screen-login') {
    return;
  }
});

// Override goHome, goRecords, _show for attendance to push history states
const _origGoHome = goHome;
goHome = function() {
  _origGoHome();
  pushHistory('screen-home');
};

const _origGoRecords = goRecords;
goRecords = async function() {
  await _origGoRecords();
  pushHistory('screen-records');
};

/* ─── BUTTON PRESS FEEDBACK ────────────────────
   Native :active reverts the instant a tap/click
   releases, which on a fast tap can be too brief to
   register (NN/g recommends pressed feedback stay
   visible ~100-150ms). This holds the same :active
   visual open for a guaranteed minimum via a class,
   without delaying the button's actual click action. */
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.action-btn');
  if(!btn || btn.disabled) return;
  btn.classList.add('is-pressed');
  clearTimeout(btn._pressTimer);
  btn._pressTimer = setTimeout(() => btn.classList.remove('is-pressed'), 150);
});

/* ─── BOOT ─────────────────────────────────── */
(async () => {
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if(error) { console.error('Session error:', error); return; }
    if(session) {
      await initApp();
    } else {
      _show('screen-login');
    }
  } catch(e) {
    console.error('Boot error:', e);
    _show('screen-login');
  }
})();

if('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
