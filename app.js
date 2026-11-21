// ===== Platform app: role choice, class join, courses, chapters, levels =====
const APP = (typeof CONFIG!=='undefined' && CONFIG.appName) || 'CivilQuest';
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const starStr = (n, of=3) => Array.from({length:of},(_,i)=>`<span class="star ${i<n?'':'off'}">★</span>`).join('');
function fmt(v){ if (v === null || v === undefined || isNaN(v)) return '?'; const a = Math.abs(v); return (a !== 0 && a < 0.001) ? v.toExponential(3) : (a >= 100 ? v.toFixed(2) : v.toPrecision(5)); }
const store = { get(k, d){ try { const v = localStorage.getItem('cq-'+k); return v===null ? d : JSON.parse(v); } catch(e){ return d; } },
                set(k, v){ try { localStorage.setItem('cq-'+k, JSON.stringify(v)); } catch(e){} } };

// Course-specific physics used by the condenser screens (set when a course opens)
let COURSE = null, COOLANTS = [], TMIN = 0, TMAX = 0, P0 = 1, Psat = ()=>0, Tof = ()=>0, yOut = ()=>0;
function openCourse(id){
  COURSE = (window.COURSES||{})[id]; if (!COURSE) return false;
  COOLANTS = COURSE.coolants || [];
  if (COURSE.physics) ({TMIN, TMAX, P0, Psat, Tof, yOut} = COURSE.physics);
  buildLabels(); return true;
}

let PROFILE = store.get('profile', null);   // {role, name, classCode, className, ownerUid, courseId}
const saveProfile = () => store.set('profile', PROFILE);
let stars = {};
const loadStars = () => { stars = store.get('stars-'+COURSE.id, {}) || {}; };
const saveStars = () => store.set('stars-'+COURSE.id, stars);
let S = null; let view = 'role';

let SLIP_LABELS = {};
function buildLabels(){
  SLIP_LABELS = {};
  COURSE.levels.forEach(L=>{ COURSE.buildSteps(L).forEach(x=>{
    (x.options||[]).forEach((o,k)=>{ if(o.lab) SLIP_LABELS[`${x.key}-${k}`]=o.lab; });
    (x.traps||[]).forEach(t=>{ if(t.lab) SLIP_LABELS[t.id]=t.lab; });
    if (x.missLab) SLIP_LABELS[x.key+'-miss']=x.missLab;
  }); });
}

// ---- Firebase: students sign in anonymously; results go to their instructor's class ----
const FB = { ready:false, db:null, uid:null, error:null, refused:false };
const fbConfigured = () => typeof CONFIG!=='undefined' && CONFIG.firebase && CONFIG.firebase.apiKey && !/PASTE/.test(CONFIG.firebase.apiKey) && typeof firebase!=='undefined';
let PENDING = store.get('pending', []) || [];
const savePending = () => store.set('pending', PENDING);
let flushing = false, initing = null;

function initFirebase(){
  if (!fbConfigured()) return Promise.resolve(false);
  if (FB.ready) return Promise.resolve(true);
  if (initing) return initing;
  initing = (async () => {
    try {
      // A separate Firebase app instance keeps the student sign-in apart from an instructor's portal sign-in in the same browser
      const fa = firebase.apps.find(x=>x.name==='student') || firebase.initializeApp(CONFIG.firebase, 'student');
      const cred = await fa.auth().signInAnonymously();
      FB.uid = cred.user.uid; FB.db = fa.firestore(); FB.ready = true; FB.error = null;
      flushPending(); return true;
    } catch(e){ FB.error = e; updateSendStatus(); return false; }
    finally { initing = null; }
  })();
  return initing;
}

function queueResult(r){
  FB.refused = false;
  PENDING.push({id: Date.now().toString(36)+Math.random().toString(36).slice(2,7), ...r});
  savePending(); flushPending();
}

async function flushPending(){
  if (!FB.ready || flushing || !PENDING.length) { updateSendStatus(); return; }
  flushing = true; updateSendStatus();
  while (PENDING.length){
    const r = PENDING[0];
    try {
      await FB.db.collection('attempts').doc(r.id).set({
        classCode:r.classCode, ownerUid:r.ownerUid, name:String(r.name).slice(0,60),
        course:r.course, chapter:r.chapter, level:r.level|0, stars:r.stars|0, mistakes:r.mistakes|0, slips:r.slips||{},
        uid:FB.uid, v:1, at: firebase.firestore.FieldValue.serverTimestamp()
      });
      PENDING.shift(); savePending();
    } catch(e){
      if (e && e.code === 'permission-denied'){ PENDING.shift(); savePending(); FB.refused = true; continue; }   // class closed (or already saved)
      FB.error = e; break;
    }
  }
  flushing = false; updateSendStatus();
}
const retry = () => { if (!PENDING.length || !fbConfigured()) return; if (FB.ready) flushPending(); else initFirebase(); };
window.addEventListener('online', retry);
setInterval(retry, 20000);

function sendStatusHtml(){
  if (!PROFILE || !PROFILE.classCode) return `<p class="note">Practice mode. Join a class to send your results to an instructor.</p>`;
  if (!fbConfigured()) return `<p class="note">Saving isn’t set up on this copy of the app.</p>`;
  if (!PENDING.length && FB.refused) return `<p class="fb mid">${esc(PROFILE.className||'Your class')} isn’t accepting results right now. Your instructor may have closed it. Your stars are still saved on this phone.</p>`;
  if (!PENDING.length) return `<p class="fb ok">Saved. ${esc(PROFILE.className||'Your class')} has this result.</p>`;
  if (flushing || (!FB.ready && !FB.error)) return `<p class="fb hint">Saving your result…</p>`;
  return `<p class="fb mid">No connection right now. Your result is kept on this phone and will send automatically when you’re back online.</p>`;
}
function updateSendStatus(){ const el=document.getElementById('sendstatus'); if(el && S && S.result) el.innerHTML=sendStatusHtml(); }
function wireCopy(){}

