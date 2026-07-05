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
const xIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:18px;height:18px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;

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
let _pendingConfirmOk = null;
function showConfirm(title, msg, okLabel, onOk, cancelLabel='Cancel') {
  _pendingConfirmOk = onOk;
  showModal(`<div class="modal-card">
    <div class="confirm-title">${title}</div>
    <div class="confirm-msg">${msg}</div>
    <div class="modal-btns">
      <button class="btn" onclick="closeModal()">${cancelLabel}</button>
      <button class="btn btn-primary" onclick="_confirmOk()"> ${okLabel}</button>
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
  showConfirm('Sign out','Are you sure you want to sign out?','Sign out', async function(){
    await sb.auth.signOut();
    members=[]; records=[]; currentAtt=null;
    closeModal();
    _show('screen-login');
    document.getElementById('login-pass').value='';
    document.getElementById('login-btn').disabled=false;
    document.getElementById('login-btn').textContent='Sign In';
  });
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
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">${members.length?'No results':'No members yet'}</div><div class="empty-sub">${members.length?'Try a different search.':'Tap "+ Add member" above.'}</div></div>`;
    return;
  }
  el.innerHTML = filtered.map((m)=>`
    <div class="member-row">
      <span class="sr-num">${members.indexOf(m)+1}</span>
      <span class="member-name-text">${esc(m.first_name)} ${esc(m.last_name)}</span>
      <button class="icon-btn" onclick="openEditMember('${m.id}')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
      </button>
      <button class="icon-btn danger" onclick="deleteMember('${m.id}')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>
      </button>
    </div>`).join('');
}

function openAddMember() {
  showModal(`<div class="modal-sheet">
    <div style="padding:20px">
      <div class="modal-title">Add Member</div>
      <div style="margin-top:14px">
        <div class="form-field"><label class="form-label">First Name</label>
          <input class="form-input" id="add-fn" placeholder="e.g. Abhishek" onkeydown="if(event.key==='Enter')document.getElementById('add-ln').focus()"/>
        </div>
        <div class="form-field"><label class="form-label">Last Name</label>
          <input class="form-input" id="add-ln" placeholder="e.g. Jhawar" onkeydown="if(event.key==='Enter')confirmAdd()"/>
        </div>
      </div>
      <div class="modal-btns"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="confirmAdd()">Add</button></div>
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
    <div style="padding:20px">
      <div class="modal-title">Edit Member</div>
      <div style="margin-top:14px">
        <div class="form-field"><label class="form-label">First Name</label>
          <input class="form-input" id="edit-fn" value="${esc(m.first_name)}" onkeydown="if(event.key==='Enter')document.getElementById('edit-ln').focus()"/>
        </div>
        <div class="form-field"><label class="form-label">Last Name</label>
          <input class="form-input" id="edit-ln" value="${esc(m.last_name)}" onkeydown="if(event.key==='Enter')confirmEdit('${id}')"/>
        </div>
      </div>
      <div class="modal-btns"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="confirmEdit('${id}')">Save</button></div>
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
  // Embed id directly into the button onclick as a data attribute
  showModal(`<div class="modal-card">
    <div class="confirm-title">Remove Member</div>
    <div class="confirm-msg">Remove <strong>${name}</strong>? They will be hidden from new sessions. Past records are preserved.</div>
    <div class="modal-btns">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="confirm-delete-btn" data-mid="${id}" onclick="confirmDeleteMember(this.dataset.mid)">Remove</button>
    </div>
  </div>`, true);
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
  if(unmarked === 0) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.style.background = '#111112';
    btn.style.color = '#fff';
  } else {
    btn.disabled = false; // keep enabled so they can still trigger save-as-draft flow
    btn.style.opacity = unmarked === currentAtt.members.length ? '0.4' : '0.7';
    btn.style.cursor = 'pointer';
    btn.style.background = '';
    btn.style.color = '';
  }
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
    <div class="modal-sheet-header">
      <div class="filter-modal-header"><div class="filter-modal-title">${labels[sf]}</div><button class="icon-btn" onclick="closeModal()">${xIcon()}</button></div>
      <div class="att-table-header"><span class="att-th att-th-sr">SR.</span><span class="att-th att-th-name">NAMES</span><span class="att-th att-th-status">STATUS</span></div>
    </div>
    <div class="modal-sheet-body">${rows}</div>
  </div>`);
}
function setStatusModal(ri,s){
  currentAtt.members[ri].status=currentAtt.members[ri].status===s?'':s;
  renderAttStats();
  renderAttMembers(document.getElementById('att-search').value);
  // Re-render the modal with updated statuses — don't close it
  const sf = document.querySelector('.filter-modal-title')?.textContent?.replace(' Members','') || '';
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
  showModal(`<div class="modal-card" style="position:relative">
    <button onclick="closeModal()" style="position:absolute;top:0;right:0;background:none;border:none;cursor:pointer;padding:4px;color:var(--text2)">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:20px;height:20px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
    <div class="confirm-title">Save as Draft?</div>
    <div class="confirm-msg" style="margin-top:8px">${marked} member(s) marked. Going back will save this as a Draft so you can resume later.</div>
    <div class="modal-btns" style="margin-top:20px">
      <button class="btn" style="display:flex;align-items:center;gap:6px;color:var(--red);border-color:var(--red)" onclick="discardAttendance()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>
        Discard this record
      </button>
      <button class="btn btn-primary" style="display:flex;align-items:center;gap:6px" onclick="saveDraftAndGoBack()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:15px;height:15px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        Save Draft and go back
      </button>
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
    showConfirm('Unmarked Members',`${unmarked} member(s) still unmarked. Save as Draft to finish later, or go back and mark everyone.`,'Save as Draft',async function(){
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
      <div style="display:flex;align-items:center;gap:8px">
        ${r.status==='draft'?`<span class="badge badge-draft">Draft</span>`:''}
        ${chevron()}
      </div>
    </div>`).join('');
}

