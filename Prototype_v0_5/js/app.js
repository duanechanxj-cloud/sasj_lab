const APP = {
  bootstrap: null,
  role: sessionStorage.getItem('sasj-role') || null,
  page: 'dashboard',
  schedule: { week: 'Odd', day: 'Mon', lab: 'Both', view: 'day', classFilter: 'All' },
  bookingStatus: { search: '', status: 'All' },
  scrollToBookingStatus: false,
};

const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
const ROLE_LABELS = {
  teacher: 'Science Teacher',
  hod: 'Science HOD / SH',
  labtech: 'Lab Technician',
  admin: 'System Admin',
};

const NAV = [
  { id: 'dashboard', icon: '⌂', label: 'Dashboard', roles: ['teacher','hod','labtech','admin'] },
  { id: 'schedule', icon: '▦', label: 'Lab Schedule', roles: ['teacher','hod','labtech','admin'] },
  { id: 'request', icon: '+', label: 'Create Booking', roles: ['teacher','hod','labtech','admin'] },
  { id: 'inventory', icon: '□', label: 'Inventory', roles: ['teacher','hod','labtech','admin'] },
  { id: 'approvals', icon: '✓', label: 'Requests & Approvals', roles: ['labtech','admin','hod'] },
  { id: 'timetable', icon: '↻', label: 'Timetable Organizer', roles: ['hod','admin'] },
  { id: 'roster', icon: '♙', label: 'Science Teacher Roster', roles: ['hod','admin'] },
  { id: 'settings', icon: '⚙', label: 'Administration', roles: ['admin','hod'] },
];

