// ===== Instructor portal: account, trial/subscription, classes, live results, invites (admin) =====
const APP = (typeof CONFIG!=='undefined' && CONFIG.appName) || 'CivilQuest';
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const starStr=(n,of=3)=>Array.from({length:of},(_,i)=>`<span class="star ${i<n?'':'off'}">★</span>`).join('');
const main = $('main');
const appUrl = () => (CONFIG.appUrl || location.href.replace(/portal\.html.*$/,''));
const isAdmin = u => !!u && (CONFIG.adminUids||[]).includes(u.uid);
const fmtDate = d => d ? d.toLocaleDateString([], {day:'numeric', month:'short', year:'numeric'}) : '';

// Mistake labels for every course
const LABELS = {};
Object.values(window.COURSES||{}).forEach(C=>{ const L=Object.assign({}, C.labels||{}); C.levels.forEach(lv=>C.buildSteps(lv).forEach(x=>{
  (x.options||[]).forEach((o,k)=>{ if(o.lab) L[`${x.key}-${k}`]=o.lab; });
  (x.traps||[]).forEach(t=>{ if(t.lab) L[t.id]=t.lab; });
  if (x.type==='num' && !L['arith-'+x.key]) L['arith-'+x.key]='Other error: '+x.title;
  if (x.missLab) L[x.key+'-miss']=x.missLab;
  if (x.type==='match' && x.lab) L[x.key+'-wrong']=x.lab;
})); LABELS[C.id]=L; });

const configured = typeof CONFIG!=='undefined' && CONFIG.firebase && CONFIG.firebase.apiKey && !/PASTE/.test(CONFIG.firebase.apiKey) && typeof firebase!=='undefined';
let auth, db, USER=null, PROFILE=null, CLAIMS={}, unsub=null, unsubClasses=null, SIGNING_UP=false, unsubAdmin=null;
const stopAdmin=()=>{ if(unsubAdmin){ unsubAdmin(); unsubAdmin=null; } };

function topbar(){
  $('who').innerHTML = USER && !USER.isAnonymous
    ? `<span class="note">${esc(USER.email||'')}</span><button class="btn ghost" id="signout" type="button">Sign out</button>` : '';
  const so=$('signout'); if (so) so.onclick=()=>auth.signOut();
}

// ---- Access: subscription (Stripe custom claim), invited trial, or admin ----
function access(){
  if (isAdmin(USER)) return {ok:true, label:'Administrator', kind:'admin'};
  if (CLAIMS.stripeRole === 'instructor') return {ok:true, label:'Subscription active', kind:'paid'};
  if (PROFILE && PROFILE.status==='trial' && PROFILE.trialEnds && PROFILE.trialEnds.toDate() > new Date())
    return {ok:true, label:`Free trial until ${fmtDate(PROFILE.trialEnds.toDate())}`, kind:'trial'};
  if (PROFILE && PROFILE.status==='trial') return {ok:false, label:'Trial ended', kind:'ended'};
  return {ok:false, label:'No active plan', kind:'none'};
}