// ---- Shared header ----
function header(back){
  return `<header class="top">
    <div class="brand">${back?`<button class="linkbtn backlink" id="backbtn" type="button">← ${esc(back.label)}</button>`:`<span class="eyebrow">Civil engineering, played</span>`}
      <h1>${esc(APP).replace(/^(\w+?)(Quest|Lab|Sim|Play|Arena)$/,'$1<span>$2</span>')}</h1></div>
    <div class="row" style="align-items:center">${PROFILE && PROFILE.role==='student'?`<button class="linkbtn" id="whobtn" type="button" title="Your profile">${esc(PROFILE.name||'Student')}${PROFILE.classCode?` · ${esc(PROFILE.classCode)}`:''}</button>`:''}</div>
  </header>`;
}
function wireHeader(back){
  const b=document.getElementById('backbtn'); if(b && back) b.onclick=back.go;
  const w=document.getElementById('whobtn'); if(w) w.onclick=renderProfile;
}

// ---- 1. Student or instructor ----
function renderRole(){
  view='role'; S=null;
  app.innerHTML = header() + `
  <section class="hero card">
    <h2 class="herotitle">Learn civil engineering by solving real design problems.</h2>
    <p class="intro">Choose how you’ll use ${esc(APP)}.</p>
    <div class="roles">
      <button class="role" id="r-student" type="button"><span class="roleicon" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 4 2 9l10 5 10-5-10-5zm-6 7.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5l-6 3-6-3z" fill="currentColor"/></svg></span><b>I’m a student</b><span>Free. Play the courses and send results to your instructor’s class.</span></button>
      <button class="role" id="r-instructor" type="button"><span class="roleicon" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 4h16v12H4zM2 18h20v2H2zM7 13l3-3 2 2 4-4 1.5 1.5L12 15l-2-2-1.5 1.5z" fill="currentColor"/></svg></span><b>I’m an instructor</b><span>Create classes, share a class code, and see results live on the web.</span></button>
    </div>
  </section>`;
  document.getElementById('r-student').onclick=()=>{ PROFILE = Object.assign({}, PROFILE||{}, {role:'student'}); saveProfile(); (PROFILE.name ? renderCourses() : renderJoin()); };
  document.getElementById('r-instructor').onclick=renderInstructor;
}

function renderInstructor(){
  view='instructor';
  const url = (typeof CONFIG!=='undefined' && CONFIG.portalUrl) || 'portal.html';
  app.innerHTML = header({label:'Back', go:renderRole}) + `
  <section class="card signin">
    <h4>For instructors</h4>
    <h2 class="herotitle">Your classes live on the web</h2>
    <p class="prompt">Instructors manage classes and results in the ${esc(APP)} instructor portal, on any computer.</p>
    <ol class="howto">
      <li>Create your instructor account in the portal.</li>
      <li>Create a class and get its class code.</li>
      <li>Give students the code. Their results appear on your dashboard as they play.</li>
    </ol>
    <a class="btn send" href="${esc(url)}" target="_blank" rel="noopener">Open the instructor portal</a>
    <p class="note">Portal address: <span class="mono">${esc(url.replace(/^https?:\/\//,''))}</span></p>
    <button class="linkbtn" id="tryst" type="button">Try the student app instead</button>
  </section>`;
  wireHeader({label:'Back', go:renderRole});
  document.getElementById('tryst').onclick=()=>{ PROFILE=Object.assign({}, PROFILE||{}, {role:'student'}); saveProfile(); renderJoin(); };
}

