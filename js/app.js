/* ─── SUPABASE ─────────────────────────────── */
const SUPA_URL = 'https://lcsscdpaffiorizgovfu.supabase.co';
const SUPA_KEY = 'sb_publishable_VQ8kWeHxvk2KseqO3_5wFw_EA3Xcl5M';
const sb = supabase.createClient(https://lcsscdpaffiorizgovfu.supabase.co, sb_publishable_VQ8kWeHxvk2KseqO3_5wFw_EA3Xcl5M);

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
  const fn=(document.getElementById('add-fn')?.va