// ---- Sign in / create account ----
function renderAuth(mode='signin', msg=''){
  main.innerHTML = `
  <section class="card signin">
    <div class="tabs"><button class="tab ${mode==='signin'?'on':''}" id="t-in" type="button">Sign in</button><button class="tab ${mode==='signup'?'on':''}" id="t-up" type="button">Create instructor account</button></div>
    ${mode==='signin' ? `
    <form id="f-in" class="opts">
      <label class="field"><span>Email</span><input id="in-email" type="email" autocomplete="username" required></label>
      <label class="field"><span>Password</span><input id="in-pass" type="password" autocomplete="current-password" required></label>
      <div class="row"><button class="btn" type="submit">Sign in</button><button class="linkbtn" id="forgot" type="button">Forgot password?</button></div>
    </form>` : `
    <form id="f-up" class="opts">
      <label class="field"><span>Full name</span><input id="up-name" autocomplete="name" required maxlength="80"></label>
      <label class="field"><span>Institution</span><input id="up-inst" autocomplete="organization" required maxlength="120"></label>
      <label class="field"><span>Email</span><input id="up-email" type="email" autocomplete="username" required></label>
      <label class="field"><span>Password (at least 8 characters)</span><input id="up-pass" type="password" autocomplete="new-password" minlength="8" required></label>
      <label class="field"><span>Invite code (optional, for a free trial)</span><input id="up-invite" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20"></label>
      <div class="row"><button class="btn" type="submit">Create account</button></div>
      <p class="note">Without an invite code, your account is created and you can subscribe when paid plans open.</p>
    </form>`}
    <p class="note" id="amsg" role="alert">${esc(msg)}</p>
  </section>`;
  $('t-in').onclick=()=>renderAuth('signin'); $('t-up').onclick=()=>renderAuth('signup');
  if (mode==='signin'){
    $('f-in').onsubmit=async e=>{ e.preventDefault(); $('amsg').textContent='Signing in…';
      try { await auth.signInWithEmailAndPassword($('in-email').value.trim(), $('in-pass').value); }
      catch(err){ $('amsg').textContent = /invalid|wrong-password|user-not-found/.test(err.code||'') ? 'Email or password is incorrect.' : 'Sign-in failed: '+(err.message||err.code); } };
    $('forgot').onclick=async()=>{ const em=$('in-email').value.trim(); if(!em){ $('amsg').textContent='Enter your email first, then tap Forgot password.'; return; }
      try { await auth.sendPasswordResetEmail(em); $('amsg').textContent='Check your email for a link to reset your password.'; } catch(err){ $('amsg').textContent='Could not send the reset email: '+(err.message||err.code); } };
  } else {
    $('f-up').onsubmit=async e=>{ e.preventDefault(); const m=$('amsg');
      const name=$('up-name').value.trim(), inst=$('up-inst').value.trim(), email=$('up-email').value.trim(), pass=$('up-pass').value, invite=$('up-invite').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');
      if (pass.length<8){ m.textContent='Use a password of at least 8 characters.'; return; }
      m.textContent='Creating your account…';
      SIGNING_UP=true;
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        USER = cred.user; topbar();
        await createProfile(cred.user, name, inst, invite);
        SIGNING_UP=false;
      } catch(err){
        SIGNING_UP=false;
        if (USER && PROFILE){ renderHome(); const n=document.createElement('p'); n.className='fb mid'; n.textContent=err.message; main.prepend(n); return; }
        m.textContent = err.code==='auth/email-already-in-use' ? 'An account with this email already exists. Sign in instead.'
          : err.code==='invite' ? err.message : 'Could not create the account: '+(err.message||err.code);
      } };
  }
}

async function createProfile(user, name, inst, invite){
  const ref = db.collection('instructors').doc(user.uid);
  const base = {name, institution:inst, email:user.email, createdAt: firebase.firestore.FieldValue.serverTimestamp()};
  if (invite){
    const inv = await db.collection('invites').doc(invite).get().catch(()=>null);
    if (!inv || !inv.exists || inv.data().usedBy){
      await ref.set({...base, status:'none'});
      const e=new Error('Your account was created, but that invite code is not valid or has already been used. Ask for a new code.'); e.code='invite'; PROFILE=(await ref.get()).data(); throw e;
    }
    const days = inv.data().trialDays||90;
    const ends = new Date(Date.now() + days*86400000 - 60000);
    const batch = db.batch();
    batch.set(ref, {...base, status:'trial', invite, trialEnds: firebase.firestore.Timestamp.fromDate(ends)});
    batch.update(db.collection('invites').doc(invite), {usedBy:user.uid, usedAt: firebase.firestore.FieldValue.serverTimestamp()});
    await batch.commit();
  } else {
    await ref.set({...base, status:'none'});
  }
  PROFILE = (await ref.get()).data(); renderHome();
}