// ---- 2. Join a class (class code + name) ----
function renderJoin(err, preCode, preName){
  view='join'; S=null;
  const code = preCode || (PROFILE && PROFILE.classCode) || '';
  app.innerHTML = header({label:'Back', go:renderRole}) + `
  <section class="card signin">
    <h4>Join your class</h4>
    <p class="prompt">Enter the class code from your instructor and your name as your instructor knows you.</p>
    <form id="jform" class="opts" novalidate>
      <label class="field"><span>Class code</span><input id="j-code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" value="${esc(code)}" placeholder="e.g. AQ7K2M"></label>
      <label class="field"><span>Your name</span><input id="j-name" autocomplete="name" maxlength="60" value="${esc(preName!==undefined?preName:((PROFILE&&PROFILE.name)||''))}"></label>
      <p class="fb bad" id="jerr" ${err?'':'hidden'}>${esc(err||'')}</p>
      <div class="row"><button class="btn" type="submit" id="jbtn">Join class</button></div>
    </form>
    <button class="linkbtn" id="practice" type="button">No code? Practise without a class</button>
  </section>`;
  wireHeader({label:'Back', go:renderRole});
  document.getElementById('practice').onclick=()=>{
    const name=document.getElementById('j-name').value.trim();
    PROFILE=Object.assign({}, PROFILE||{}, {role:'student', name:name||'Student', classCode:null, className:null, ownerUid:null}); saveProfile(); renderCourses(); };
  document.getElementById('jform').onsubmit=async e=>{ e.preventDefault();
    const c=document.getElementById('j-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,''), name=document.getElementById('j-name').value.trim().slice(0,60);
    if(!c) return renderJoin('Enter the class code your instructor gave you.', c, name);
    if(!name) return renderJoin('Enter your name so your instructor can find your results.', c, name);
    const btn=document.getElementById('jbtn'); btn.disabled=true; btn.textContent='Checking…';
    if (!fbConfigured()) return renderJoin('Class codes can’t be checked on this copy of the app.', c, name);
    const ok = await initFirebase();
    if (!ok) return renderJoin('No connection. Check your internet and try again.', c, name);
    try {
      const snap = await FB.db.collection('classes').doc(c).get();
      if (!snap.exists) return renderJoin('That class code wasn’t found. Check it with your instructor.', c, name);
      const d = snap.data();
      if (d.active === false) return renderJoin('This class is closed. Ask your instructor for a new code.', c, name);
      PROFILE = {role:'student', name, classCode:c, className:d.name||c, ownerUid:d.ownerUid, courseId:d.course||null}; saveProfile();
      if (PROFILE.courseId && openCourse(PROFILE.courseId)) renderChapters(); else renderCourses();
    } catch(err2){ renderJoin('Couldn’t check the code right now. Try again in a moment.', c, name); }
  };
}

function renderProfile(){
  view='profile'; S=null;
  app.innerHTML = header({label:'Courses', go:renderCourses}) + `
  <section class="card signin">
    <h4>Your profile</h4>
    <div class="kv"><b style="font-family:var(--f-body)">${esc(PROFILE.name||'Student')}</b><span>Name</span></div>
    <div class="kv"><b>${PROFILE.classCode?esc(PROFILE.className)+' · '+esc(PROFILE.classCode):'Practice mode'}</b><span>Class</span></div>
    <div class="row"><button class="btn" id="chg" type="button">${PROFILE.classCode?'Change class or name':'Join a class'}</button><button class="btn ghost" id="sw" type="button">Switch to instructor</button></div>
    ${PENDING.length?`<p class="note">${PENDING.length} result${PENDING.length===1?'':'s'} waiting to send.</p>`:''}
  </section>`;
  wireHeader({label:'Courses', go:renderCourses});
  document.getElementById('chg').onclick=()=>renderJoin();
  document.getElementById('sw').onclick=renderInstructor;
}

// ---- 3. Courses ----
function renderCourses(){
  view='courses'; S=null;
  const list=Object.values(window.COURSES||{});
  const soon=['Water & wastewater treatment','Hydraulics','Geotechnical engineering','Structural analysis','Transportation engineering'];
  app.innerHTML = header() + `
  ${installBanner()}
  <h2 class="sectitle">Choose a course</h2>
  <div class="courses">
    ${list.map(c=>{ const st=store.get('stars-'+c.id,{})||{}; const got=Object.values(st).reduce((a,b)=>a+b,0);
      return `<button class="course" data-c="${c.id}" type="button"><span class="eyebrow">${esc(c.field)}</span><h3>${esc(c.title)}</h3><p>${esc(c.blurb)}</p>
        <span class="row coursemeta"><span>${c.chapters.length} chapters · ${c.levels.length} levels</span><span>${starStr(1,1)} ${got} / ${c.levels.length*3}</span></span></button>`; }).join('')}
    ${soon.map(t=>`<div class="course soon" aria-disabled="true"><span class="eyebrow">Coming soon</span><h3>${t}</h3></div>`).join('')}
  </div>`;
  wireHeader(); wireInstall();
  app.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ if(openCourse(b.dataset.c)) renderChapters(); });
}

// ---- 4. Chapters of a course ----
function renderChapters(){
  view='chapters'; S=null; loadStars();
  const C=COURSE;
  app.innerHTML = header({label:'Courses', go:renderCourses}) + `
  <h2 class="sectitle">${esc(C.title)}</h2>
  <p class="intro">${esc(C.blurb)}</p>
  ${PROFILE&&PROFILE.classCode?'':`<p class="fb hint">Practice mode: results stay on this phone. <button class="linkbtn" id="joinnow" type="button">Join a class</button></p>`}
  <div class="chapters">
    ${C.chapters.map(ch=>{ const ls=C.levels.filter(L=>L.ch===ch.id); const got=ls.reduce((a,L)=>a+(stars[L.id]||0),0); const done=ls.filter(L=>stars[L.id]).length;
      return `<button class="chbtn" data-ch="${ch.id}" type="button">
        <span class="chnum">${ch.n}</span>
        <span class="chtext"><b>${esc(ch.title)}</b><span class="note">${esc(ch.lo)}</span>
          <span class="meter" aria-label="${done} of ${ls.length} levels done"><i style="width:${ls.length?Math.round(done/ls.length*100):0}%"></i></span></span>
        <span class="chstars">${starStr(1,1)} ${got}/${ls.length*3}</span></button>`; }).join('')}
  </div>
  <p class="note">Plant cases are hypothetical teaching exercises. Property data and simplified equipment limits are for learning, not design.</p>`;
  wireHeader({label:'Courses', go:renderCourses});
  const j=document.getElementById('joinnow'); if(j) j.onclick=()=>renderJoin();
  app.querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>renderChapter(b.dataset.ch));
}

// ---- 5. Inside a chapter: its levels ----
function renderChapter(chId){
  view='chapter'; S=null;
  const ch=COURSE.chapters.find(c=>c.id===chId); const ls=COURSE.levels.filter(L=>L.ch===chId);
  app.innerHTML = header({label:COURSE.title, go:renderChapters}) + `
  <div class="chhead"><span class="chnum">${ch.n}</span><div class="chtext"><h2>${esc(ch.title)}</h2><span class="note">${esc(ch.lo)}</span></div></div>
  <div class="levels">${ls.map((L,k)=>`
    <button class="lvl" data-l="${L.id}" type="button">
      <span class="num">Level ${k+1} · ${esc(L.tag)}</span>
      <h3>${esc(L.name)}</h3>
      <p>${L.brief}</p>
      <span class="case">${L.kind ? `y<sub>in</sub> = ${L.yin} · η = ${L.eta} · P = ${L.P} bar` : esc(L.tagline||'')}</span>
      <span class="stars">${starStr(stars[L.id]||0)}</span>
    </button>`).join('')}</div>`;
  wireHeader({label:COURSE.title, go:renderChapters});
  app.querySelectorAll('.lvl').forEach(b=>b.onclick=()=>startLevel(+b.dataset.l));
  window.scrollTo({top:0});
}