async function viewRecord(id) {
  setLoading('Loading...');
  viewingRecordId = id;
  const rec=records.find(r=>r.id===id); if(!rec)return;
  const {data:rows}=await sb.from('attendance').select('*').eq('record_id',id).order('member_name');
  _pastMs=(rows||[]).map(a=>({id:a.member_id,name:a.member_name,status:a.status}));
  if(rec.status==='draft') currentAtt={id:rec.id,date:rec.date,status:'draft',members:_pastMs.map(m=>({...m}))};
  const c=getCounts(_pastMs);
  document.getElementById('past-record-body').innerHTML=`
    <div style="display:flex;flex-direction:column;height:100%;min-height:0;">
      <!-- STICKY TOP -->
      <div style="padding:16px 16px 0;background:var(--bg);flex-shrink:0;">
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
        <div class="section-label">All Members</div>
        <div class="att-table-header"><span class="att-th att-th-sr">SR.</span><span class="att-th att-th-name">NAMES</span><span class="att-th att-th-status">STATUS</span></div>
      </div>
      <!-- SCROLLABLE LIST -->
      <div style="flex:1;overflow-y:auto;padding:0 16px 16px;-webkit-overflow-scrolling:touch;">
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
  showModal(`<div class="modal-card">
    <div class="confirm-title">Delete Record</div>
    <div class="confirm-msg">Are you sure you want to permanently delete this attendance record? This cannot be undone.</div>
    <div class="modal-btns">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn" style="background:var(--red);color:#fff;border-color:var(--red)" onclick="confirmDeleteRecord()">Delete</button>
    </div>
  </div>`, true);
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
  const statusLabel = {'P':'Present','A':'Absent','L':'Late','S':'Substitute','':'Unmarked'};
  const statusColor = {'P':'#16a34a','A':'#dc2626','L':'#7c3aed','S':'#d97706','':'#9ca3af'};
  const filename = `BNI-Attendance-${date.replace(/\//g,'-')}.pdf`;

  // Split into two columns
  const half = Math.ceil(ms.length / 2);
  const leftMs = ms.slice(0, half);
  const rightMs = ms.slice(half);

  const buildRows = (arr, startIdx) => arr.map((m,i) => `
    <tr>
      <td style="padding:4px 6px;border-bottom:1px solid #f4f4f6;color:#9ca3af;font-size:10px;width:22px">${startIdx+i+1}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #f4f4f6;font-size:11px;color:#111112">${m.name}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #f4f4f6;text-align:center;width:62px">
        <span style="display:inline-block;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:600;background:${statusColor[m.status]}22;color:${statusColor[m.status]}">${statusLabel[m.status]||'Unmarked'}</span>
      </td>
    </tr>`).join('');

  const tableHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="font-size:8px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;padding:5px 6px;border-bottom:1.5px solid #e4e4e9;text-align:left">SR.</th>
        <th style="font-size:8px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;padding:5px 6px;border-bottom:1.5px solid #e4e4e9;text-align:left">Name</th>
        <th style="font-size:8px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;padding:5px 6px;border-bottom:1.5px solid #e4e4e9;text-align:center">Status</th>
      </tr></thead>
      <tbody>${buildRows(leftMs,0)}</tbody>
    </table>`;

  const tableHTMLRight = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="font-size:8px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;padding:5px 6px;border-bottom:1.5px solid #e4e4e9;text-align:left">SR.</th>
        <th style="font-size:8px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;padding:5px 6px;border-bottom:1.5px solid #e4e4e9;text-align:left">Name</th>
        <th style="font-size:8px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;padding:5px 6px;border-bottom:1.5px solid #e4e4e9;text-align:center">Status</th>
      </tr></thead>
      <tbody>${buildRows(rightMs,half)}</tbody>
    </table>`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;background:#fff;width:794px;padding:40px 40px 32px;}
.header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:14px;border-bottom:1.5px solid #111112;margin-bottom:14px;}
.chapter{font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:3px;}
.title{font-size:20px;font-weight:700;color:#111112;line-height:1.1;}
.date{font-size:11px;color:#6b7280;margin-top:3px;}
.stats{display:flex;gap:8px;margin-bottom:14px;}
.stat{flex:1;background:#f7f7f8;border-radius:6px;padding:7px 8px;text-align:center;}
.stat-num{font-size:16px;font-weight:700;line-height:1;}
.stat-lbl{font-size:8px;color:#6b7280;margin-top:2px;text-transform:uppercase;letter-spacing:0.05em;}
.columns{display:grid;grid-template-columns:1fr 1fr;gap:0 20px;}
.footer{margin-top:14px;padding-top:10px;border-top:1px solid #e4e4e9;display:flex;justify-content:space-between;font-size:8px;color:#9ca3af;}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="chapter">BNI Edenite Chapter</div>
    <div class="title">Attendance Record</div>
    <div class="date">${dayName}, ${date.replace(/\//g,' / ')}</div>
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-num" style="color:#16a34a">${counts.P}</div><div class="stat-lbl">Present</div></div>
  <div class="stat"><div class="stat-num" style="color:#dc2626">${counts.A}</div><div class="stat-lbl">Absent</div></div>
  <div class="stat"><div class="stat-num" style="color:#7c3aed">${counts.L}</div><div class="stat-lbl">Late</div></div>
  <div class="stat"><div class="stat-num" style="color:#d97706">${counts.S}</div><div class="stat-lbl">Substitute</div></div>
  <div class="stat"><div class="stat-num">${ms.length}</div><div class="stat-lbl">Total</div></div>
</div>
<div class="columns">
  ${tableHTML}
  ${tableHTMLRight}
</div>
<div class="footer">
  <span>BNI Edenite Chapter &bull; Attendance Record</span>
  <span>Generated by BNI Attendance App &bull; ${date}</span>
</div>
</body>
</html>`;

  showToast('Generating PDF...');

  // Render HTML in hidden iframe, then capture with html2canvas -> jsPDF
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:794px;height:1123px;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(htmlContent);
  iframe.contentDocument.close();

  await new Promise(r => setTimeout(r, 800)); // wait for render

  try {
    const canvas = await html2canvas(iframe.contentDocument.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794
    });
    document.body.removeChild(iframe);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    const pdfBlob = pdf.output('blob');
    const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

    // Try native share sheet first (works on Android Chrome)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        title: `BNI Attendance - ${date}`,
        text: `BNI Edenite Chapter Attendance Record - ${dayName}, ${date}`,
        files: [pdfFile]
      });
      showToast('Shared successfully ✓');
    } else {
      // Fallback: direct download
      const url = URL.createObjectURL(pdfFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('PDF downloaded ✓');
    }
  } catch(e) {
    document.body.removeChild(iframe);
    console.error('PDF error:', e);
    showToast('Error generating PDF');
  }
}

function enterEditMode() {
  showConfirm(
    'Edit Saved Record',
    'You are about to edit a saved record. Changes will affect attendance statistics. Are you sure?',
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
      `Change <strong>${m.name}</strong>'s status to <strong>${statusLabel[newStatus]}</strong>?`,
      'Yes, Change',
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
    <div class="modal-sheet-header">
      <div class="filter-modal-header"><div class="filter-modal-title">${labels[sf]}</div><button class="icon-btn" onclick="closeModal()">${xIcon()}</button></div>
      <div class="att-table-header"><span class="att-th att-th-sr">SR.</span><span class="att-th att-th-name">NAMES</span><span class="att-th att-th-status">STATUS</span></div>
    </div>
    <div class="modal-sheet-body">${rows}</div>
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