// ---- Home: plan + classes ----
function renderHome(){
  if (unsub){ unsub(); unsub=null; } stopAdmin();
  const a = access();
  main.innerHTML = `
  <section class="card">
    <div class="row" style="justify-content:space-between;align-items:center">
      <div><h4>Your account</h4><h2 class="sectitle">${esc((PROFILE&&PROFILE.name)||USER.email)}</h2><span class="note">${esc((PROFILE&&PROFILE.institution)||'')}</span></div>
      <span class="pill ${a.ok?'':(a.kind==='ended'?'off':'warn')}">${esc(a.label)}</span>
    </div>
    ${a.ok ? '' : `<p class="fb mid">${a.kind==='ended'?'Your free trial has ended.':'You don’t have an active plan yet.'} ${CONFIG.subscribeUrl?`<a href="${esc(CONFIG.subscribeUrl)}" target="_blank" rel="noopener">Subscribe</a> to create classes.`:'Paid plans are opening soon. If a colleague invited you, enter your invite code below.'}</p>
      <form id="f-inv" class="row"><label class="field"><span>Invite code</span><input id="inv-code" autocomplete="off" autocapitalize="characters" maxlength="20"></label><button class="btn" type="submit" style="align-self:flex-end">Activate trial</button></form><p class="note" id="invmsg"></p>`}
  </section>
  ${isAdmin(USER)?`<div class="row"><button class="btn ghost" id="admin" type="button">Manage invite codes</button></div>`:''}
  <section class="card">
    <div class="row" style="justify-content:space-between;align-items:center"><h4>Your classes</h4>${a.ok?'<button class="btn" id="newclass" type="button">New class</button>':''}</div>
    <div id="newform" hidden>
      <form id="f-class" class="opts">
        <label class="field"><span>Class name</span><input id="c-name" maxlength="80" placeholder="e.g. Air pollution control, Section 2" required></label>
        <label class="field"><span>Course</span><select id="c-course">${Object.values(window.COURSES||{}).map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></label>
        <div class="row"><button class="btn" type="submit">Create class</button><button class="btn ghost" id="c-cancel" type="button">Cancel</button></div>
        <p class="note" id="cmsg"></p>
      </form>
    </div>
    <div class="classlist" id="classes"><p class="note">Loading your classes…</p></div>
  </section>`;
  const ad=$('admin'); if(ad) ad.onclick=renderAdmin;
  const nc=$('newclass'); if(nc) nc.onclick=()=>{ $('newform').hidden=false; $('c-name').focus(); };
  const cc=$('c-cancel'); if(cc) cc.onclick=()=>{ $('newform').hidden=true; };
  const fc=$('f-class'); if(fc) fc.onsubmit=async e=>{ e.preventDefault(); await createClass($('c-name').value.trim(), $('c-course').value); };
  const fi=$('f-inv'); if(fi) fi.onsubmit=async e=>{ e.preventDefault(); const code=$('inv-code').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');
    $('invmsg').textContent='Checking…';
    try { await redeemInvite(code); renderHome(); } catch(err){ $('invmsg').textContent = err.code==='invite'? err.message : 'Could not activate: '+(err.message||err.code); } };
  watchClasses();
}

async function redeemInvite(code){
  const inv = await db.collection('invites').doc(code).get().catch(()=>null);
  if (!inv || !inv.exists || inv.data().usedBy){ const e=new Error('That invite code is not valid or has already been used.'); e.code='invite'; throw e; }
  const ends = new Date(Date.now() + (inv.data().trialDays||90)*86400000 - 60000);
  const ref = db.collection('instructors').doc(USER.uid);
  const batch = db.batch();
  batch.update(ref, {status:'trial', invite:code, trialEnds: firebase.firestore.Timestamp.fromDate(ends)});
  batch.update(db.collection('invites').doc(code), {usedBy:USER.uid, usedAt: firebase.firestore.FieldValue.serverTimestamp()});
  await batch.commit();
  PROFILE = (await ref.get()).data();
}