function startLevel(id){
  const L = COURSE.levels.find(l=>l.id===id); if(!L) return renderChapters();
  view='level';
  S = {L, steps:COURSE.buildSteps(L), i:0, tries:0, mistakes:0, slips:{}, vals:{}, done:[], coolant:null, frost:false, fb:'', locked:false, sel:{}};
  renderLevel();
  window.scrollTo({top:0});
}

function schematic(){
  const {L, vals, coolant, frost} = S;
  const cc = coolant ? `var(--c-${coolant.id})` : 'var(--line)';
  const outTxt = vals.yout !== undefined ? `y_out = ${fmt(vals.yout)}` : 'y_out = ?';
  const recovered = vals.T !== undefined || S.done.includes('valid') || S.done.includes('feasible');
  return `<svg viewBox="0 0 360 190" role="img" aria-label="Surface condenser schematic">
    <line x1="8" y1="78" x2="92" y2="78" stroke="var(--hot)" stroke-width="7" class="flow"/>
    <text x="8" y="64" class="svgtext">Gas in</text><text x="8" y="100" class="svgmuted">y_in = ${L.yin}</text>
    <line x1="268" y1="78" x2="352" y2="78" stroke="var(--cold)" stroke-width="7" class="flow"/>
    <text x="276" y="64" class="svgtext">Gas out</text><text x="276" y="100" class="svgmuted">${outTxt}</text>
    <rect x="90" y="44" width="180" height="68" rx="34" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>
    ${[56,66,78,90,100].map(y=>`<line x1="112" y1="${y}" x2="248" y2="${y}" stroke="${cc}" stroke-width="2.5"/>`).join('')}
    <g ${frost?'':'hidden'}>${[0,1,2,3,4,5,6,7,8].map(k=>`<path d="M${118+k*15} 52 l4 8 l-4 8 l4 8 l-4 8 l4 8 l-4 8" stroke="var(--frost)" stroke-width="3" fill="none"/>`).join('')}
      <text x="180" y="40" text-anchor="middle" class="svgtext" style="fill:var(--bad)">ICING · blocked tubes</text></g>
    <line x1="244" y1="112" x2="244" y2="150" stroke="${cc}" stroke-width="5"/><line x1="116" y1="44" x2="116" y2="14" stroke="${cc}" stroke-width="5"/>
    <text x="252" y="148" class="svgmuted">coolant in</text><text x="124" y="20" class="svgmuted">coolant out${coolant?' · '+coolant.name:''}</text>
    <line x1="180" y1="112" x2="180" y2="140" stroke="var(--ink)" stroke-width="3"/>
    <rect x="160" y="140" width="40" height="34" rx="4" fill="var(--hot-soft)" stroke="var(--ink)" stroke-width="1.5"/>
    ${recovered && !frost ? `<circle cx="180" cy="118" r="3.5" fill="var(--hot)" class="drip"/>` : ''}
    <text x="208" y="168" class="svgmuted">recovered toluene${vals.T!==undefined?` @ ${vals.T.toFixed(1)} K`:''}</text>
  </svg>`;
}


