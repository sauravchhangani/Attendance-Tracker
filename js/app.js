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
function showModal(html, centered=false) {
  document.getElementById('modal-root').innerHTML =
    `<div class="modal-overlay${centered?' centered':''}" id="modal-overlay" onclick="if(event.target.id==='modal-overlay')closeModal()">${html}</div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML=''; }

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
  const [membersResult, recordsResult] = await Promise.all([
    sb.from('members').select('*').eq('is_active',true).order('first_name'),
    sb.from('records').select('*').order('date',{ascending:false})
  ]);
  if(membersResult.error){
    document.getElementById('loading-text').textContent = 'Error: ' + membersResult.error.message;
    return;
  }
  members = membersResult.data||[];
  records = recordsResult.data||[];
  _membersCached = true;
  _recordsCached = true;
  goHome();
}

/* ─── HOME ─────────────────────────────────── */
function renderHomeMembers(filter='') {
  const el = document.getElementById('home-members-list');
  const q = filter.toLowerCase();
  const filtered = members.filter(m=>`${m.first_name} ${m.last_name}`.toLowerCase().includes(q));
  if(!filtered.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">${members.length?'No results':'No members yet'}</div><div class="empty-sub">${members.length?'Try a different search.':'Tap "Add another member" above.'}</div></div>`;
    return;
  }
  el.innerHTML = filtered.map((m)=>`
    <div class="member-row">
      <div class="member-row-main">
        <span class="sr-num">${members.indexOf(m)+1}</span>
        <span class="member-name-text">${esc(m.first_name)} ${esc(m.last_name)}</span>
      </div>
      <button class="member-menu-btn" onclick="openMemberMenu('${m.id}', this)">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 9.74902C11.691 9.74902 12.251 10.309 12.251 11C12.251 11.691 11.691 12.251 11 12.251C10.309 12.251 9.74902 11.691 9.74902 11C9.74902 10.309 10.309 9.74902 11 9.74902Z" fill="#8B8E8D" stroke="#8B8E8D" stroke-width="0.44"/><path d="M15.332 9.6803C16.0231 9.6803 16.583 10.2402 16.583 10.9313C16.583 11.6223 16.0231 12.1823 15.332 12.1823C14.641 12.1823 14.0811 11.6223 14.0811 10.9313C14.0811 10.2402 14.641 9.6803 15.332 9.6803Z" fill="#8B8E8D" stroke="#8B8E8D" stroke-width="0.44"/><path d="M6.53125 9.6803C7.2223 9.6803 7.78223 10.2402 7.78223 10.9313C7.78223 11.6223 7.2223 12.1823 6.53125 12.1823C5.8402 12.1823 5.28027 11.6223 5.28027 10.9313C5.28027 10.2402 5.8402 9.6803 6.53125 9.6803Z" fill="#8B8E8D" stroke="#8B8E8D" stroke-width="0.44"/></svg>
      </button>
    </div>`).join('');
}

/* ── Member row popup menu (Edit / Delete) — a lightweight anchored
   popover, not a modal: no dimming, closes on outside tap. ── */
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
  const {data,error}=await sb.from('members').insert({first_name:fn,last_name:ln,is_active:true}).select().single();
  if(error){showToast('Error adding member');return;}
  members.push(data);
  members.sort((a,b)=>a.first_name.localeCompare(b.first_name));
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

function openAttFilter(sf) {
  const target=sf===''?currentAtt.members.filter(m=>m.status===''):currentAtt.members.filter(m=>m.status===sf);
  const labels={'':'Unmarked Members','P':'Present Members','A':'Absent Members','L':'Late Members','S':'Substitute Members'};
  if(!target.length)return;
  const rows=target.map((m,i)=>`<div class="filter-member-row">
    <span class="filter-sr">${i+1}</span><span class="filter-name">${esc(m.name)}</span>
    <div class="filter-pals">${['P','A','L','S'].map(s=>{
      const ri=currentAtt.members.indexOf(m);
      return `<button class="pals-btn${m.status===s?' active-'+s:''}" onclick="setStatusModal(${ri},'${s}')">${s}</button>`;
    }).join('')}</div>
  </div>`).join('');
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
  // Re-render the modal with updated statuses — don't close it
  const sf = document.querySelector('.filter-drawer-title')?.textContent?.replace(' Members','') || '';
  const sfMap = {'Present':'P','Absent':'A','Late':'L','Substitute':'S','Unmarked':''};
  const sfKey = sfMap[sf] !== undefined ? sfMap[sf] : null;
  if(sfKey !== null) openAttFilter(sfKey);
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

  // ── PALS pill as inline SVG — renders perfectly in html2canvas
  // including borders, gradients (inset glow simulation), and text
  const palsPill = (status) => {
    const W = 112, H = 28, R = 8, SW = 28; // pill width, height, radius, slot width
    const slots = ['P','A','L','S'];
    const colors = {
      P:{bg1:'#9DDBB8',bg2:'#83D1A2',border:'#59AB7C',text:'#025A28'},
      A:{bg1:'#F4A07A',bg2:'#F08A64',border:'#E0774E',text:'#6E2001'},
      L:{bg1:'#7BB8F7',bg2:'#61A1F3',border:'#2C73D8',text:'#023379'},
      S:{bg1:'#FDDE96',bg2:'#FBDA83',border:'#E1AA00',text:'#765901'}
    };
    const activeIdx = slots.indexOf(status);

    // Build gradient defs for each active color
    const defs = slots.map(s => {
      const c = colors[s];
      return `<linearGradient id="g${s}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${c.bg1}"/>
        <stop offset="100%" stop-color="${c.bg2}"/>
      </linearGradient>`;
    }).join('');

    // Pill background + outer border
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="flex-shrink:0;display:inline-block;vertical-align:middle;">
  <defs>${defs}</defs>
  <rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" rx="${R}" ry="${R}" fill="#F6F6F6" stroke="#E3E3E3" stroke-width="1"/>`;

    // Slots
    slots.forEach((s, i) => {
      const x = i * SW;
      const isActive = i === activeIdx;
      const isFirst = i === 0;
      const isLast = i === 3;
      const prevActive = i - 1 === activeIdx;
      const nextActive = i + 1 === activeIdx;

      if (isActive) {
        const c = colors[s];
        // Active button: full rounded rect with gradient fill + border
        const ax = isFirst ? 0 : x;
        const aw = isFirst ? SW + 1 : SW;
        svg += `<rect x="${ax + 0.75}" y="0.75" width="${aw - 1.5}" height="${H - 1.5}" rx="${R}" ry="${R}" fill="url(#g${s})" stroke="${c.border}" stroke-width="1.5"/>`;
        // Text
        svg += `<text x="${ax + aw/2}" y="${H/2 + 4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="${c.text}">${s}</text>`;
      } else {
        // Divider line — skip if adjacent to active
        const showDivider = !isLast && !isActive && !(nextActive) && !(i === activeIdx - 1);
        if (showDivider) {
          svg += `<line x1="${x + SW}" y1="5" x2="${x + SW}" y2="${H-5}" stroke="#E3E3E3" stroke-width="1"/>`;
        }
        // Inactive text
        svg += `<text x="${x + SW/2}" y="${H/2 + 4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="400" fill="#8B8E8D">${s}</text>`;
      }
    });

    svg += `</svg>`;
    return svg;
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

  // ── Stat cards (no Unmarked)
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