function watchClasses(){
  if (unsubClasses) unsubClasses();
  unsubClasses = db.collection('classes').where('ownerUid','==',USER.uid).onSnapshot(snap=>{
    const el=$('classes'); if(!el) return;
    const list=snap.docs.map(d=>({code:d.id, ...d.data()})).sort((a,b)=>(b.createdAt&&b.createdAt.seconds||0)-(a.createdAt&&a.createdAt.seconds||0));
    el.innerHTML = list.length ? list.map(c=>{ const C=(window.COURSES||{})[c.course];
      return `<button class="classcard" data-code="${esc(c.code)}" type="button"><span class="eyebrow">${esc(C?C.title:c.course)}</span><h3>${esc(c.name)}</h3>
        <span class="row" style="justify-content:space-between"><span class="mono">${esc(c.code)}</span><span class="pill ${c.active===false?'off':''}">${c.active===false?'Closed':'Open'}</span></span></button>`; }).join('')
      : `<p class="note">No classes yet. ${access().ok?'Create one to get a class code for your students.':''}</p>`;
    el.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>renderClass(list.find(c=>c.code===b.dataset.code)));
  }, err=>{ const el=$('classes'); if(el) el.innerHTML=`<p class="note">Could not load classes: ${esc(err.message||err.code)}</p>`; });
}