function chapterArt(){
  const L=S.L, a=L.art;
  if (a==='warm') return `<svg viewBox="0 0 360 150" role="img" aria-label="Carbon adsorber bed">
    <line x1="10" y1="75" x2="100" y2="75" stroke="var(--hot)" stroke-width="7" class="flow"/><line x1="260" y1="75" x2="350" y2="75" stroke="var(--cold)" stroke-width="7" class="flow"/>
    <rect x="100" y="30" width="160" height="90" rx="10" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>
    ${Array.from({length:60},(_,k)=>`<circle cx="${112+(k%15)*10}" cy="${44+Math.floor(k/15)*20+(k%2)*6}" r="3.6" fill="${k%4===0?'var(--line)':'var(--ink)'}"/>`).join('')}
    <text x="180" y="20" text-anchor="middle" class="svgtext">Carbon bed: 25% less usable capacity</text>
    <text x="10" y="62" class="svgmuted">VOC in</text><text x="270" y="62" class="svgmuted">clean gas</text>
    <text x="180" y="140" text-anchor="middle" class="svgmuted">grey sites = capacity lost to humidity and ageing</text></svg>`;
  if (a==='oxid' || a==='cat') { const cat=a==='cat';
    return `<svg viewBox="0 0 360 170" role="img" aria-label="${cat?'Catalytic':'Thermal'} oxidizer with heat recovery">
    <line x1="10" y1="120" x2="70" y2="120" stroke="var(--hot)" stroke-width="7" class="flow"/>
    <rect x="70" y="96" width="70" height="48" rx="6" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>
    <path d="M78 108 h54 M78 120 h54 M78 132 h54" stroke="var(--cold)" stroke-width="2.5"/>
    <text x="105" y="160" text-anchor="middle" class="svgmuted">heat recovery</text>
    <line x1="140" y1="120" x2="175" y2="120" stroke="var(--hot)" stroke-width="7"/>
    <rect x="175" y="40" width="110" height="104" rx="10" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>
    ${cat ? Array.from({length:24},(_,k)=>`<rect x="${187+(k%6)*15}" y="${70+Math.floor(k/6)*15}" width="11" height="11" fill="none" stroke="var(--muted)" stroke-width="1.5"/>`).join('')
          : `<path d="M230 128 c-18 -16 -6 -30 0 -50 c6 20 18 34 0 50 z" fill="var(--hot)"/><path d="M230 128 c-8 -8 -3 -16 0 -26 c3 10 8 18 0 26 z" fill="var(--hot-soft)"/>`}
    <text x="230" y="32" text-anchor="middle" class="svgtext">${cat?'Catalyst bed':'Chamber: the 3 Ts'}</text>
    <path d="M285 60 h30 v-30 h35" stroke="var(--cold)" stroke-width="7" fill="none" class="flow"/>
    <text x="300" y="20" class="svgmuted">to stack</text><text x="10" y="106" class="svgmuted">VOC in</text></svg>`; }
  if (a==='bio') return `<svg viewBox="0 0 360 170" role="img" aria-label="Biofilter, biotrickling filter and bioscrubber">
    <g><rect x="12" y="40" width="96" height="90" rx="8" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>
      ${Array.from({length:28},(_,k)=>`<circle cx="${24+(k%7)*12}" cy="${58+Math.floor(k/7)*18}" r="5" fill="var(--good-soft)" stroke="var(--good)"/>`).join('')}
      <text x="60" y="152" text-anchor="middle" class="svgtext">Biofilter</text><text x="60" y="166" text-anchor="middle" class="svgmuted">moist media</text></g>
    <g><rect x="132" y="40" width="96" height="90" rx="8" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>
      ${Array.from({length:5},(_,k)=>`<line x1="${146+k*17}" y1="56" x2="${146+k*17}" y2="122" stroke="var(--good)" stroke-width="4"/>`).join('')}
      ${Array.from({length:6},(_,k)=>`<circle cx="${148+k*14}" cy="${48}" r="2.5" fill="var(--cold)" class="drip"/>`).join('')}
      <text x="180" y="152" text-anchor="middle" class="svgtext">Biotrickling</text><text x="180" y="166" text-anchor="middle" class="svgmuted">biofilm + liquid</text></g>
    <g><rect x="252" y="40" width="44" height="90" rx="8" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>
      <rect x="306" y="80" width="44" height="50" rx="8" fill="var(--good-soft)" stroke="var(--good)" stroke-width="2"/>
      <path d="M296 120 h10 M306 92 h-10" stroke="var(--cold)" stroke-width="3"/>
      <text x="300" y="152" text-anchor="middle" class="svgtext">Bioscrubber</text><text x="300" y="166" text-anchor="middle" class="svgmuted">+ bioreactor</text></g>
    <text x="180" y="24" text-anchor="middle" class="svgtext">Where does the biology happen?</text></svg>`;
  // select / exit: the slide 24 comparison
  const rows=[['Adsorption','recovery or polishing','finite capacity'],['Oxidation','destruction suits the gas','energy, byproducts'],['Condensation','favourable vapour pressure','attainable temperature'],['Biological','biodegradable, suitable load','transfer, inhibition']];
  return `<svg viewBox="0 0 360 176" role="img" aria-label="Technology comparison">
    <text x="10" y="16" class="svgmuted">TECHNOLOGY</text><text x="112" y="16" class="svgmuted">USEFUL WHEN</text><text x="262" y="16" class="svgmuted">MAIN LIMIT</text>
    ${rows.map((r,k)=>`<rect x="4" y="${24+k*37}" width="352" height="32" rx="6" fill="${k%2?'var(--bg)':'var(--cold-soft)'}"/>
      <text x="12" y="${44+k*37}" class="svgtext" style="font-weight:600">${r[0]}</text><text x="112" y="${44+k*37}" class="svgmuted">${r[1]}</text><text x="262" y="${44+k*37}" class="svgmuted">${r[2]}</text>`).join('')}</svg>`;
}

function gauge(){
  const lo=170, hi=310, x=t=>20+(Math.min(hi,Math.max(lo,t))-lo)/(hi-lo)*320;
  const {vals, coolant} = S;
  const ticks=[]; for(let t=180;t<=300;t+=20) ticks.push(t);
  return `<svg viewBox="0 0 360 96" role="img" aria-label="Temperature gauge in kelvin">
    <rect x="20" y="34" width="320" height="14" rx="7" fill="var(--cold-soft)"/>
    <rect x="${x(TMIN)}" y="30" width="${x(TMAX)-x(TMIN)}" height="22" fill="var(--band)" stroke="var(--good)" stroke-dasharray="3 2"/>
    <text x="${x(TMIN)-2}" y="24" text-anchor="end" class="svgmuted">NIST valid range</text>
    ${ticks.map(t=>`<line x1="${x(t)}" y1="52" x2="${x(t)}" y2="58" stroke="var(--muted)"/><text x="${x(t)}" y="70" text-anchor="middle" class="svgmuted">${t}</text>`).join('')}
    <text x="340" y="86" text-anchor="end" class="svgmuted">K</text>
    ${coolant?`<line x1="${x(coolant.reach)}" y1="26" x2="${x(coolant.reach)}" y2="56" stroke="var(--c-${coolant.id})" stroke-width="3"/><text x="${x(coolant.reach)}" y="86" text-anchor="middle" class="svgtext" style="fill:var(--c-${coolant.id})">reach ${coolant.reach}</text>`:''}
    ${vals.T!==undefined?`<path d="M${x(vals.T)-6} 16 h12 l-6 12 z" fill="var(--hot)"/><text x="${Math.min(300,Math.max(40,x(vals.T)))}" y="11" text-anchor="middle" class="svgtext" style="fill:var(--hot)">target ${vals.T.toFixed(1)} K${vals.T<lo?' (off scale)':''}</text>`:''}
  </svg>`;
}

function worksheet(){
  const rows=[];
  S.steps.forEach((st,k)=>{
    if (st.type==='num' && S.vals[st.key]!==undefined) rows.push(`<li><span>${st.title}</span><b>${fmt(S.vals[st.key])} ${st.unit}</b></li>`);
    else if (st.type==='coolant' && S.coolant) rows.push(`<li><span>Coolant</span><b>${S.coolant.name}</b></li>`);
    else if (st.type!=='num' && st.type!=='coolant' && (k<S.i || (k===S.i && S.locked))) rows.push(`<li><span>${st.title}</span><b>✓</b></li>`);
  });
  return rows.length?`<ul class="sheet">${rows.join('')}</ul>`:`<p class="note">Your answers collect here as you go.</p>`;
}