const PAGE_META = {
  dashboard: ['Dashboard', 'At-a-glance lab operations'],
  schedule: ['Lab Schedule', 'View, confirm, amend and monitor lab bookings'],
  request: ['Create Booking', 'Create an additional lab booking or reserve a lab for a special event'],
  inventory: ['Inventory', 'Live stock, kits, missing components and photos'],
  approvals: ['Requests & Approvals', 'Review pending requests and resolve conflicts before approval'],
  timetable: ['Timetable Organizer', 'Import, optimise, review and publish timetable versions'],
  roster: ['Science Teacher Roster', 'Maintain teachers, emails and class links'],
  settings: ['Administration', 'Operational rules and system settings'],
};

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function esc(value=''){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function uid(prefix='id'){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function minutes(t){ const [h,m]=String(t).split(':').map(Number); return h*60+m; }
function endAfterHour(start){ const total=minutes(start)+60; return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`; }
function fmtTime(t){ const [h,m]=String(t).split(':').map(Number); const suffix=h>=12?'PM':'AM'; const hh=((h+11)%12)+1; return `${hh}:${String(m).padStart(2,'0')} ${suffix}`; }
function activityLabel(raw){
  const text=String(raw||'').trim(); if(!text) return '';
  const m=text.match(/(?:activity\s*)?(\d+(?:\.\d+)+)/i);
  return m ? `Activity ${m[1]}` : text.replace(/^activity\s*/i,'Activity ');
}
function roleCanEditInventory(){ return ['labtech','hod','admin'].includes(APP.role); }
function roleCanApprove(){ return ['labtech','hod','admin'].includes(APP.role); }
function roleCanDirectBook(){ return ['hod','admin','labtech'].includes(APP.role); }
function readLocal(key, fallback){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):clone(fallback); }catch{return clone(fallback);} }
function writeLocal(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function data(){ return APP.bootstrap; }
function teachers(){ return readLocal('sasj-v05-teachers', data().teachers); }
function inventory(){ return readLocal('sasj-v05-inventory', data().inventory); }
function requests(){ return readLocal('sasj-v05-requests', data().requests); }
function settings(){ return readLocal('sasj-v05-settings', data().settings); }
function sessionActions(){ return readLocal('sasj-v05-session-actions', {}); }
function teacherNamesForClass(className){ return teachers().filter(t=>(t.classes||[]).includes(className)).map(t=>t.name); }
function clearPrototypeData(){ ['sasj-v05-teachers','sasj-v05-inventory','sasj-v05-requests','sasj-v05-settings','sasj-v05-session-actions'].forEach(k=>localStorage.removeItem(k)); }
function sessionKey(a){ return [a.class_name,a.week,a.day,a.lab,a.start_time].join('|'); }
function crestUrl(){ return data()?.app?.crest_url || 'assets/sasj-crest-clean.webp'; }
function requestTypeLabel(type){ return ({additional:'Ad hoc booking',event:'Special event / workshop',amendment:'Amendment request'})[type] || type; }
function displayRequestStatus(r){ if(r.status==='Approved' && r.request_type!=='amendment') return 'Confirmed'; return r.status; }
function statusClass(status){
  const s=String(status||'').toLowerCase();
  if(['confirmed','approved','good'].includes(s)) return 'confirmed';
  if(['pre-assigned','preassigned'].includes(s)) return 'preassigned';
  if(['pending'].includes(s)) return 'pending';
  if(['rejected','cancelled','released','missing'].includes(s)) return 'rejected';
  return 'info';
}
function timeOptions(selected='07:30'){
  let html='';
  for(let t=7*60+30;t<=13*60;t+=30){
    const v=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
    html+=`<option value="${v}" ${v===selected?'selected':''}>${fmtTime(v)}–${fmtTime(endAfterHour(v))}</option>`;
  }
  return html;
}

function baselineAction(originalKey){ return sessionActions()[originalKey] || {}; }
function resolveBaseline(a){
  const originalKey=sessionKey(a); const action=baselineAction(originalKey);
  return {
    ...clone(a),
    source_kind:'baseline', source_id:originalKey, original_key:originalKey,
    week:action.week||a.week, day:action.day||a.day, lab:action.lab||a.lab,
    start_time:action.start_time||a.start_time, end_time:action.end_time||a.end_time,
    status:action.status||'Pre-assigned',
    teacher:action.teacher||teacherNamesForClass(a.class_name).join(' / '),
    activity:action.activity||'', sets:action.sets||'', apparatus:action.apparatus||'', remarks:action.remarks||'',
    booking_type:'Pre-assigned',
  };
}
function baselineEntries(includeInactive=false){
  const arr=data().baseline_schedule.allocations.map(resolveBaseline);
  return includeInactive?arr:arr.filter(e=>!['Cancelled','Released'].includes(e.status));
}
function requestEntry(r){
  return {
    ...clone(r), source_kind:'request', source_id:r.id,
    booking_type:requestTypeLabel(r.request_type),
    display_status:displayRequestStatus(r),
  };
}
function activeApprovedRequestEntries(){
  return requests().filter(r=>r.status==='Approved' && r.request_type!=='amendment').map(requestEntry);
}
function activeOfficialEntries(){ return [...baselineEntries(false), ...activeApprovedRequestEntries()]; }
function pendingRequestEntries(){ return requests().filter(r=>r.status==='Pending').map(requestEntry); }
function entryRef(entry){ return `${entry.source_kind}:${entry.source_id}`; }
function overlaps(a,b){
  return a.week===b.week && a.day===b.day && a.lab===b.lab && minutes(a.start_time)<minutes(b.end_time) && minutes(a.end_time)>minutes(b.start_time);
}
function excludedByOriginal(candidate, official){
  return candidate.request_type==='amendment' && candidate.original_kind===official.source_kind && candidate.original_id===official.source_id;
}
function findOfficialConflicts(candidate, excludeRef=''){
  return activeOfficialEntries().filter(e=>entryRef(e)!==excludeRef && !excludedByOriginal(candidate,e) && overlaps(candidate,e));
}
function conflictsForPending(r){ return findOfficialConflicts(r); }
function pendingWarningsForEntry(entry){ return pendingRequestEntries().filter(r=>!excludedByOriginal(r,entry) && overlaps(r,entry)); }
function officialConflictPairs(){
  const entries=activeOfficialEntries(); const pairs=[];
  for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) if(overlaps(entries[i],entries[j])) pairs.push([entries[i],entries[j]]);
  return pairs;
}
function turnaroundWarnings(){
  const warnings=[]; const entries=activeOfficialEntries();
  ['Odd','Even'].forEach(week=>DAYS.forEach(day=>['Lab 1','Lab 2'].forEach(lab=>{
    const list=entries.filter(e=>e.week===week&&e.day===day&&e.lab===lab).sort((a,b)=>minutes(a.start_time)-minutes(b.start_time));
    for(let i=0;i<list.length-1;i++) if(list[i].end_time===list[i+1].start_time){
      warnings.push({week,day,lab,time:list[i].end_time,first:list[i],second:list[i+1]});
    }
  })));
  return warnings;
}

async function init(){
  try{ const response=await fetch('data/bootstrap.json'); APP.bootstrap=await response.json(); }
  catch(err){ document.getElementById('app').innerHTML='<div style="padding:30px">Unable to load app data. Run this folder through a local web server instead of opening index.html directly.</div>'; return; }
  if(APP.role) renderShell(); else renderLogin();
}
function setCrests(){ document.querySelectorAll('[data-school-crest]').forEach(img=>{ img.src=crestUrl(); img.onerror=()=>{ img.onerror=null; img.src='assets/sasj-fallback.svg'; }; }); }
function renderLogin(){
  const tpl=document.getElementById('login-template'); document.getElementById('app').replaceChildren(tpl.content.cloneNode(true)); setCrests();
  document.getElementById('login-button').addEventListener('click',login);
  document.getElementById('login-password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
}
function login(){
  const role=document.getElementById('login-role').value, password=document.getElementById('login-password').value;
  if(password!=='demo'){ const el=document.getElementById('login-error'); el.textContent='Incorrect prototype password.'; el.hidden=false; return; }
  APP.role=role; sessionStorage.setItem('sasj-role',role); APP.page='dashboard'; renderShell();
}
function signOut(){ sessionStorage.removeItem('sasj-role'); APP.role=null; renderLogin(); }
function renderShell(){
  const tpl=document.getElementById('shell-template'); document.getElementById('app').replaceChildren(tpl.content.cloneNode(true)); setCrests(); renderNav();
  document.getElementById('role-pill').innerHTML=`<span class="role-pill">${esc(ROLE_LABELS[APP.role])}</span>`;
  document.getElementById('sign-out').addEventListener('click',signOut);
  document.getElementById('mobile-menu').addEventListener('click',()=>toggleMobile(true));
  document.getElementById('mobile-backdrop').addEventListener('click',()=>toggleMobile(false));
  document.getElementById('collapse-sidebar').addEventListener('click',()=>document.querySelector('.app-shell').classList.toggle('sidebar-collapsed'));
  navigate(APP.page);
}
function renderNav(){
  const nav=document.getElementById('nav-list');
  nav.innerHTML=NAV.filter(n=>n.roles.includes(APP.role)).map(n=>`<button class="nav-item" data-page="${n.id}"><span class="nav-item__icon">${n.icon}</span><span class="nav-item__label">${n.label}</span></button>`).join('');
  nav.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>{navigate(btn.dataset.page);toggleMobile(false);}));
}
function toggleMobile(open){ const sb=document.getElementById('sidebar'),bg=document.getElementById('mobile-backdrop'); if(!sb)return; sb.classList.toggle('mobile-open',open); bg.hidden=!open; }
function navigate(page,opts={}){
  const allowed=NAV.find(n=>n.id===page&&n.roles.includes(APP.role)); APP.page=allowed?page:'dashboard';
  if(opts.bookingStatus) APP.bookingStatus={...APP.bookingStatus,...opts.bookingStatus};
  if(opts.scrollBookingStatus) APP.scrollToBookingStatus=true;
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===APP.page));
  const [title,sub]=PAGE_META[APP.page]; document.getElementById('page-title').textContent=title; document.getElementById('page-subtitle').textContent=sub;
  const renderers={dashboard:renderDashboard,schedule:renderSchedule,request:renderCreateBooking,inventory:renderInventory,approvals:renderApprovals,timetable:renderTimetable,roster:renderRoster,settings:renderSettings};
  renderers[APP.page]();
}
function toast(message){ const root=document.getElementById('toast-root'); const node=document.createElement('div'); node.className='toast'; node.textContent=message; root.appendChild(node); setTimeout(()=>node.remove(),3400); }

function metricCard(label,value,hint,action='',warning=false){
  return `<button class="card metric ${action?'metric--clickable':''} ${warning?'metric--warning':''}" ${action?`data-dashboard-link="${action}"`:''}><div class="metric__label">${warning?'! ':''}${esc(label)}</div><div class="metric__value">${esc(value)}</div><div class="metric__hint">${hint}</div></button>`;
}
function roleDashboardCopy(){
  if(APP.role==='teacher')return{title:'Quick access',text:'Check lab availability, confirm pre-assigned sessions and create or amend bookings from your phone.'};
  if(APP.role==='labtech')return{title:'Lab operations',text:'Focus on pending requests, preparation turnaround and inventory alerts.'};
  if(APP.role==='hod')return{title:'Science oversight',text:'Review bookings, approvals, timetable setup, roster and inventory.'};
  return{title:'System control',text:'Manage timetable generation, bookings, roster, rules and operational data.'};
}
function renderDashboard(){
  const content=document.getElementById('page-content'); const reqs=requests(); const inv=inventory(); const s=data().baseline_schedule.summary;
  const pending=reqs.filter(r=>r.status==='Pending').length; const invAlerts=inv.filter(i=>i.active!==false&&i.condition!=='Good').length; const gaps=turnaroundWarnings(); const copy=roleDashboardCopy();
  let metrics=[];
  if(APP.role==='teacher'){
    metrics=[metricCard('Pre-assigned sessions / cycle',s.sessions,'18 active mainstream P3–P5 classes'),metricCard('Pending requests',pending,'Requests awaiting approval'),metricCard('Inventory alerts',invAlerts,'Incomplete, low stock or damaged'),metricCard('Active classes',18,'Mainstream P3–P5')];
  }else if(APP.role==='hod'){
    metrics=[metricCard('Pre-assigned sessions / cycle',s.sessions,'Current P3–P5 baseline'),metricCard('Pending requests',pending,'Tap to review all pending requests','pending'),metricCard('Inventory alerts',invAlerts,'Tap to review inventory items needing attention','inventory'),metricCard('Active classes',18,'Mainstream P3–P5')];
  }else if(APP.role==='labtech'){
    const gapHint=gaps.length?gaps.slice(0,3).map(g=>`${g.week} ${g.day} ${fmtTime(g.time)} (${g.lab})`).join('<br>')+(gaps.length>3?`<br>+ ${gaps.length-3} more to review`:''):'Preferred 30-minute turnaround is maintained.';
    metrics=[metricCard('Pending requests',pending,'Tap to review all pending requests','pending'),metricCard('Inventory alerts',invAlerts,'Tap to review inventory items needing attention','inventory'),metricCard('Turnaround gap warnings',gaps.length,gapHint,'',gaps.length>0),metricCard('Official bookings',activeOfficialEntries().length,'Current reserved / confirmed sessions')];
  }else{
    const gapHint=gaps.length?gaps.slice(0,3).map(g=>`${g.week} ${g.day} ${fmtTime(g.time)} (${g.lab})`).join('<br>')+(gaps.length>3?`<br>+ ${gaps.length-3} more to review`:''):'Preferred 30-minute turnaround is maintained.';
    metrics=[metricCard('Pre-assigned sessions / cycle',s.sessions,'Current P3–P5 baseline'),metricCard('Pending requests',pending,'Tap to review all pending requests','pending'),metricCard('Inventory alerts',invAlerts,'Tap to review inventory items needing attention','inventory'),metricCard('Turnaround gap warnings',gaps.length,gapHint,'',gaps.length>0)];
  }
  const showTimetable=['teacher','admin'].includes(APP.role);
  content.innerHTML=`<div class="demo-banner"><strong>Prototype v0.5:</strong> interactive HOD demonstration using the current P3–P5 baseline. Changes are stored only in this browser; production will use shared cloud data and secure authentication.</div><section class="cards">${metrics.join('')}</section><section class="dashboard-grid ${showTimetable?'':'dashboard-grid--single'}"><div class="card"><div class="card__header"><div><h2>${copy.title}</h2><p class="small">${copy.text}</p></div></div><div class="card__body"><div class="quick-actions" id="quick-actions"></div></div></div>${showTimetable?`<div class="card"><div class="card__header"><h2>Current timetable</h2></div><div class="card__body stack"><div><strong>${esc(settings().active_timetable_version)}</strong><div class="small">Current school manual baseline retained while the timetable-version mismatch is being checked.</div></div><div class="info-box"><strong>Timetable Organizer remains a core function.</strong> Future timetable revisions can be uploaded, parsed and re-optimised before publication.</div></div></div>`:''}</section>`;
  const quick=[['schedule','▦ Lab Schedule'],['request','+ Create Booking'],['inventory','□ Inventory']];
  if(['labtech','admin','hod'].includes(APP.role))quick.push(['approvals','✓ Review Requests']);
  if(['admin','hod'].includes(APP.role))quick.push(['timetable','↻ Timetable Organizer'],['roster','♙ Teacher Roster']);
  document.getElementById('quick-actions').innerHTML=quick.map(([p,l])=>`<button class="button button--secondary quick-action" data-go="${p}">${l}</button>`).join('');
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
  document.querySelectorAll('[data-dashboard-link="pending"]').forEach(b=>b.addEventListener('click',()=>navigate('schedule',{bookingStatus:{status:'Pending'},scrollBookingStatus:true})));
  document.querySelectorAll('[data-dashboard-link="inventory"]').forEach(b=>b.addEventListener('click',()=>navigate('inventory')));
}

function scheduleLegend(){
  return `<div class="schedule-legend"><span><i class="legend-swatch legend-swatch--confirmed"></i>Confirmed</span><span><i class="legend-swatch legend-swatch--preassigned"></i>Pre-assigned — confirmation required</span><span><i class="legend-swatch legend-swatch--pending"></i>Pending request</span><span><i class="legend-warning">!</i>Pending request overlaps this booking</span></div>`;
}
function renderSchedule(){
  const content=document.getElementById('page-content');
  content.innerHTML=`<div class="page-actions page-actions--equal"><button class="button button--primary" id="schedule-create">+ Create Booking</button><button class="button button--secondary" id="schedule-amend">Amend Booking</button></div><section class="card"><div class="card__body"><div class="section-heading"><h2>Lab timetable</h2><p>Click any lab session to see details, confirm, edit, amend or cancel it.</p></div>${scheduleLegend()}<div class="filter-grid schedule-filter-grid"><label class="field"><span>Week</span><select id="schedule-week"><option>Odd</option><option>Even</option></select></label><label class="field"><span>Day</span><select id="schedule-day">${DAYS.map(d=>`<option>${d}</option>`).join('')}</select></label><label class="field"><span>Lab</span><select id="schedule-lab"><option>Both</option><option>Lab 1</option><option>Lab 2</option></select></label><label class="field"><span>Class</span><select id="schedule-class"><option>All</option>${data().classes.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><div class="field"><span>View</span><div class="segmented segmented--full"><button id="view-day">Day</button><button id="view-week">Week</button></div></div></div><div id="schedule-content"></div></div></section><section class="card schedule-help"><div class="card__header"><h2>Using the lab schedule</h2></div><div class="card__body help-grid"><div><strong>1. Confirm your pre-assigned session</strong><p>Click the orange pre-assigned session. Confirm it by <strong>2:00 PM on the day before</strong>, enter the activity number, number of sets and any special requests. Once confirmed, the booking turns green.</p></div><div><strong>2. Create a new booking</strong><p>Click <strong>Create Booking</strong>, choose your name/class, lab and time, then submit. Teacher-created bookings remain pending until approved. An approved ad hoc or special-event booking is automatically confirmed.</p></div><div><strong>3. Amend an existing booking</strong><p>Click <strong>Amend Booking</strong>, search by teacher or class and select the session. Teacher date/time changes require approval; HOD/SH, Lab Technician and System Admin can change scheduling directly if there is no conflict.</p></div></div></section><section class="card" id="booking-status-section"><div class="card__header"><div><h2>Booking Status</h2><p class="small">Search pre-assigned sessions, confirmed bookings and requests.</p></div></div><div class="card__body"><div class="filter-grid booking-status-filters"><label class="field"><span>Search</span><input id="status-search" placeholder="Class, teacher, activity or event..." value="${esc(APP.bookingStatus.search)}"></label><label class="field"><span>Status</span><select id="status-filter"><option>All</option><option>Pre-assigned</option><option>Confirmed</option><option>Pending</option><option>Approved</option><option>Rejected</option><option>Cancelled</option></select></label></div><div id="status-results"></div></div></section>`;
  ['week','day','lab'].forEach(k=>{const el=document.getElementById(`schedule-${k}`);el.value=APP.schedule[k];el.addEventListener('change',()=>{APP.schedule[k]=el.value;drawSchedule();});});
  const ce=document.getElementById('schedule-class');ce.value=APP.schedule.classFilter;ce.addEventListener('change',()=>{APP.schedule.classFilter=ce.value;drawSchedule();});
  document.getElementById('view-day').addEventListener('click',()=>{APP.schedule.view='day';drawSchedule();});
  document.getElementById('view-week').addEventListener('click',()=>{APP.schedule.view='week';drawSchedule();});
  document.getElementById('schedule-create').addEventListener('click',()=>navigate('request'));
  document.getElementById('schedule-amend').addEventListener('click',openAmendSearchModal);
  const ss=document.getElementById('status-search'),sf=document.getElementById('status-filter');sf.value=APP.bookingStatus.status;
  ss.addEventListener('input',()=>{APP.bookingStatus.search=ss.value;drawBookingStatus();}); sf.addEventListener('change',()=>{APP.bookingStatus.status=sf.value;drawBookingStatus();});
  drawSchedule(); drawBookingStatus();
  if(APP.scrollToBookingStatus){ APP.scrollToBookingStatus=false; setTimeout(()=>document.getElementById('booking-status-section')?.scrollIntoView({behavior:'smooth',block:'start'}),120); }
}
function entryMatchesFilters(e){ return (APP.schedule.lab==='Both'||e.lab===APP.schedule.lab)&&(APP.schedule.classFilter==='All'||e.class_name===APP.schedule.classFilter); }
function scheduleEntriesFor(week,day,lab){ return [...activeOfficialEntries(),...pendingRequestEntries()].filter(e=>e.week===week&&e.day===day&&e.lab===lab&&entryMatchesFilters(e)); }
function drawSchedule(){
  const target=document.getElementById('schedule-content'); if(!target)return;
  document.getElementById('view-day').classList.toggle('active',APP.schedule.view==='day'); document.getElementById('view-week').classList.toggle('active',APP.schedule.view==='week');
  if(APP.schedule.view==='week')drawWeek(target); else{
    const labs=APP.schedule.lab==='Both'?['Lab 1','Lab 2']:[APP.schedule.lab]; target.innerHTML=`<div class="schedule-wrap"><div class="day-schedule">${labs.map(timelineHTML).join('')}</div></div>`;
  }
  bindScheduleEntryClicks(target);
}
function bookingBarClass(entry){
  if(entry.status==='Pending')return'booking-bar--pending';
  if(entry.source_kind==='baseline'&&entry.status==='Pre-assigned')return'booking-bar--preassigned';
  return'booking-bar--confirmed';
}
function entryStatusText(entry){ if(entry.source_kind==='request')return displayRequestStatus(entry); return entry.status; }
function entryTypeText(entry){ if(entry.source_kind==='baseline')return'Pre-assigned'; return requestTypeLabel(entry.request_type); }
function timelineHTML(lab){
  const entries=scheduleEntriesFor(APP.schedule.week,APP.schedule.day,lab).sort((a,b)=>minutes(a.start_time)-minutes(b.start_time));
  const start=7*60+30,px=40/30;let labels='';for(let t=start;t<=14*60;t+=60){const v=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;labels+=`<span class="timeline-label" style="top:${(t-start)*px}px">${fmtTime(v)}</span>`;}
  const bars=entries.map(e=>{ const top=(minutes(e.start_time)-start)*px,height=Math.max(36,(minutes(e.end_time)-minutes(e.start_time))*px-4); const warnings=e.status==='Pending'?[]:pendingWarningsForEntry(e); const pending=e.status==='Pending'; const offset=pending?'left:20%;right:8px;':'left:8px;right:8px;'; return `<button class="booking-bar ${bookingBarClass(e)} ${e.is_preferred_lab===false?'cross-lab':''}" style="top:${top}px;height:${height}px;${offset}" data-entry-kind="${e.source_kind}" data-entry-id="${encodeURIComponent(e.source_id)}">${warnings.length?`<span class="booking-conflict-badge" title="Pending request overlaps this booking">!</span>`:''}<div class="booking-bar__title">${esc(e.class_name||e.teacher)}</div><div class="booking-bar__meta">${fmtTime(e.start_time)}–${fmtTime(e.end_time)} · ${esc(entryTypeText(e))} · ${esc(entryStatusText(e))}</div></button>`; }).join('');
  return `<div class="card lab-timeline"><div class="lab-timeline__header"><strong>${lab}</strong><span class="status status--preassigned">${lab==='Lab 1'?'P3/P4 preferred':'P5/P6 preferred'}</span></div><div class="timeline-body"><div class="timeline-labels">${labels}</div>${bars}</div></div>`;
}
function drawWeek(target){
  const labs=APP.schedule.lab==='Both'?['Lab 1','Lab 2']:[APP.schedule.lab]; let html='<div class="week-view-scroll"><div class="week-grid"><div class="week-cell week-header"></div>'+DAYS.map(d=>`<div class="week-cell week-header">${d}</div>`).join('');
  labs.forEach(lab=>{ html+=`<div class="week-cell week-lab-label">${lab}</div>`; DAYS.forEach(day=>{ const entries=scheduleEntriesFor(APP.schedule.week,day,lab).sort((a,b)=>minutes(a.start_time)-minutes(b.start_time)); html+=`<div class="week-cell">${entries.length?entries.map(e=>{const warnings=e.status==='Pending'?[]:pendingWarningsForEntry(e);return`<button class="week-booking ${bookingBarClass(e)}" data-entry-kind="${e.source_kind}" data-entry-id="${encodeURIComponent(e.source_id)}">${warnings.length?'<span class="week-warning">!</span>':''}<strong>${esc(e.class_name||e.teacher)}</strong>${fmtTime(e.start_time)}–${fmtTime(e.end_time)}<br><span>${esc(entryTypeText(e))} · ${esc(entryStatusText(e))}</span></button>`;}).join(''):'<span class="small">Available</span>'}</div>`; }); }); html+='</div></div>'; target.innerHTML=html;
}
function bindScheduleEntryClicks(root){ root.querySelectorAll('[data-entry-kind]').forEach(el=>el.addEventListener('click',()=>openEntryDetail(el.dataset.entryKind,decodeURIComponent(el.dataset.entryId)))); }
function getEntry(kind,id){ if(kind==='baseline')return baselineEntries(true).find(e=>e.source_id===id); const r=requests().find(x=>x.id===id); return r?requestEntry(r):null; }

function openEntryDetail(kind,id){
  const entry=getEntry(kind,id); if(!entry)return;
  if(kind==='request' && (entry.status==='Pending'||entry.request_type==='amendment'||['Rejected','Cancelled'].includes(entry.status))) return openRequestDetail(entry.id);
  openOfficialBookingDetail(entry);
}
function teacherSelectOptions(selected='',className=''){ let linked=className?teachers().filter(t=>(t.classes||[]).includes(className)&&t.active!==false):teachers().filter(t=>t.active!==false); if(!linked.length) linked=teachers().filter(t=>t.active!==false); return linked.map(t=>`<option value="${esc(t.name)}" ${t.name===selected?'selected':''}>${esc(t.name)}</option>`).join(''); }
function classOptions(selected='',allowEvent=true){ return `${allowEvent?'<option value="">Event / no class</option>':''}${data().classes.map(c=>`<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`).join('')}`; }
function scheduleEditorHTML(entry,disabled=false){ return `<div class="form-grid scheduling-fields"><label class="field"><span>Week</span><select id="edit-week" ${disabled?'disabled':''}><option>Odd</option><option>Even</option></select></label><label class="field"><span>Day</span><select id="edit-day" ${disabled?'disabled':''}>${DAYS.map(d=>`<option>${d}</option>`).join('')}</select></label><label class="field"><span>Lab</span><select id="edit-lab" ${disabled?'disabled':''}><option>Lab 1</option><option>Lab 2</option></select></label><label class="field"><span>Time</span><select id="edit-start" ${disabled?'disabled':''}>${timeOptions(entry.start_time)}</select></label></div>`; }
function setScheduleEditorValues(entry){ ['week','day','lab'].forEach(k=>{const e=document.getElementById(`edit-${k}`);if(e)e.value=entry[k];}); }
function detailFieldsHTML(entry){ return `<label class="field"><span>Activity</span><input id="edit-activity" value="${esc(entry.activity||'')}" placeholder="e.g. 1.3"></label><label class="field"><span>Number of sets</span><input id="edit-sets" inputmode="numeric" value="${esc(entry.sets||'')}" placeholder="e.g. 10"></label><label class="field span-2"><span>Special request / apparatus / assistance needed</span><textarea id="edit-apparatus" placeholder="Apparatus, quantities, setup notes, assistance needed...">${esc(entry.apparatus||'')}</textarea></label><label class="field span-2"><span>Remarks</span><textarea id="edit-remarks" placeholder="Optional remarks">${esc(entry.remarks||'')}</textarea></label>`; }
function openOfficialBookingDetail(entry){
  const privileged=roleCanDirectBook(), isBaseline=entry.source_kind==='baseline', isUnconfirmed=isBaseline&&entry.status==='Pre-assigned'; const selectedTeacher=entry.teacher?.split(' / ')[0]||teacherNamesForClass(entry.class_name)[0]||'';
  modal('Lab session details',`<div class="stack"><div class="booking-detail-summary"><div><h3>${esc(entry.class_name||entry.teacher)}</h3><p>${esc(entryTypeText(entry))} · ${entry.week} ${entry.day} · ${entry.lab} · ${fmtTime(entry.start_time)}–${fmtTime(entry.end_time)}</p></div><span class="status status--${statusClass(entryStatusText(entry))}">${esc(entryStatusText(entry))}</span></div>${isUnconfirmed?`<div class="warning-box"><strong>Confirmation required:</strong> confirm this pre-assigned session by <strong>${fmtTime(settings().confirmation_deadline)} on the day before</strong>. Enter your activity and preparation needs before confirming.</div>`:''}<label class="field"><span>Teacher / requester</span><select id="edit-teacher">${teacherSelectOptions(selectedTeacher,entry.class_name)}</select></label>${privileged?scheduleEditorHTML(entry,false):`<div class="info-box"><strong>Schedule:</strong> ${entry.week} ${entry.day}, ${entry.lab}, ${fmtTime(entry.start_time)}–${fmtTime(entry.end_time)}. Use <strong>Amend Date/Time</strong> below if you need to change it.</div>`}<div class="form-grid">${detailFieldsHTML(entry)}</div><div id="direct-edit-conflict"></div></div>`,`<button class="button button--danger" id="detail-cancel">Cancel Booking</button>${!privileged?'<button class="button button--secondary" id="detail-amend">Amend Date/Time</button>':''}<button class="button button--primary" id="detail-save">${isUnconfirmed?'Save Details':'Save Details'}</button>${isUnconfirmed?'<button class="button button--success" id="detail-confirm">Confirm Session</button>':''}`);
  if(privileged){ setScheduleEditorValues(entry); ['edit-week','edit-day','edit-lab','edit-start'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>showDirectConflict(entry))); showDirectConflict(entry); }
  document.getElementById('detail-save').addEventListener('click',()=>saveOfficialEntry(entry,false));
  document.getElementById('detail-confirm')?.addEventListener('click',()=>saveOfficialEntry(entry,true));
  document.getElementById('detail-amend')?.addEventListener('click',()=>{closeModal();openAmendForm(entry);});
  document.getElementById('detail-cancel').addEventListener('click',()=>openDeleteConfirmation(entry));
}
function editedCandidate(entry){ const start=document.getElementById('edit-start')?.value||entry.start_time; return {...entry,week:document.getElementById('edit-week')?.value||entry.week,day:document.getElementById('edit-day')?.value||entry.day,lab:document.getElementById('edit-lab')?.value||entry.lab,start_time:start,end_time:endAfterHour(start)}; }
function showDirectConflict(entry){ const box=document.getElementById('direct-edit-conflict');if(!box)return;const candidate=editedCandidate(entry);const c=findOfficialConflicts(candidate,entryRef(entry));box.innerHTML=c.length?conflictBoxHTML(c,'This change cannot be saved until the conflict is resolved.'):'<div class="info-box"><strong>No scheduling conflict.</strong> This change can be saved directly.</div>'; }
function readDetailValues(){ return {teacher:document.getElementById('edit-teacher')?.value||'',activity:activityLabel(document.getElementById('edit-activity')?.value||''),sets:document.getElementById('edit-sets')?.value||'',apparatus:document.getElementById('edit-apparatus')?.value.trim()||'',remarks:document.getElementById('edit-remarks')?.value.trim()||''}; }
function saveOfficialEntry(entry,confirmSession=false){
  const vals=readDetailValues(); let candidate={...entry,...vals};
  if(roleCanDirectBook()){ candidate=editedCandidate(candidate); const conflicts=findOfficialConflicts(candidate,entryRef(entry)); if(conflicts.length){toast('Cannot save: this change creates a scheduling conflict.');showDirectConflict(entry);return;} }
  if(entry.source_kind==='baseline'){
    const actions=sessionActions(),existing=actions[entry.original_key]||{}; actions[entry.original_key]={...existing,...vals,week:candidate.week,day:candidate.day,lab:candidate.lab,start_time:candidate.start_time,end_time:candidate.end_time,status:confirmSession?'Confirmed':(existing.status||entry.status),updated_at:new Date().toLocaleString('en-SG')}; writeLocal('sasj-v05-session-actions',actions);
  }else{
    const arr=requests(),r=arr.find(x=>x.id===entry.source_id); if(!r)return; Object.assign(r,vals); if(roleCanDirectBook())Object.assign(r,{week:candidate.week,day:candidate.day,lab:candidate.lab,start_time:candidate.start_time,end_time:candidate.end_time}); writeLocal('sasj-v05-requests',arr);
  }
  closeModal(); toast(confirmSession?'Session confirmed.':'Booking details updated.'); if(APP.page==='schedule'){drawSchedule();drawBookingStatus();}
}
function openAmendForm(entry){
  const selectedTeacher=entry.teacher?.split(' / ')[0]||teacherNamesForClass(entry.class_name)[0]||'';
  modal('Amend booking date / time',`<div class="stack"><div class="info-box"><strong>Current booking:</strong> ${esc(entry.class_name||entry.teacher)} · ${entry.week} ${entry.day} · ${entry.lab} · ${fmtTime(entry.start_time)}–${fmtTime(entry.end_time)}</div><label class="field"><span>Your name</span><select id="amend-teacher">${teacherSelectOptions(selectedTeacher,entry.class_name)}</select></label><div class="form-grid"><label class="field"><span>New week</span><select id="amend-week"><option>Odd</option><option>Even</option></select></label><label class="field"><span>New day</span><select id="amend-day">${DAYS.map(d=>`<option>${d}</option>`).join('')}</select></label><label class="field"><span>New lab</span><select id="amend-lab"><option>Lab 1</option><option>Lab 2</option></select></label><label class="field"><span>New time</span><select id="amend-start">${timeOptions(entry.start_time)}</select></label><label class="field span-2"><span>Reason for amendment</span><textarea id="amend-reason" placeholder="Why is this change needed?"></textarea></label></div><div id="amend-conflict"></div></div>`,`<button class="button button--ghost" data-close-modal>Cancel</button><button class="button button--primary" id="submit-amendment">Submit Amendment</button>`);
  ['week','day','lab'].forEach(k=>document.getElementById(`amend-${k}`).value=entry[k]);
  const check=()=>{ const start=document.getElementById('amend-start').value; const candidate={...entry,request_type:'amendment',week:document.getElementById('amend-week').value,day:document.getElementById('amend-day').value,lab:document.getElementById('amend-lab').value,start_time:start,end_time:endAfterHour(start),original_kind:entry.source_kind,original_id:entry.source_id}; const conflicts=findOfficialConflicts(candidate); document.getElementById('amend-conflict').innerHTML=conflicts.length?conflictBoxHTML(conflicts,'You may still submit the amendment. It cannot be approved until the conflict is resolved.'):'<div class="info-box"><strong>No conflict detected.</strong> The amendment will still require approval.</div>'; };
  ['amend-week','amend-day','amend-lab','amend-start'].forEach(id=>document.getElementById(id).addEventListener('change',check));check();
  document.getElementById('submit-amendment').addEventListener('click',()=>{ const start=document.getElementById('amend-start').value; const r={id:uid('req'),request_type:'amendment',teacher:document.getElementById('amend-teacher').value,class_name:entry.class_name||'Event / no class',week:document.getElementById('amend-week').value,day:document.getElementById('amend-day').value,lab:document.getElementById('amend-lab').value,start_time:start,end_time:endAfterHour(start),activity:entry.activity||'',sets:entry.sets||'',apparatus:entry.apparatus||'',remarks:document.getElementById('amend-reason').value.trim(),status:'Pending',original_kind:entry.source_kind,original_id:entry.source_id,original_summary:`${entry.week} ${entry.day} ${entry.lab} ${entry.start_time}`,submitted_at:new Date().toLocaleString('en-SG')}; const arr=requests();arr.unshift(r);writeLocal('sasj-v05-requests',arr);closeModal();toast('Amendment submitted for approval.');if(APP.page==='schedule'){drawSchedule();drawBookingStatus();} });
}
function openDeleteConfirmation(entry){
  modal('Cancel booking',`<div class="stack"><div class="warning-box"><strong>This takes effect immediately.</strong> The slot will be freed as soon as you confirm cancellation.</div><p>To prevent accidental cancellation, type <strong>delete</strong> below.</p><label class="field"><span>Type “delete” to confirm</span><input id="delete-confirm-text" autocomplete="off" placeholder="delete"></label></div>`,`<button class="button button--ghost" data-close-modal>Keep Booking</button><button class="button button--danger" id="delete-confirm-button">Cancel Booking</button>`);
  const input=document.getElementById('delete-confirm-text'),btn=document.getElementById('delete-confirm-button'); btn.disabled=true; input.addEventListener('input',()=>btn.disabled=input.value.trim().toLowerCase()!=='delete'); btn.addEventListener('click',()=>cancelEntry(entry));
}
function cancelEntry(entry){
  if(entry.source_kind==='baseline'){const actions=sessionActions(),existing=actions[entry.original_key]||{};actions[entry.original_key]={...existing,status:'Cancelled',cancelled_at:new Date().toLocaleString('en-SG'),cancelled_by:ROLE_LABELS[APP.role]};writeLocal('sasj-v05-session-actions',actions);}else{const arr=requests(),r=arr.find(x=>x.id===entry.source_id);if(r){r.status='Cancelled';r.cancelled_at=new Date().toLocaleString('en-SG');r.cancelled_by=ROLE_LABELS[APP.role];writeLocal('sasj-v05-requests',arr);}}
  closeModal();toast('Booking cancelled and slot released.');if(APP.page==='schedule'){drawSchedule();drawBookingStatus();}if(APP.page==='approvals')drawApprovals();
}
function openAmendSearchModal(){
  modal('Amend Booking',`<div class="stack"><div class="filter-grid amend-search-grid"><label class="field"><span>Teacher</span><select id="amend-search-teacher"><option value="">Any teacher</option>${teacherSelectOptions()}</select></label><label class="field"><span>Class</span><select id="amend-search-class"><option value="">Any class</option>${data().classes.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label></div><button class="button button--primary button--wide" id="amend-search-button">Search</button><div id="amend-search-results" class="list"></div></div>`);
  document.getElementById('amend-search-button').addEventListener('click',()=>{ const teacher=document.getElementById('amend-search-teacher').value,cls=document.getElementById('amend-search-class').value; if(!teacher&&!cls){toast('Select a teacher or class first.');return;} let entries=activeOfficialEntries(); if(cls)entries=entries.filter(e=>e.class_name===cls); if(teacher){const linked=new Set(teachers().find(t=>t.name===teacher)?.classes||[]);entries=entries.filter(e=>e.teacher===teacher||linked.has(e.class_name));} entries.sort((a,b)=>`${a.week}${a.day}${a.start_time}`.localeCompare(`${b.week}${b.day}${b.start_time}`)); const result=document.getElementById('amend-search-results'); result.innerHTML=entries.length?entries.map(e=>`<button class="list-item amend-result" data-kind="${e.source_kind}" data-id="${encodeURIComponent(e.source_id)}"><strong>${esc(e.class_name||e.teacher)}</strong><span>${e.week} ${e.day} · ${e.lab} · ${fmtTime(e.start_time)}–${fmtTime(e.end_time)} · ${esc(entryStatusText(e))}</span></button>`).join(''):'<div class="empty-state">No matching active booking found.</div>'; result.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.kind,id=decodeURIComponent(b.dataset.id);closeModal();openEntryDetail(kind,id);})); });
}

function bookingStatusRecords(){
  const base=baselineEntries(true).map(e=>({...e,ui_status:e.status,ui_type:'Pre-assigned'}));
  const req=requests().map(r=>({...requestEntry(r),ui_status:displayRequestStatus(r),ui_type:requestTypeLabel(r.request_type)}));
  return [...base,...req];
}
function drawBookingStatus(){
  const target=document.getElementById('status-results');if(!target)return;const q=APP.bookingStatus.search.toLowerCase().trim(),status=APP.bookingStatus.status; let arr=bookingStatusRecords();
  if(q)arr=arr.filter(e=>JSON.stringify([e.class_name,e.teacher,e.activity,e.remarks,e.apparatus,e.booking_type,e.request_type]).toLowerCase().includes(q)); if(status!=='All')arr=arr.filter(e=>e.ui_status===status);
  target.innerHTML=arr.length?`<div class="list booking-status-list">${arr.map(bookingStatusCard).join('')}</div>`:'<div class="empty-state">No booking matches your search.</div>';
  target.querySelectorAll('[data-status-kind]').forEach(b=>b.addEventListener('click',()=>openEntryDetail(b.dataset.statusKind,decodeURIComponent(b.dataset.statusId))));
}
function bookingStatusCard(e){
  const pendingConf=e.status==='Pending'?conflictsForPending(e):[]; const officialWarnings=e.status==='Pending'?[]:(!['Cancelled','Rejected','Released'].includes(e.ui_status)?pendingWarningsForEntry(e):[]);
  return `<button class="list-item booking-status-card" data-status-kind="${e.source_kind}" data-status-id="${encodeURIComponent(e.source_id)}"><div class="list-item__top"><div><h3>${esc(e.class_name||e.teacher)}</h3><p>${esc(e.teacher||teacherNamesForClass(e.class_name).join(' / ')||'Science Teacher')} · ${e.week} ${e.day} · ${e.lab} · ${fmtTime(e.start_time)}–${fmtTime(e.end_time)}</p>${e.activity?`<p><strong>${esc(e.activity)}</strong>${e.apparatus?' · '+esc(e.apparatus):''}</p>`:''}<p>${esc(e.ui_type)}</p></div><span class="status status--${statusClass(e.ui_status)}">${esc(e.ui_status)}</span></div>${pendingConf.length?`<div class="conflict-box compact"><strong>! ${pendingConf.length} scheduling conflict${pendingConf.length===1?'':'s'} — approval is blocked until resolved.</strong></div>`:''}${officialWarnings.length?`<div class="warning-box compact"><strong>! ${officialWarnings.length} pending request${officialWarnings.length===1?'':'s'} overlap this booking.</strong></div>`:''}</button>`;
}
function openRequestDetail(id){
  const arr=requests(),r=arr.find(x=>x.id===id);if(!r)return;const display=displayRequestStatus(r);const editable=r.status==='Pending';const privileged=roleCanApprove();const conflicts=r.status==='Pending'?conflictsForPending(r):[];
  modal(`${requestTypeLabel(r.request_type)} details`,`<div class="stack"><div class="booking-detail-summary"><div><h3>${esc(r.class_name||r.teacher)}</h3><p>${r.week} ${r.day} · ${r.lab} · ${fmtTime(r.start_time)}–${fmtTime(r.end_time)}</p></div><span class="status status--${statusClass(display)}">${esc(display)}</span></div>${r.request_type==='amendment'&&r.original_summary?`<div class="info-box"><strong>Original booking:</strong> ${esc(r.original_summary)}</div>`:''}<label class="field"><span>Teacher / requester</span><select id="pending-teacher" ${editable?'':'disabled'}>${teacherSelectOptions(r.teacher,r.class_name)}</select></label><div class="form-grid"><label class="field"><span>Week</span><select id="pending-week" ${editable?'':'disabled'}><option>Odd</option><option>Even</option></select></label><label class="field"><span>Day</span><select id="pending-day" ${editable?'':'disabled'}>${DAYS.map(d=>`<option>${d}</option>`).join('')}</select></label><label class="field"><span>Lab</span><select id="pending-lab" ${editable?'':'disabled'}><option>Lab 1</option><option>Lab 2</option></select></label><label class="field"><span>Time</span><select id="pending-start" ${editable?'':'disabled'}>${timeOptions(r.start_time)}</select></label><label class="field"><span>Activity</span><input id="pending-activity" ${editable?'':'disabled'} value="${esc(r.activity||'')}"></label><label class="field"><span>Number of sets</span><input id="pending-sets" ${editable?'':'disabled'} value="${esc(r.sets||'')}"></label><label class="field span-2"><span>Special request / apparatus / assistance needed</span><textarea id="pending-apparatus" ${editable?'':'disabled'}>${esc(r.apparatus||'')}</textarea></label><label class="field span-2"><span>Remarks / reason</span><textarea id="pending-remarks" ${editable?'':'disabled'}>${esc(r.remarks||'')}</textarea></label></div><div id="pending-conflict-box">${conflicts.length?conflictBoxHTML(conflicts,'This request cannot be approved until the conflict is resolved.'):'<div class="info-box"><strong>No current scheduling conflict.</strong></div>'}</div></div>`,`${editable?'<button class="button button--danger" id="pending-cancel">Cancel Request</button><button class="button button--primary" id="pending-save">Update Request</button>':''}${editable&&privileged?'<button class="button button--danger" id="pending-reject">Reject</button><button class="button button--success" id="pending-approve">Approve</button>':''}`);
  ['week','day','lab'].forEach(k=>document.getElementById(`pending-${k}`).value=r[k]);
  if(editable){ const refresh=()=>{syncPendingFormToTemp(r);const c=conflictsForPending(r);document.getElementById('pending-conflict-box').innerHTML=c.length?conflictBoxHTML(c,'This request cannot be approved until the conflict is resolved.'):'<div class="info-box"><strong>No current scheduling conflict.</strong></div>';}; ['pending-week','pending-day','pending-lab','pending-start'].forEach(x=>document.getElementById(x).addEventListener('change',refresh)); document.getElementById('pending-save').addEventListener('click',()=>{syncPendingFormToTemp(r);writeLocal('sasj-v05-requests',arr);closeModal();toast('Pending request updated.');if(APP.page==='schedule'){drawSchedule();drawBookingStatus();}}); document.getElementById('pending-cancel').addEventListener('click',()=>openDeleteConfirmation(requestEntry(r))); document.getElementById('pending-reject')?.addEventListener('click',()=>{closeModal();updateRequestStatus(r.id,'Rejected');}); document.getElementById('pending-approve')?.addEventListener('click',()=>{closeModal();updateRequestStatus(r.id,'Approved');}); }
}
function syncPendingFormToTemp(r){ const start=document.getElementById('pending-start').value; Object.assign(r,{teacher:document.getElementById('pending-teacher').value,week:document.getElementById('pending-week').value,day:document.getElementById('pending-day').value,lab:document.getElementById('pending-lab').value,start_time:start,end_time:endAfterHour(start),activity:activityLabel(document.getElementById('pending-activity').value),sets:document.getElementById('pending-sets').value,apparatus:document.getElementById('pending-apparatus').value.trim(),remarks:document.getElementById('pending-remarks').value.trim()}); }
function conflictBoxHTML(conflicts,message){ return `<div class="conflict-box"><strong>! Conflict detected</strong><p>${esc(message)}</p>${conflicts.map(c=>`<div class="conflict-line"><strong>${esc(c.class_name||c.teacher)}</strong><span>${esc(teacherNamesForClass(c.class_name).join(' / ')||c.teacher||'Teacher not linked')} · ${c.week} ${c.day} · ${c.lab} · ${fmtTime(c.start_time)}–${fmtTime(c.end_time)}</span></div>`).join('')}</div>`; }

function renderCreateBooking(){
  const content=document.getElementById('page-content'); content.innerHTML=`<section class="card"><div class="card__header"><div><h2>Create Booking</h2><p class="small">Science Teachers submit a request for approval. HOD/SH, Lab Technician and System Admin can create a booking directly, but the app will block any confirmed booking that conflicts with an existing one.</p></div></div><div class="card__body"><div class="form-grid create-booking-grid"><label class="field"><span>Booking type</span><select id="req-type"><option value="additional">Ad hoc / additional lab session</option><option value="event">Special event / workshop / PSLE use</option></select></label><label class="field"><span>Your name / requester</span><select id="req-teacher"><option value="">Select name</option>${teacherSelectOptions()}</select></label><label class="field"><span>Class</span><select id="req-class">${classOptions('',true)}</select></label><label class="field"><span>Week</span><select id="req-week"><option>Odd</option><option>Even</option></select></label><label class="field"><span>Day</span><select id="req-day">${DAYS.map(d=>`<option>${d}</option>`).join('')}</select></label><label class="field"><span>Lab</span><select id="req-lab"><option>Lab 1</option><option>Lab 2</option></select></label><label class="field"><span>Time</span><select id="req-start">${timeOptions('09:30')}</select></label><label class="field"><span>Activity</span><input id="req-activity" placeholder="e.g. 5.6"></label><label class="field"><span>Number of sets</span><input id="req-sets" inputmode="numeric" placeholder="e.g. 10"></label><label class="field span-2"><span>Special request / apparatus / assistance needed</span><textarea id="req-apparatus" placeholder="Apparatus, quantities, setup or assistance required..."></textarea></label><label class="field span-2"><span>Remarks / purpose</span><textarea id="req-remarks" placeholder="Optional reason or event details"></textarea></label></div><div id="request-conflict" style="margin-top:14px"></div><div class="page-actions page-actions--equal" style="margin-top:14px"><button class="button button--primary" id="submit-request">${roleCanDirectBook()?'Create Confirmed Booking':'Submit Request'}</button><button class="button button--ghost" id="back-schedule">Back to Schedule</button></div></div></section>`;
  const typeEl=document.getElementById('req-type'),classEl=document.getElementById('req-class'); const updateType=()=>{if(typeEl.value==='event')classEl.value='';}; typeEl.addEventListener('change',()=>{updateType();checkCreateConflict();});
  ['req-week','req-day','req-lab','req-start'].forEach(id=>document.getElementById(id).addEventListener('change',checkCreateConflict)); checkCreateConflict();
  document.getElementById('submit-request').addEventListener('click',submitCreateBooking); document.getElementById('back-schedule').addEventListener('click',()=>navigate('schedule'));
}
function createCandidateFromForm(){ const start=document.getElementById('req-start').value;return{request_type:document.getElementById('req-type').value,teacher:document.getElementById('req-teacher').value,class_name:document.getElementById('req-class').value||'Event / no class',week:document.getElementById('req-week').value,day:document.getElementById('req-day').value,lab:document.getElementById('req-lab').value,start_time:start,end_time:endAfterHour(start)}; }
function checkCreateConflict(){ const target=document.getElementById('request-conflict');if(!target)return;const conflicts=findOfficialConflicts(createCandidateFromForm());target.innerHTML=conflicts.length?conflictBoxHTML(conflicts,roleCanDirectBook()?'Direct booking is blocked until the conflicting slot is changed or cancelled.':'You may still submit the request. The Lab Technician/HOD/Admin must resolve the conflict before it can be approved.'):'<div class="info-box"><strong>No scheduling conflict detected.</strong></div>'; }
function submitCreateBooking(){
  const c=createCandidateFromForm(); if(!c.teacher){toast('Select your name / requester.');return;} if(c.request_type!=='event'&&(!c.class_name||c.class_name==='Event / no class')){toast('Select a class.');return;} const conflicts=findOfficialConflicts(c); if(roleCanDirectBook()&&conflicts.length){toast('Cannot create booking: resolve the scheduling conflict first.');checkCreateConflict();return;}
  const r={id:uid('req'),...c,activity:activityLabel(document.getElementById('req-activity').value),sets:document.getElementById('req-sets').value,apparatus:document.getElementById('req-apparatus').value.trim(),remarks:document.getElementById('req-remarks').value.trim(),status:roleCanDirectBook()?'Approved':'Pending',submitted_at:new Date().toLocaleString('en-SG')}; const arr=requests();arr.unshift(r);writeLocal('sasj-v05-requests',arr);toast(r.status==='Approved'?'Confirmed booking created.':'Booking request submitted for approval.');navigate('schedule',{bookingStatus:{status:r.status==='Approved'?'Confirmed':'Pending'},scrollBookingStatus:true});
}

function renderApprovals(){ const content=document.getElementById('page-content'); content.innerHTML=`<section class="card"><div class="card__header"><div><h2>Pending requests</h2><p class="small">HOD/SH, Lab Technician and System Admin can approve any request. A request may be submitted against an occupied slot, but approval is blocked until all conflicts have been resolved.</p></div></div><div class="card__body"><div id="approval-list"></div></div></section>`; drawApprovals(); }
function drawApprovals(){ const arr=requests().filter(r=>r.status==='Pending'),target=document.getElementById('approval-list'); target.innerHTML=arr.length?`<div class="list">${arr.map(r=>{const c=conflictsForPending(r);return`<article class="list-item"><div class="list-item__top"><div><h3>${esc(r.class_name)} · ${esc(r.teacher)}</h3><p>${r.week} ${r.day} · ${r.lab} · ${fmtTime(r.start_time)}–${fmtTime(r.end_time)} · ${esc(requestTypeLabel(r.request_type))}</p></div><span class="status status--${c.length?'conflict':'pending'}">${c.length?'! Conflict':'Pending'}</span></div>${c.length?conflictBoxHTML(c,'Contact the affected teacher and resolve the booking before approval.'):'<div class="info-box compact">No scheduling conflict detected.</div>'}<div class="list-item__actions"><button class="button button--secondary" data-view="${r.id}">View / Edit</button><button class="button button--success" data-approve="${r.id}" ${c.length?'disabled':''}>Approve</button><button class="button button--danger" data-reject="${r.id}">Reject</button></div></article>`;}).join('')}</div>`:'<div class="empty-state">No pending requests.</div>'; target.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>openRequestDetail(b.dataset.view)));target.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',()=>updateRequestStatus(b.dataset.approve,'Approved')));target.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>updateRequestStatus(b.dataset.reject,'Rejected'))); }
function applyApprovedAmendment(r, requestArray){
  if(r.original_kind==='baseline'){
    const actions=sessionActions(),existing=actions[r.original_id]||{}; actions[r.original_id]={...existing,week:r.week,day:r.day,lab:r.lab,start_time:r.start_time,end_time:r.end_time,updated_at:new Date().toLocaleString('en-SG')}; writeLocal('sasj-v05-session-actions',actions);
  }else if(r.original_kind==='request'){
    const orig=requestArray.find(x=>x.id===r.original_id); if(orig) Object.assign(orig,{week:r.week,day:r.day,lab:r.lab,start_time:r.start_time,end_time:r.end_time});
  }
}
function updateRequestStatus(id,status){
  const arr=requests(),r=arr.find(x=>x.id===id);if(!r)return;
  if(status==='Approved'){const conflicts=conflictsForPending(r);if(conflicts.length){modal('Cannot approve booking',conflictBoxHTML(conflicts,'The existing booking must be changed or cancelled first. The app will never allow two confirmed bookings to occupy the same lab/time.'));return;}if(r.request_type==='amendment')applyApprovedAmendment(r,arr);}
  r.status=status;r.reviewed_by=ROLE_LABELS[APP.role];r.reviewed_at=new Date().toLocaleString('en-SG');writeLocal('sasj-v05-requests',arr);toast(`Request ${status.toLowerCase()}.`);if(APP.page==='approvals')drawApprovals();if(APP.page==='schedule'){drawSchedule();drawBookingStatus();}
}

function renderInventory(){
  const content=document.getElementById('page-content'); content.innerHTML=`<div class="page-actions page-actions--equal">${roleCanEditInventory()?'<button class="button button--primary" id="add-inventory">+ Add Inventory Item</button>':''}<button class="button button--secondary" id="inventory-export">Export Audit CSV</button></div><section class="card"><div class="card__body"><div class="filter-grid inventory-filters"><label class="field"><span>Search inventory</span><input id="inv-search" placeholder="Item, component, lab, cabinet..."></label><label class="field"><span>Lab</span><select id="inv-lab"><option>All</option><option>Lab 1</option><option>Lab 2</option></select></label><label class="field"><span>Condition</span><select id="inv-condition"><option>All</option><option>Good</option><option>Incomplete</option><option>Low Stock</option><option>Needs Attention</option><option>Damaged</option><option>Missing</option></select></label></div><div id="inventory-results"></div></div></section>`;
  document.getElementById('add-inventory')?.addEventListener('click',()=>openInventoryEditor());document.getElementById('inventory-export').addEventListener('click',exportInventory);['inv-search','inv-lab','inv-condition'].forEach(id=>document.getElementById(id).addEventListener(id==='inv-search'?'input':'change',drawInventory));drawInventory();
}
function inventorySearchBlob(i){return JSON.stringify(i).toLowerCase();}
function drawInventory(){const q=(document.getElementById('inv-search')?.value||'').toLowerCase(),lab=document.getElementById('inv-lab')?.value||'All',cond=document.getElementById('inv-condition')?.value||'All';const arr=inventory().filter(i=>i.active!==false&&(lab==='All'||i.lab===lab)&&(cond==='All'||i.condition===cond)&&inventorySearchBlob(i).includes(q));const target=document.getElementById('inventory-results');target.innerHTML=arr.length?`<div class="inventory-grid">${arr.map(inventoryCard).join('')}</div>`:'<div class="empty-state">No inventory item matches your search.</div>';target.querySelectorAll('[data-inv-id]').forEach(b=>b.addEventListener('click',()=>openInventoryDetail(b.dataset.invId)));}
function inventoryCard(i){const missing=(i.components||[]).reduce((s,c)=>s+Math.max(0,(c.expected||0)-(c.current||0)),0);return`<button class="card inventory-card" data-inv-id="${i.id}"><div class="inventory-photo">${i.photo?`<img src="${i.photo}" alt="${esc(i.name)}">`:'Photo optional'}</div><div><h3>${esc(i.name)}</h3><div class="inventory-meta">${esc(i.lab)} · ${esc(i.location||'No location')}</div></div><div><span class="status status--${i.condition==='Good'?'good':i.condition==='Incomplete'?'pending':'conflict'}">${esc(i.condition)}</span>${missing?` <span class="status status--missing">${missing} component${missing===1?'':'s'} missing</span>`:''}</div></button>`;}
function openInventoryDetail(id){const i=inventory().find(x=>x.id===id);if(!i)return;const components=(i.components||[]).length?`<div class="component-list">${i.components.map(c=>`<div class="component-row component-row--view"><span>${esc(c.name)}</span><span>${c.current}/${c.expected}${c.damaged?` · ${c.damaged} damaged`:''}</span></div>`).join('')}</div>`:'<p class="small">No component-level tracking for this item.</p>';modal(i.name,`<div class="stack"><div class="inventory-photo inventory-photo--detail">${i.photo?`<img src="${i.photo}" alt="${esc(i.name)}">`:'No photo uploaded'}</div><div><span class="status status--info">${esc(i.lab)}</span> <span class="status status--pending">${esc(i.condition)}</span><p class="small">${esc(i.location||'Location not set')}</p></div><div><strong>Category:</strong> ${esc(i.category||'Others')}</div><div><strong>Quantity:</strong> ${i.current_quantity} / ${i.expected_quantity}${i.damaged_quantity?` · ${i.damaged_quantity} damaged`:''}</div><div><strong>Components</strong><p class="small">Useful for multi-piece kits like First Aid kit and Sparkle Kits.</p>${components}</div><div><strong>Notes</strong><p class="small">${esc(i.notes||'No notes')}</p></div>${roleCanEditInventory()?'<button class="button button--primary button--wide" id="edit-inventory-detail">Edit / Update Inventory</button>':''}</div>`);document.getElementById('edit-inventory-detail')?.addEventListener('click',()=>{closeModal();openInventoryEditor(i.id);});}
function openInventoryEditor(id){
  const arr=inventory(),existing=arr.find(x=>x.id===id)||{id:uid('inv'),name:'',category:'Apparatus',lab:'Lab 1',location:'',expected_quantity:1,current_quantity:1,damaged_quantity:0,condition:'Good',notes:'',photo:null,components:[],history:[],active:true}; const categories=['Apparatus','Expendables','Sparkle Kit','Others'];
  modal(existing.name?'Edit Inventory Item':'Add Inventory Item',`<div class="form-grid inventory-editor-grid"><label class="field"><span>Name</span><input id="inv-edit-name" value="${esc(existing.name)}"></label><label class="field"><span>Category</span><select id="inv-edit-category">${categories.map(v=>`<option>${v}</option>`).join('')}</select></label><label class="field"><span>Lab</span><select id="inv-edit-lab"><option>Lab 1</option><option>Lab 2</option></select></label><label class="field"><span>Storage location</span><input id="inv-edit-location" value="${esc(existing.location)}"></label><label class="field"><span>Expected quantity</span><input id="inv-edit-expected" type="number" min="0" value="${existing.expected_quantity}"></label><label class="field"><span>Current quantity</span><input id="inv-edit-current" type="number" min="0" value="${existing.current_quantity}"></label><label class="field"><span>Damaged</span><input id="inv-edit-damaged" type="number" min="0" value="${existing.damaged_quantity||0}"></label><label class="field"><span>Condition</span><select id="inv-edit-condition">${['Good','Incomplete','Low Stock','Needs Attention','Damaged','Missing'].map(v=>`<option>${v}</option>`).join('')}</select></label><label class="field span-2"><span>Notes</span><textarea id="inv-edit-notes">${esc(existing.notes||'')}</textarea></label><label class="field span-2"><span>Photo (camera or gallery)</span><input id="inv-edit-photo" type="file" accept="image/*" capture="environment"><small>Photos are heavily compressed on-device before storage.</small></label><div class="span-2 component-editor-section"><strong>Components</strong><p class="small">Useful for multi-piece kits like First Aid kit and Sparkle Kits.</p><div class="component-column-headings"><span>Component name</span><span>Expected</span><span>Current</span><span>Damaged</span><span></span></div><div id="component-editor" class="component-list"></div><button class="button button--secondary" id="add-component">+ Add Component</button></div></div>`,`<button class="button button--ghost" data-close-modal>Cancel</button><button class="button button--primary" id="save-inventory">Save</button>`);
  document.getElementById('inv-edit-category').value=categories.includes(existing.category)?existing.category:'Others';document.getElementById('inv-edit-lab').value=existing.lab;document.getElementById('inv-edit-condition').value=existing.condition;const working=clone(existing.components||[]);
  const sync=()=>working.forEach((c,idx)=>{const n=document.querySelector(`[data-c-name="${idx}"]`);if(n){c.name=n.value;c.expected=Number(document.querySelector(`[data-c-exp="${idx}"]`).value||0);c.current=Number(document.querySelector(`[data-c-cur="${idx}"]`).value||0);c.damaged=Number(document.querySelector(`[data-c-dmg="${idx}"]`).value||0);}});
  const draw=()=>{document.getElementById('component-editor').innerHTML=working.map((c,idx)=>`<div class="component-editor-row"><label><span>Component name</span><input data-c-name="${idx}" value="${esc(c.name)}"></label><label><span>Expected</span><input data-c-exp="${idx}" type="number" min="0" value="${c.expected||0}"></label><label><span>Current</span><input data-c-cur="${idx}" type="number" min="0" value="${c.current||0}"></label><label><span>Damaged</span><input data-c-dmg="${idx}" type="number" min="0" value="${c.damaged||0}"></label><button class="icon-button text-danger" data-c-del="${idx}" title="Remove component">×</button></div>`).join('');document.querySelectorAll('[data-c-del]').forEach(b=>b.addEventListener('click',()=>{sync();working.splice(Number(b.dataset.cDel),1);draw();}));};draw();document.getElementById('add-component').addEventListener('click',()=>{sync();working.push({name:'',expected:1,current:1,damaged:0});draw();});
  let newPhoto=existing.photo;document.getElementById('inv-edit-photo').addEventListener('change',async e=>{const f=e.target.files[0];if(f){newPhoto=await compressImage(f,settings().photo_max_dimension||1000,settings().photo_quality||.62);toast('Photo compressed and ready.');}});
  document.getElementById('save-inventory').addEventListener('click',()=>{sync();existing.name=document.getElementById('inv-edit-name').value.trim();if(!existing.name){toast('Enter an item name.');return;}Object.assign(existing,{category:document.getElementById('inv-edit-category').value,lab:document.getElementById('inv-edit-lab').value,location:document.getElementById('inv-edit-location').value.trim(),expected_quantity:Number(document.getElementById('inv-edit-expected').value||0),current_quantity:Number(document.getElementById('inv-edit-current').value||0),damaged_quantity:Number(document.getElementById('inv-edit-damaged').value||0),condition:document.getElementById('inv-edit-condition').value,notes:document.getElementById('inv-edit-notes').value.trim(),components:working,photo:newPhoto});existing.history=existing.history||[];existing.history.unshift({when:new Date().toLocaleString('en-SG'),who:ROLE_LABELS[APP.role],change:'Inventory record updated.'});const idx=arr.findIndex(x=>x.id===existing.id);if(idx>=0)arr[idx]=existing;else arr.unshift(existing);writeLocal('sasj-v05-inventory',arr);closeModal();toast('Inventory saved.');drawInventory();});
}
async function compressImage(file,maxDim,quality){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height;const scale=Math.min(1,maxDim/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',quality));};img.onerror=reject;img.src=reader.result;};reader.readAsDataURL(file);});}
function exportInventory(){const rows=[['Name','Category','Lab','Location','Expected','Current','Damaged','Condition','Notes']];inventory().filter(i=>i.active!==false).forEach(i=>rows.push([i.name,i.category,i.lab,i.location,i.expected_quantity,i.current_quantity,i.damaged_quantity||0,i.condition,i.notes||'']));const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');downloadText('sasj_inventory_audit.csv',csv,'text/csv');}
function downloadText(name,text,type){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

function renderTimetable(){
  const content=document.getElementById('page-content'),s=data().baseline_schedule.summary;content.innerHTML=`<div class="demo-banner"><strong>Core function:</strong> production will run the timetable parser + optimiser online. This public prototype demonstrates the upload → validate → generate → review → publish workflow without sending timetable files anywhere.</div><div class="cards"><div class="card metric"><div class="metric__label">Current pre-assigned sessions</div><div class="metric__value">${s.sessions}</div><div class="metric__hint">Current P3–P5 school baseline</div></div><div class="card metric"><div class="metric__label">Classes with 2 sessions</div><div class="metric__value">${s.classes_with_2_sessions}</div><div class="metric__hint">Out of 18 active P3–P5 classes</div></div><div class="card metric"><div class="metric__label">Future parser scope</div><div class="metric__value">24</div><div class="metric__hint">Mainstream P3–P6 classes</div></div><div class="card metric"><div class="metric__label">Preferred buffer</div><div class="metric__value">30m</div><div class="metric__hint">One period where feasible</div></div></div><section class="card" style="margin-top:16px"><div class="card__header"><div><h2>Import new class timetable</h2><p class="small">Accept Excel, PDF, multiple files, or ZIP bundles. Uncertain extraction is reviewed rather than guessed.</p></div></div><div class="card__body"><div class="form-grid timetable-import-grid"><label class="field span-2"><span>Timetable files</span><input id="tt-files" type="file" accept=".zip,.xlsx,.xls,.xlsm,.pdf" multiple></label><label class="field"><span>Version name</span><input id="tt-version" value="2026 Update 5"></label><label class="field"><span>Effective date</span><input id="tt-effective" type="date"></label></div><div class="page-actions page-actions--equal" style="margin-top:14px"><button class="button button--primary" id="tt-generate">Analyse & Generate Proposal</button><button class="button button--secondary" id="tt-review-current">Review Current Baseline</button></div><div id="tt-result"></div></div></section><section class="card" style="margin-top:16px"><div class="card__header"><h2>Allocation rules</h2></div><div class="card__body"><ul><li>Two consecutive 30-minute Science periods form the normal one-hour booking.</li><li>Target 1 Odd + 1 Even per mainstream class; use 2+0 only when needed.</li><li>Lab 1 prefers P3/P4; Lab 2 prefers P5/P6, but this is flexible.</li><li>Current published baseline excludes P6 for the PSLE period; future generation still supports P3–P6.</li><li>Prefer one 30-minute empty period between classes in the same lab when feasible.</li><li>Support, Enrichment and Foundation groups are excluded from baseline generation and may book ad hoc.</li><li>HOD/SH or System Admin reviews the proposal before publication.</li></ul></div></section>`;document.getElementById('tt-generate').addEventListener('click',runTimetableUpload);document.getElementById('tt-review-current').addEventListener('click',()=>showScheduleReview(data().baseline_schedule));
}
function runTimetableUpload(){const files=[...document.getElementById('tt-files').files],target=document.getElementById('tt-result');if(!files.length){target.innerHTML='<div class="warning-box" style="margin-top:12px">Select at least one timetable file or ZIP first.</div>';return;}target.innerHTML=`<div class="workflow-list" style="margin-top:14px"><div class="workflow-step"><span class="workflow-step__num">1</span><div><strong>${files.length} file${files.length===1?'':'s'} selected</strong><div class="small">${files.map(f=>esc(f.name)).join(', ')}</div></div></div><div class="workflow-step"><span class="workflow-step__num">2</span><div><strong>Parser validation</strong><div class="small">Production identifies P3–P6 mainstream Science periods, Odd/Even weeks and ambiguous entries.</div></div></div><div class="workflow-step"><span class="workflow-step__num">3</span><div><strong>Optimisation</strong><div class="small">Fair access, Odd/Even balance, preferred lab and 30-minute turnaround buffer.</div></div></div><div class="workflow-step"><span class="workflow-step__num">4</span><div><strong>Review & publish</strong><div class="small">Nothing becomes live until HOD/SH or System Admin reviews and publishes.</div></div></div></div><div class="page-actions page-actions--equal" style="margin-top:14px"><button class="button button--primary" id="tt-demo-preview">Preview Extracted Data</button><button class="button button--success" id="tt-demo-proposal">Generate Prototype Proposal</button></div><div class="warning-box" style="margin-top:12px"><strong>Public prototype:</strong> files are not uploaded or parsed. Production will run the real backend timetable engine after workflow approval.</div>`;document.getElementById('tt-demo-preview').addEventListener('click',()=>modal('Timetable extraction preview',`<div class="stack"><div class="info-box"><strong>Parser scope:</strong> 24 mainstream P3–P6 class timetables.</div><div class="list-item"><strong>Accepted inputs</strong><p>Single Excel/PDF, multiple files, or ZIP bundles containing Excel/PDF.</p></div><div class="list-item"><strong>Validation</strong><p>Science periods, Odd/Even week, consecutive periods, class names and timetable ambiguities are reviewed before optimisation.</p></div><div class="list-item"><strong>Current operational exception</strong><p>P6 is excluded from the current published baseline during the PSLE period, but remains supported by the scheduler.</p></div></div>`));document.getElementById('tt-demo-proposal').addEventListener('click',()=>showScheduleReview(data().baseline_schedule));}
function showScheduleReview(schedule){modal('Current school baseline review',`<div class="cards two-card-grid"><div class="card metric"><div class="metric__label">Sessions</div><div class="metric__value">${schedule.summary.sessions}</div></div><div class="card metric"><div class="metric__label">Cross-lab</div><div class="metric__value">${schedule.summary.cross_lab_sessions}</div></div></div><div class="stack" style="margin-top:14px"><strong>Exceptions / explanations</strong>${schedule.exceptions.map(e=>`<div class="list-item">${esc(e.message)}</div>`).join('')||'<div class="info-box">No exceptions.</div>'}</div>`);}

function renderRoster(){const content=document.getElementById('page-content');content.innerHTML=`<div class="page-actions page-actions--equal"><button class="button button--primary" id="roster-import">Import Roster CSV</button><button class="button button--secondary" id="roster-reset">Reset Prototype Roster</button></div><input id="roster-file" type="file" accept=".csv" hidden><section id="roster-results"></section>`;document.getElementById('roster-import').addEventListener('click',()=>document.getElementById('roster-file').click());document.getElementById('roster-file').addEventListener('change',importRosterCsv);document.getElementById('roster-reset').addEventListener('click',()=>{localStorage.removeItem('sasj-v05-teachers');toast('Roster reset to 2026 seed data.');drawRoster();});drawRoster();}
function drawRoster(){const target=document.getElementById('roster-results');target.innerHTML=`<div class="roster-grid">${teachers().map(t=>`<button class="card roster-card" data-teacher-id="${t.id}"><h3>${esc(t.name)}</h3><div class="roster-card__email">${esc(t.email)}</div><div class="tag-list">${(t.classes||[]).length?(t.classes||[]).map(c=>`<span class="tag">${esc(c)}</span>`).join(''):'<span class="tag">Ad-hoc / no mainstream class</span>'}</div>${(t.roles||[]).includes('science_hod')?'<div class="roster-role"><span class="status status--info">HOD / SH</span></div>':''}</button>`).join('')}</div>`;target.querySelectorAll('[data-teacher-id]').forEach(b=>b.addEventListener('click',()=>editTeacher(b.dataset.teacherId)));}
function editTeacher(id){const arr=teachers(),t=arr.find(x=>x.id===id);if(!t)return;const classBoxes=data().classes.map(c=>`<label class="class-link-option"><input type="checkbox" data-class-link="${esc(c)}" ${(t.classes||[]).includes(c)?'checked':''}> ${esc(c)}</label>`).join('');modal(`Edit ${t.name}`,`<div class="stack"><label class="field"><span>Email</span><input id="teacher-email" value="${esc(t.email)}"></label><div><strong>Linked mainstream classes</strong><p class="small">A class can be linked to a maximum of two Science teachers.</p><div class="class-link-grid">${classBoxes}</div></div></div>`,`<button class="button button--ghost" data-close-modal>Cancel</button><button class="button button--primary" id="save-teacher">Save</button>`);document.getElementById('save-teacher').addEventListener('click',()=>{const selected=[...document.querySelectorAll('[data-class-link]:checked')].map(x=>x.dataset.classLink),others=arr.filter(x=>x.id!==id);for(const c of selected){if(others.filter(x=>(x.classes||[]).includes(c)).length>=2){toast(`${c} already has two linked teachers.`);return;}}t.email=document.getElementById('teacher-email').value.trim();t.classes=selected;writeLocal('sasj-v05-teachers',arr);closeModal();toast('Teacher roster updated.');drawRoster();});}
function importRosterCsv(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const lines=reader.result.split(/\r?\n/).filter(Boolean);if(lines.length<2){toast('CSV appears empty.');return;}const header=lines[0].split(',').map(x=>x.trim().toLowerCase()),ni=header.indexOf('teacher_name'),ei=header.indexOf('email'),ci=header.indexOf('class');if(ni<0||ei<0||ci<0){toast('CSV needs teacher_name,email,class columns.');return;}const map=new Map();for(const line of lines.slice(1)){const cols=line.split(',').map(x=>x.trim());if(!cols[ni])continue;const key=cols[ni];if(!map.has(key))map.set(key,{id:key.toLowerCase().replace(/\s+/g,'-'),name:key,email:cols[ei],classes:[],roles:['science_teacher'],active:true});if(cols[ci]&&data().classes.includes(cols[ci]))map.get(key).classes.push(cols[ci]);}writeLocal('sasj-v05-teachers',[...map.values()]);toast('Roster CSV imported. Review class links.');drawRoster();};reader.readAsText(file);}

function renderSettings(){const s=settings(),content=document.getElementById('page-content');content.innerHTML=`<section class="card"><div class="card__header"><h2>Operational rules</h2></div><div class="card__body"><div class="form-grid admin-settings-grid"><label class="field"><span>Pre-assigned confirmation deadline</span><input id="set-deadline" type="time" value="${esc(s.confirmation_deadline)}"></label><label class="field"><span>Preparation buffer</span><select id="set-buffer"><option value="30">30 minutes (1 period)</option><option value="0">No preferred buffer</option></select></label><label class="field"><span>Photo maximum dimension</span><select id="set-photo"><option value="800">800 px</option><option value="1000">1000 px</option><option value="1200">1200 px</option></select></label><label class="field"><span>Email confirmation reminder</span><select id="set-email"><option value="false">Planned / not active in prototype</option><option value="true">Enable in production when email service is configured</option></select></label></div><div class="warning-box" style="margin-top:14px">Auto-release applies <strong>only</strong> to pre-assigned recurring sessions that remain unconfirmed by the previous-day deadline. Approved ad-hoc, workshop, event and PSLE bookings are not auto-released.</div><div class="page-actions page-actions--equal" style="margin-top:14px"><button class="button button--primary" id="save-settings">Save Prototype Settings</button></div></div></section><section class="card prototype-controls"><div class="card__header"><h2>Prototype controls</h2></div><div class="card__body"><p class="small">Restore the original requests, inventory, roster and confirmation states after a demonstration.</p><button class="button button--danger" id="reset-demo">Reset All Demo Data</button></div></section>`;document.getElementById('set-buffer').value=String(s.buffer_period_minutes);document.getElementById('set-photo').value=String(s.photo_max_dimension);document.getElementById('set-email').value=String(s.email_reminders_enabled);document.getElementById('save-settings').addEventListener('click',()=>{s.confirmation_deadline=document.getElementById('set-deadline').value;s.buffer_period_minutes=Number(document.getElementById('set-buffer').value);s.photo_max_dimension=Number(document.getElementById('set-photo').value);s.email_reminders_enabled=document.getElementById('set-email').value==='true';writeLocal('sasj-v05-settings',s);toast('Prototype settings saved.');});document.getElementById('reset-demo').addEventListener('click',()=>{if(!confirm('Reset all browser-local prototype changes?'))return;clearPrototypeData();toast('Prototype data reset.');navigate('dashboard');});}

function modal(title,body,footer=''){const root=document.getElementById('modal-root');root.innerHTML=`<div class="modal-backdrop"><section class="modal"><header class="modal__header"><h2>${esc(title)}</h2><button class="icon-button" data-close-modal>×</button></header><div class="modal__body">${body}</div>${footer?`<footer class="modal__footer">${footer}</footer>`:''}</section></div>`;root.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));root.querySelector('.modal-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});}
function closeModal(){document.getElementById('modal-root').innerHTML='';}

if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
init();