const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), n=>CODE_CHARS[n%CODE_CHARS.length]).join('');
async function createClass(name, course){
  const m=$('cmsg'); if(!name){ m.textContent='Give the class a name.'; return; }
  m.textContent='Creating…';
  for (let i=0;i<5;i++){
    const code=newCode();
    try {
      await db.collection('classes').doc(code).set({ownerUid:USER.uid, name, course, active:true, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
      $('newform').hidden=true; m.textContent=''; return;
    } catch(err){ if (err.code!=='permission-denied' || i===4){ m.textContent='Could not create the class: '+(err.message||err.code); return; } }
  }
}

// ---- One class: share code + live results ----
let CLS=null, ROWS=[];
function renderClass(c){
  CLS=c; const C=(window.COURSES||{})[c.course];
  const link = appUrl()+'?class='+encodeURIComponent(c.code);
  main.innerHTML = `
  <div class="row"><button class="btn ghost" id="back" type="button">← Your classes</button></div>
  <section class="card">
    <span class="eyebrow">${esc(C?C.title:c.course)}</span><h2 class="sectitle">${esc(c.name)}</h2>
    <div class="sharebox">
      <div class="qr" id="qr" aria-label="QR code that opens the app with this class code"></div>
      <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
        <span class="note">Class code</span><span class="bigcode">${esc(c.code)}</span>
        <span class="note">Students enter this code in the ${esc(APP)} app, or scan the QR code.</span>
        <div class="codebox"><code id="jl">${esc(link)}</code><button class="btn ghost" id="copyl" type="button">Copy link</button></div>
        <div class="row"><span class="pill ${c.active===false?'off':''}">${c.active===false?'Closed to new results':'Open'}</span><button class="linkbtn" id="toggle" type="button">${c.active===false?'Reopen class':'Close class'}</button></div>
      </div>
    </div>
  </section>
  <div class="row" style="align-items:center;justify-content:space-between"><h2 class="sectitle">Results</h2><div class="row" style="align-items:center"><span class="live" id="live" hidden><i></i>Live</span><button class="btn ghost" id="dl" type="button">Download results (.csv)</button></div></div>
  <p class="note" id="status">Loading results…</p>
  <div id="out"></div>`;
  $('back').onclick=()=>{ if(unsub){unsub();unsub=null;} renderHome(); };
  try { new QRCode($('qr'), {text:link, width:300, height:300, colorDark:'#13242E', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.M}); } catch(e){ $('qr').hidden=true; }
  $('copyl').onclick=async()=>{ try{ await navigator.clipboard.writeText(link); $('copyl').textContent='Copied'; }catch(e){ const r=document.createRange(); r.selectNodeContents($('jl')); const s=getSelection(); s.removeAllRanges(); s.addRange(r); } };
  $('toggle').onclick=async()=>{ try { await db.collection('classes').doc(c.code).update({active: c.active===false}); c.active = c.active===false; renderClass(c); } catch(e){ $('status').textContent='Could not change the class: '+(e.message||e.code); } };
  $('dl').onclick=downloadCsv;
  if (unsub) unsub();
  unsub = db.collection('attempts').where('ownerUid','==',USER.uid).where('classCode','==',c.code).onSnapshot(snap=>{
    ROWS = snap.docs.map(d=>{ const x=d.data(); return {name:String(x.name||'').trim()||'Student', course:x.course, chapter:x.chapter, level:x.level|0, stars:x.stars|0, mistakes:x.mistakes|0, slips:x.slips||{}, at:x.at&&x.at.toDate?x.at.toDate():null}; });
    $('live').hidden=false; renderResults();
  }, err=>{ $('status').textContent='Could not load results: '+(err.message||err.code); });
}

function renderResults(){
  const C=(window.COURSES||{})[CLS.course]; const labels=LABELS[CLS.course]||{};
  if (!C){ $('status').textContent='This class uses a course this portal doesn’t have.'; return; }
  const key = n => n.toLowerCase().replace(/\s+/g,' ');
  const students={};
  ROWS.forEach(r=>{ const k=key(r.name); const s=students[k]=students[k]||{name:r.name, levels:{}, last:null}; const l=s.levels[r.level]=s.levels[r.level]||{stars:0,attempts:0}; l.stars=Math.max(l.stars,r.stars); l.attempts++; if(r.at&&(!s.last||r.at>s.last)) s.last=r.at; });
  const list=Object.values(students).sort((a,b)=>a.name.localeCompare(b.name));
  const tally={}; ROWS.forEach(r=>Object.entries(r.slips).forEach(([k,c])=>{ const t=tally[k]=tally[k]||{count:0,students:new Set(),levels:new Set()}; t.count+=(c|0)||1; t.students.add(key(r.name)); t.levels.add(r.level); }));
  const top=Object.entries(tally).sort((a,b)=>b[1].students.size-a[1].students.size||b[1].count-a[1].count).slice(0,10);
  const maxS=top.length?top[0][1].students.size:1;
  const lname = id => { const L=C.levels.find(l=>l.id===id); return L?L.name:('Level '+id); };
  $('status').textContent = ROWS.length ? `${ROWS.length} results from ${list.length} students. Updates live as students play.` : 'No results yet. They appear here the moment a student finishes a level.';
  $('out').innerHTML = `
  <div class="casegrid">
    <div class="kv"><b>${list.length}</b><span>students</span></div>
    ${C.chapters.map(ch=>{ const ids=C.levels.filter(l=>l.ch===ch.id).map(l=>l.id); const fin=list.filter(s=>ids.every(id=>s.levels[id])).length; const st=list.filter(s=>ids.some(id=>s.levels[id])).length; const all=[]; list.forEach(s=>ids.forEach(id=>{ if(s.levels[id]) all.push(s.levels[id].stars); })); const avg=all.length?all.reduce((a,b)=>a+b,0)/all.length:0;
      return `<div class="kv"><b>${fin} / ${st} · ${all.length?avg.toFixed(1)+'★':'–'}</b><span>${esc(ch.title)}: finished / started</span></div>`; }).join('')}
  </div>
  <section class="card" style="margin-top:16px"><h4>Most common mistakes</h4>
    ${top.length?`<ul class="bars">${top.map(([k,v])=>`<li><div class="barlab"><span>${esc(labels[k]||k)}</span><b>${v.students.size} ${v.students.size===1?'student':'students'}</b></div><div class="bar"><i style="width:${(v.students.size/maxS*100).toFixed(0)}%"></i></div><small class="note">${[...v.levels].sort((a,b)=>a-b).map(l=>esc(lname(l))).join(', ')} · ${v.count} ${v.count===1?'time':'times'} in total</small></li>`).join('')}</ul>`:'<p class="note">No mistakes recorded yet.</p>'}
  </section>
  <section class="card" style="margin-top:16px"><h4>Students</h4>
    ${list.length?`<div class="tablewrap"><table class="roster"><thead><tr><th></th>${C.chapters.map(ch=>`<th class="chgroup" colspan="${C.levels.filter(l=>l.ch===ch.id).length}">${esc(ch.title)}</th>`).join('')}<th></th></tr>
      <tr><th>Student</th>${C.chapters.map(ch=>C.levels.filter(l=>l.ch===ch.id).map((l,k)=>`<th title="${esc(l.name)}">${k+1}</th>`).join('')).join('')}<th>Last active</th></tr></thead><tbody>
      ${list.map(s=>`<tr><td>${esc(s.name)}</td>${C.chapters.map(ch=>C.levels.filter(l=>l.ch===ch.id).map(l=>{ const v=s.levels[l.id]; return `<td>${v?`<span title="${v.attempts} attempt(s)">${starStr(v.stars)}</span>`:'<span class="note">–</span>'}</td>`; }).join('')).join('')}<td class="note">${s.last?s.last.toLocaleString([], {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</td></tr>`).join('')}
      </tbody></table></div>`:'<p class="note">No students yet.</p>'}
  </section>`;
}

function downloadCsv(){
  const C=(window.COURSES||{})[CLS.course]; const labels=LABELS[CLS.course]||{};
  const q=v=>`"${String(v).replace(/"/g,'""')}"`; const z=n=>String(n).padStart(2,'0');
  const stamp=d=>`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
  const lines=[['Time','Student','Chapter','Level','Level name','Stars','Mistakes','Mistake codes','Mistake descriptions'].map(q).join(',')];
  ROWS.slice().sort((a,b)=>(a.at||0)-(b.at||0)).forEach(r=>{ const L=C&&C.levels.find(l=>l.id===r.level); const ch=C&&C.chapters.find(c=>c.id===r.chapter);
    lines.push([r.at?stamp(r.at):'', r.name, ch?ch.title:r.chapter, r.level, L?L.name:'', r.stars, r.mistakes, Object.entries(r.slips).map(([k,v])=>`${k}:${v}`).join(';'), Object.keys(r.slips).map(k=>labels[k]||k).join('; ')].map(q).join(',')); });
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${APP}-${CLS.code}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

// ---- Admin: invite codes for colleagues ----
function renderAdmin(){
  if (unsub){ unsub(); unsub=null; }
  main.innerHTML = `
  <div class="row"><button class="btn ghost" id="back" type="button">← Home</button></div>
  <section class="card">
    <h4>Invite colleagues</h4>
    <p class="prompt">Each invite code gives one instructor a free trial. Share it privately; it works once.</p>
    <form id="f-new" class="row">
      <label class="field"><span>Trial length (days)</span><input id="n-days" type="number" min="7" max="365" value="90"></label>
      <label class="field" style="flex:1;min-width:12rem"><span>Note (who it’s for)</span><input id="n-note" maxlength="80" placeholder="e.g. Dr. Sara, Civil Eng."></label>
      <button class="btn" type="submit" style="align-self:flex-end">Create invite code</button>
    </form>
    <p class="note" id="nmsg"></p>
  </section>
  <section class="card"><h4>Invite codes</h4><div class="tablewrap" id="invs"><p class="note">Loading…</p></div></section>`;
  $('back').onclick=renderHome;
  $('f-new').onsubmit=async e=>{ e.preventDefault(); const days=Math.max(7,Math.min(365,parseInt($('n-days').value)||90)); const note=$('n-note').value.trim();
    const code='INV-'+newCode();
    try { await db.collection('invites').doc(code).set({trialDays:days, note, usedBy:null, createdAt: firebase.firestore.FieldValue.serverTimestamp()}); $('nmsg').innerHTML=`Created <b class="mono">${code}</b>. Send it to your colleague with the portal link.`; $('n-note').value=''; }
    catch(err){ $('nmsg').textContent='Could not create the code: '+(err.message||err.code); } };
  stopAdmin();
  unsubAdmin = db.collection('invites').onSnapshot(snap=>{
    const el=$('invs'); if(!el) return;
    const rows=snap.docs.map(d=>({code:d.id,...d.data()})).sort((a,b)=>(b.createdAt&&b.createdAt.seconds||0)-(a.createdAt&&a.createdAt.seconds||0));
    el.innerHTML = rows.length?`<table class="roster"><thead><tr><th>Code</th><th>For</th><th>Trial</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="mono">${esc(r.code)}</td><td>${esc(r.note||'')}</td><td>${r.trialDays} days</td><td>${r.usedBy?'<span class="pill">Used</span>':'<span class="pill warn">Unused</span>'}</td></tr>`).join('')}</tbody></table>`:'<p class="note">No invite codes yet.</p>';
  }, err=>{ const el=$('invs'); if(el) el.innerHTML=`<p class="note">Could not load invites: ${esc(err.message||err.code)}</p>`; });
}