function stepPanel(){
  const st = S.steps[S.i];
  const prog = `<div class="progress">${S.steps.map((_,k)=>`<i class="${k<S.i?'done':k===S.i?'now':''}"></i>`).join('')}</div>`;
  let body = '';
  if (st.type==='num'){
    body = `<p class="prompt">${st.prompt}</p><div class="eq">${st.eq}</div>
      <form class="answer" id="numform"><input id="ans-${st.key}" inputmode="decimal" autocomplete="off" placeholder="e.g. ${st.unit==='K'?'280.0':'0.0123'}" aria-label="${st.title}" ${S.locked?'disabled':''}>
      <span class="unit">${st.unit}</span><button class="btn" type="submit" ${S.locked?'disabled':''}>Check</button>
      <button class="btn ghost" type="button" id="hintbtn">Hint</button></form>`;
  } else if (st.type==='coolant'){
    body = `<p class="prompt">${st.prompt} Your target is <b>${S.vals.T.toFixed(1)} K</b>.</p>
      <div class="opts">${COOLANTS.map(c=>`<button class="opt" data-c="${c.id}" ${S.locked?'disabled':''}><span><i class="swatch" style="background:var(--c-${c.id})"></i>${c.name}</span><small>down to ${c.reach} K · ${c.cost}</small></button>`).join('')}</div>`;
  } else if (st.type==='multi'){
    const sel=S.sel[st.key]||[];
    body = `<p class="prompt">${st.prompt}</p><div class="opts">${st.options.map((o,k)=>`<label class="opt check ${S.locked?(o.ok?'picked-ok':(sel.includes(k)?'picked-bad':'')):''}"><input type="checkbox" data-m="${k}" ${sel.includes(k)?'checked':''} ${S.locked?'disabled':''}><span>${o.t}</span></label>`).join('')}</div>
      <div class="row"><button class="btn" id="multicheck" type="button" ${S.locked?'disabled':''}>Check</button>${st.hint?'<button class="btn ghost" type="button" id="hintbtn">Hint</button>':''}</div>`;
  } else if (st.type==='match'){
    const sel=S.sel[st.key]||{};
    body = `<p class="prompt">${st.prompt}</p><div class="matchlist">${st.items.map((it,k)=>`<div class="matchrow ${S.locked?'picked-ok':(sel['_bad']&&sel['_bad'].includes(k)?'picked-bad':'')}"><span>${it.t}</span>
      <select id="mt-${st.key}-${k}" data-t="${k}" aria-label="${esc(it.t)}" ${S.locked?'disabled':''}><option value="">Choose…</option>${st.choices.map(c=>`<option ${sel[k]===c?'selected':''}>${c}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="row"><button class="btn" id="matchcheck" type="button" ${S.locked?'disabled':''}>Check</button></div>`;
  } else {
    body = `<p class="prompt">${st.prompt}</p><div class="opts">${st.options.map((o,k)=>`<button class="opt" data-o="${k}" ${S.locked?'disabled':''}><span>${o.t}</span></button>`).join('')}</div>`;
  }
  const next = S.locked ? `<div class="row"><button class="btn" id="nextbtn">${S.i===S.steps.length-1?'Finish level':'Next step'}</button></div>` : '';
  return `${prog}<p class="eyebrow">Step ${S.i+1} of ${S.steps.length}</p><h3 class="stephead">${st.title}</h3>${body}<div id="fb" role="status" aria-live="polite">${S.fb}</div>${next}`;
}

function renderLevel(){
  const L=S.L;
  const chap=COURSE.chapters.find(c=>c.id===L.ch); const idx=COURSE.levels.filter(x=>x.ch===L.ch).indexOf(L)+1;
  app.innerHTML = header({label:chap.title, go:()=>renderChapter(L.ch)}) + `
  <div class="levelbar"><h2>${esc(chap.title)} · Level ${idx}: ${L.name}</h2></div>
  <div class="grid">
    <div class="card"><h4>Site brief</h4><p class="brief">${L.brief}</p>
      ${L.kind ? `<div class="casegrid">
        <div class="kv"><b>${L.yin}</b><span>y<sub>in</sub> toluene</span></div>
        <div class="kv"><b>${L.eta}</b><span>η recovery target</span></div>
        <div class="kv"><b>${L.P} bar</b><span>P total</span></div>
        <div class="kv"><b>${L.flow}</b><span>Flow (std)</span></div>
      </div>
      <div class="kv"><b style="font-family:var(--f-body)">${L.gas}</b><span>Carrier gas</span></div>
      ${schematic()}${L.kind==='cond'?gauge():''}`
      : `<div class="casegrid">${(L.facts||[]).map(f=>`<div class="kv"><b>${f[0]}</b><span>${f[1]}</span></div>`).join('')}</div>${chapterArt()}`}
    </div>
    <div class="card" id="panel">${S.finished?resultPanel():stepPanel()}<h4>Worksheet</h4>${worksheet()}</div>
  </div>`;
  wire();
}

function setFb(cls,msg){ S.fb = `<p class="fb ${cls}">${msg}</p>`; }

const slip = tag => { S.slips[tag] = (S.slips[tag]||0) + 1; };

function wire(){
  wireHeader({label:'Chapter', go:()=>renderChapter(S.L.ch)});
  if (S.finished){ document.getElementById('again').onclick=()=>startLevel(S.L.id);
    const nx=document.getElementById('nextlvl'); if(nx) nx.onclick=()=>startLevel(S.L.id+1);
    document.getElementById('map2').onclick=()=>renderChapter(S.L.ch);
    wireCopy();
    return; }
  const st=S.steps[S.i];
  const nb=document.getElementById('nextbtn');
  if (nb) nb.onclick=()=>{ S.i++; S.tries=0; S.fb=''; S.locked=false; if(S.i>=S.steps.length) finish(); else renderLevel(); };
  if (st.type==='num'){
    const f=document.getElementById('numform'); const inp=document.getElementById('ans-'+st.key);
    if(!S.locked) inp.focus({preventScroll:true});
    document.getElementById('hintbtn').onclick=()=>{ setFb('hint', st.hint); renderLevel(); };
    f.onsubmit=e=>{ e.preventDefault(); if(S.locked) return; checkNum(st, inp.value); };
  } else if (st.type==='coolant'){
    app.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>pickCoolant(st, COOLANTS.find(c=>c.id===b.dataset.c), b));
  } else if (st.type==='multi'){
    app.querySelectorAll('[data-m]').forEach(cb=>cb.onchange=()=>{ const k=+cb.dataset.m; let a=S.sel[st.key]||[]; a=cb.checked?[...new Set([...a,k])]:a.filter(x=>x!==k); S.sel[st.key]=a; });
    const hb=document.getElementById('hintbtn'); if(hb) hb.onclick=()=>{ setFb('hint', st.hint); renderLevel(); };
    document.getElementById('multicheck').onclick=()=>checkMulti(st);
  } else if (st.type==='match'){
    app.querySelectorAll('select[data-t]').forEach(se=>se.onchange=()=>{ const o=S.sel[st.key]||{}; o[+se.dataset.t]=se.value; S.sel[st.key]=o; });
    document.getElementById('matchcheck').onclick=()=>checkMatch(st);
  } else {
    app.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>pickOption(st, st.options[+b.dataset.o], b));
  }
}