// ---- Start ----
if (!configured){ main.innerHTML='<p class="fb mid">Firebase isn’t set up yet. Fill in config.js.</p>'; }
else {
  firebase.initializeApp(CONFIG.firebase); auth=firebase.auth(); db=firebase.firestore();
  auth.onAuthStateChanged(async u=>{
    if (unsub){ unsub(); unsub=null; } if (unsubClasses){ unsubClasses(); unsubClasses=null; } stopAdmin();
    USER = (u && !u.isAnonymous) ? u : null; topbar();
    if (SIGNING_UP) return;   // sign-up flow renders the account itself
    if (!USER){ PROFILE=null; return renderAuth('signin'); }
    try { const t=await USER.getIdTokenResult(); CLAIMS=t.claims||{}; } catch(e){ CLAIMS={}; }
    main.innerHTML='<p class="note">Loading your account…</p>';
    try {
      const snap = await db.collection('instructors').doc(USER.uid).get();
      if (snap.exists){ PROFILE=snap.data(); return renderHome(); }
      renderFinishProfile();
    } catch(e){ main.innerHTML=`<p class="fb bad">Could not load your account: ${esc(e.message||e.code)}</p>`; }
  });
}

function renderFinishProfile(){
  main.innerHTML = `
  <section class="card signin">
    <h4>Finish your profile</h4>
    <form id="f-fp" class="opts">
      <label class="field"><span>Full name</span><input id="fp-name" required maxlength="80"></label>
      <label class="field"><span>Institution</span><input id="fp-inst" required maxlength="120"></label>
      <label class="field"><span>Invite code (optional)</span><input id="fp-inv" maxlength="20" autocapitalize="characters"></label>
      <div class="row"><button class="btn" type="submit">Save</button></div>
      <p class="note" id="fpmsg"></p>
    </form>
  </section>`;
  $('f-fp').onsubmit=async e=>{ e.preventDefault();
    try { await createProfile(USER, $('fp-name').value.trim(), $('fp-inst').value.trim(), $('fp-inv').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'')); }
    catch(err){ $('fpmsg').textContent = err.code==='invite' ? err.message : 'Could not save: '+(err.message||err.code); if (err.code==='invite') setTimeout(renderHome, 2500); } };
}