function near(v, target, st){ return st.abs!==undefined ? Math.abs(v-target)<=st.abs : Math.abs(v-target)<=Math.abs(target)*st.rel; }

function checkNum(st, raw){
  const v = parseFloat(String(raw).replace(',', '.').replace(/\s/g,''));
  if (isNaN(v)){ setFb('hint','Enter a number. Scientific notation like 1.5e-5 works too.'); return renderLevel(); }
  if (near(v, st.answer, st)){
    S.vals[st.key]=st.answer; S.done.push(st.key); S.locked=true;
    setFb('ok', `${S.tries===0?'Spot on.':'Got it.'} ${st.title}: <b>${fmt(st.answer)} ${st.unit}</b>.` + (st.key==='T' ? (st.answer<TMIN||st.answer>TMAX ? ' Note where this lands on the gauge.' : ' Inside the NIST valid range.') : ''));
    return renderLevel();
  }
  S.tries++; S.mistakes++;
  const trap = st.traps.find(t => t.abs!==undefined ? Math.abs(v-t.v)<=t.abs : Math.abs(v-t.v)<=Math.abs(t.v)*0.006);
  slip(trap ? trap.id : 'arith-'+st.key);
  if (S.tries>=3){
    S.vals[st.key]=st.answer; S.done.push(st.key); S.locked=true;
    setFb('bad', `${trap?trap.msg+' ':''}The answer is <b>${fmt(st.answer)} ${st.unit}</b>. Carry it forward and keep going.`);
  } else {
    setFb('bad', trap ? trap.msg : `Not quite (${fmt(v)}). ${3-S.tries} ${3-S.tries===1?'try':'tries'} left. Check your arithmetic, or tap Hint.`);
  }
  renderLevel();
}

function checkMulti(st){
  const sel=new Set(S.sel[st.key]||[]);
  if (!sel.size){ setFb('hint','Tick at least one box, then tap Check.'); return renderLevel(); }
  const wrong=st.options.map((o,k)=>(!o.ok && sel.has(k))?k:-1).filter(k=>k>=0);
  const missed=st.options.filter((o,k)=>o.ok && !sel.has(k)).length;
  if (!wrong.length && !missed){ S.locked=true; S.done.push(st.key); setFb('ok', st.okMsg); return renderLevel(); }
  S.tries++; S.mistakes++;
  wrong.forEach(k=>slip(`${st.key}-${k}`)); if (missed && !wrong.length) slip(st.key+'-miss');
  const parts=[]; if (wrong.length) parts.push(`${wrong.length===1?'One choice doesn’t':wrong.length+' choices don’t'} belong`); if (missed) parts.push(`${missed} more ${missed===1?'answer is':'answers are'} correct`);
  if (S.tries>=3){ S.locked=true; S.done.push(st.key); S.sel[st.key]=st.options.map((o,k)=>o.ok?k:-1).filter(k=>k>=0); setFb('bad', `${parts.join(', and ')}. The correct answers are highlighted. ${st.okMsg}`); }
  else setFb('bad', `${parts.join(', and ')}. ${3-S.tries} ${3-S.tries===1?'try':'tries'} left.`);
  renderLevel();
}

function checkMatch(st){
  const sel=S.sel[st.key]||{};
  if (st.items.some((_,k)=>!sel[k])){ setFb('hint','Choose an answer for every row, then tap Check.'); return renderLevel(); }
  const bad=st.items.map((it,k)=>sel[k]===it.ans?-1:k).filter(k=>k>=0);
  if (!bad.length){ S.locked=true; S.done.push(st.key); setFb('ok', st.okMsg); return renderLevel(); }
  S.tries++; S.mistakes++; slip(st.key+'-wrong');
  if (S.tries>=3){ S.locked=true; S.done.push(st.key); st.items.forEach((it,k)=>sel[k]=it.ans); S.sel[st.key]=sel; setFb('bad', `The correct matches are now shown. ${st.okMsg}`); }
  else { sel['_bad']=bad; S.sel[st.key]=sel; setFb('bad', `${bad.length} ${bad.length===1?'row is':'rows are'} wrong (marked in red). ${3-S.tries} ${3-S.tries===1?'try':'tries'} left.`); }
  renderLevel();
}

function pickCoolant(st, c){
  const T=S.vals.T; const ok=COOLANTS.filter(k=>k.reach<=T); const best=ok.reduce((a,b)=>b.reach>a.reach?b:a, ok[0]);
  if (c.reach > T){
    S.tries++; S.mistakes++; S.coolant=c; slip('coolant-weak');
    setFb('bad', `${c.name} only gets the gas down to ${c.reach} K. You need ${T.toFixed(1)} K. Toluene would leave in the outlet above the target.`);
    return renderLevel();
  }
  S.coolant=c; S.locked=true;
  if (c.id===best.id) setFb('ok', `${c.name} reaches ${c.reach} K, below your ${T.toFixed(1)} K target, at the lowest cost that works.`);
  else { S.mistakes++; slip('coolant-overkill'); setFb('mid', `It works, but you are paying for cold you don't need. ${best.name} (down to ${best.reach} K) would hit the target for less.`); }
  renderLevel();
  app.querySelector(`[data-c="${c.id}"]`)?.classList.add(c.id===best.id?'picked-ok':'picked-mid');
}

function pickOption(st, o){
  if (o.frost) S.frost=true;
  const idx = st.options.indexOf(o);
  if (o.r==='ok'){ S.locked=true; S.frost=false; setFb('ok', o.msg); S.done.push(st.key); }
  else if (o.r==='mid'){ S.mistakes++; slip(`${st.key}-${idx}`); setFb('mid', o.msg+' Try another option.'); }
  else { S.mistakes++; slip(`${st.key}-${idx}`); setFb('bad', o.msg); }
  renderLevel();
  app.querySelector(`[data-o="${idx}"]`)?.classList.add(o.r==='ok'?'picked-ok':o.r==='mid'?'picked-mid':'picked-bad');
}

function finish(){
  const n = S.mistakes===0?3:S.mistakes<=2?2:1;
  stars[S.L.id]=Math.max(stars[S.L.id]||0,n); saveStars();
  S.result = {name:PROFILE.name||'Student', classCode:PROFILE.classCode, ownerUid:PROFILE.ownerUid, course:COURSE.id, chapter:S.L.ch, level:S.L.id, stars:n, mistakes:S.mistakes, slips:S.slips};
  if (PROFILE.classCode && fbConfigured()) queueResult(S.result);
  S.finished=true; S.earned=n; renderLevel();
}

function resultPanel(){
  const nextL = COURSE.levels.find(l=>l.id===S.L.id+1); const hasNext = !!nextL;
  const nextLabel = nextL && nextL.ch!==S.L.ch ? 'Next chapter' : 'Next level';
  return `<p class="eyebrow">Level complete</p><div class="bigstars">${starStr(S.earned)}</div>
    <p class="prompt">${S.mistakes===0?'Clean run. No mistakes.':`${S.mistakes} ${S.mistakes===1?'slip':'slips'} along the way.`}</p>
    <p class="fb hint"><b>Debrief.</b> ${S.L.debrief}</p>
    <div class="sendbox"><h4>Your result</h4><div id="sendstatus" role="status" aria-live="polite">${sendStatusHtml()}</div></div>
    <div class="row">${hasNext?`<button class="btn" id="nextlvl">${nextLabel}</button>`:''}<button class="btn ghost" id="again">Replay</button><button class="btn ghost" id="map2">Chapter levels</button></div>`;
}

// ---- Install as an app ----
let deferredInstall = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installDismissed = () => { try { return localStorage.getItem('cq-install-hide') === '1'; } catch(e){ return false; } };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (view==='courses') renderCourses(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; try { localStorage.setItem('cq-install-hide','1'); } catch(e){} if (view==='courses') renderCourses(); });

function installBanner(){
  if (isStandalone() || installDismissed()) return '';
  if (deferredInstall) return `<div class="install"><img src="icon-192.png" alt="" width="44" height="44"><div class="install-text"><b>Install ${esc(APP)}</b><span>Add it to your home screen. It opens like an app and works offline.</span></div><div class="row"><button class="btn" id="installbtn" type="button">Install</button><button class="linkbtn" id="installhide" type="button">Not now</button></div></div>`;
  if (isIOS()) return `<div class="install"><img src="icon-192.png" alt="" width="44" height="44"><div class="install-text"><b>Add ${esc(APP)} to your home screen</b><span>In Safari, tap the Share button <span aria-hidden="true">(□↑)</span>, then <b>Add to Home Screen</b>.</span></div><div class="row"><button class="linkbtn" id="installhide" type="button">Got it</button></div></div>`;
  return '';
}
function wireInstall(){
  const b=document.getElementById('installbtn');
  if (b) b.onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch(e){} deferredInstall = null; renderCourses(); };
  const h=document.getElementById('installhide');
  if (h) h.onclick = () => { try { localStorage.setItem('cq-install-hide','1'); } catch(e){} renderCourses(); };
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}


// ---- Start ----
(function boot(){
  const q = new URLSearchParams(location.search); const code = (q.get('class')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (code){ history.replaceState(null,'',location.pathname); PROFILE=Object.assign({}, PROFILE||{}, {role:'student'}); saveProfile();
    if (PROFILE.classCode !== code) return renderJoin(null, code); }
  if (!PROFILE || !PROFILE.role) return renderRole();
  if (PROFILE.role==='instructor') return renderInstructor();
  if (!PROFILE.name) return renderJoin();
  if (PROFILE.courseId && openCourse(PROFILE.courseId)) return renderChapters();
  renderCourses();
})();
if (PENDING.length) initFirebase();
