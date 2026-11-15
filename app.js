const API_BASE='https://supreme-md-2-api2.onrender.com';
const menu=document.querySelector('.menu-toggle');const nav=document.querySelector('nav');menu?.addEventListener('click',()=>nav.classList.toggle('open'));document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
const modal=document.getElementById('modal');const modalBox=modal?.querySelector('.modal-box');const title=document.getElementById('modalTitle');const copy=document.getElementById('modalText');const defaultModalHTML=modalBox?.innerHTML;
function showModal(t,m){if(title)title.textContent=t;if(copy)copy.textContent=m;modal?.classList.add('show');modal?.setAttribute('aria-hidden','false')}
function closeModal(){modal?.classList.remove('show');modal?.setAttribute('aria-hidden','true');if(modalBox&&defaultModalHTML)modalBox.innerHTML=defaultModalHTML}
function passwordField(id,label,autocomplete,placeholder){return '<label for="'+id+'">'+label+'</label><div class="password-wrap"><input id="'+id+'" name="'+id+'" type="password" autocomplete="'+autocomplete+'" '+(id==='authPassword'?'minlength="10" maxlength="72"':'minlength="10" maxlength="72"')+' required placeholder="'+placeholder+'"><button class="password-toggle" type="button" data-password="'+id+'" aria-label="Show password">SHOW</button></div>'}
function showAccount(mode='login'){
  if(!modalBox)return;
  const isRegister=mode==='register';
  modalBox.innerHTML='<button class="modal-close" aria-label="Close">×</button><span class="modal-crown">⟡</span><p class="eyebrow">SUPREME MD V2 / MEMBER IDENTITY</p><h3 id="authHeading">'+(isRegister?'CREATE ACCOUNT':'MEMBER SIGN IN')+'</h3><p id="authMessage">Your account is protected by secure server-side authentication.</p><form id="authForm" class="auth-form"><label for="authUsername">USERNAME</label><input id="authUsername" name="username" autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required placeholder="3–24 letters, numbers or underscores">'+passwordField('authPassword','PASSWORD',isRegister?'new-password':'current-password',isRegister?'At least 10 characters':'Your password')+(isRegister?passwordField('authConfirm','CONFIRM PASSWORD','new-password','Enter your password again'):'')+'<button class="btn gold" type="submit">'+(isRegister?'CREATE ACCOUNT':'SIGN IN')+' <b>↗</b></button></form><p class="auth-switch">'+(isRegister?'Already registered?':'New here?')+' <button type="button" id="authSwitch">'+(isRegister?'Sign in':'Create an account')+'</button></p>';
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');
  modalBox.querySelector('.modal-close').addEventListener('click',closeModal);
  modalBox.querySelector('#authSwitch').addEventListener('click',()=>showAccount(isRegister?'login':'register'));
  modalBox.querySelectorAll('.password-toggle').forEach(button=>button.addEventListener('click',()=>{const input=modalBox.querySelector('#'+button.dataset.password);const reveal=input.type==='password';input.type=reveal?'text':'password';button.textContent=reveal?'HIDE':'SHOW';button.setAttribute('aria-label',reveal?'Hide password':'Show password')}));
  modalBox.querySelector('#authForm').addEventListener('submit',submitAuth);
}
async function submitAuth(event){
  event.preventDefault();const form=event.currentTarget;const submit=form.querySelector('button[type="submit"]');const message=modalBox.querySelector('#authMessage');const mode=modalBox.querySelector('#authHeading').textContent.includes('CREATE')?'register':'login';
  const username=form.elements.username.value.trim();const password=form.elements.authPassword.value;const confirm=form.elements.authConfirm?.value;if(mode==='register'&&password!==confirm){message.textContent='The passwords do not match. Please check both fields.';return}
  submit.disabled=true;submit.textContent='PLEASE WAIT…';message.textContent='Contacting the secure account service…';
  try{
    const response=await fetch(API_BASE+'/api/auth/'+mode,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Requested-With':'SUPREME-MD-V2'},body:JSON.stringify({username,password})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');
    message.textContent='Welcome, '+data.user.username+'. Your '+data.user.role+' account is active.';
    password.length;form.reset();
    setTimeout(()=>{closeModal();refreshSession()},900);
  }catch(error){message.textContent=error.message||'Could not reach the account service.';submit.disabled=false;submit.textContent=mode==='register'?'CREATE ACCOUNT':'SIGN IN'}
}
function renderMemberDashboard(user){
  const main=document.querySelector('.dash-main');if(!main)return;
  let panel=document.getElementById('memberProfile');
  if(!panel){panel=document.createElement('section');panel.id='memberProfile';panel.className='member-profile';const top=main.querySelector('.dash-top');if(top)top.insertAdjacentElement('afterend',panel);else main.prepend(panel)}
  if(!user){panel.innerHTML='<div class="member-profile-head"><b>MEMBER PROFILE</b><span>LOCKED</span></div><p>Sign in to load your private member dashboard and account details.</p><button class="btn gold" type="button" id="dashboardSignIn">SIGN IN TO CONTINUE</button>';panel.querySelector('#dashboardSignIn')?.addEventListener('click',()=>showAccount('login'));return}
  const joined=user.createdAt?new Date(user.createdAt).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):'—';
  panel.innerHTML='<div class="member-profile-head"><b>YOUR MEMBER PROFILE</b><span>SECURE ACCOUNT</span></div><div class="member-profile-grid"><div><small>USERNAME</small><strong>'+escapeText(user.username)+'</strong></div><div><small>ACCOUNT ROLE</small><strong>'+escapeText(user.role.toUpperCase())+'</strong></div><div><small>MEMBER SINCE</small><strong>'+escapeText(joined)+'</strong></div><div><small>ACCOUNT STATUS</small><strong class="member-active">ACTIVE</strong></div></div>';
}
function escapeText(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
async function refreshSession(){
  const accountButton=document.getElementById('accountBtn');
  try{const response=await fetch(API_BASE+'/api/auth/me',{credentials:'include'});if(!response.ok){if(accountButton)accountButton.textContent='MEMBER ACCESS';const signOutButton=document.getElementById('signOutBtn');if(signOutButton)signOutButton.hidden=true;renderMemberDashboard(null);return null}
    const data=await response.json();if(accountButton)accountButton.textContent='SIGNED IN: '+data.user.username.toUpperCase();
    const signOutButton=document.getElementById('signOutBtn');if(signOutButton)signOutButton.hidden=false;
    const greeting=document.querySelector('.dash-greeting');if(greeting)greeting.textContent='WELCOME, '+data.user.username.toUpperCase();
    const demo=document.querySelector('.demo-chip');if(demo)demo.textContent=data.user.role.toUpperCase();
    const caption=document.querySelector('.preview-caption');if(caption)caption.textContent='SIGNED IN AS '+data.user.role.toUpperCase()+' · LIVE ACCOUNT SESSION';
    renderMemberDashboard(data.user);
    return data.user;
  }catch(_){renderMemberDashboard(null);return null}
}
document.querySelectorAll('.connect-option').forEach(button=>button.addEventListener('click',async()=>{
  if(button.dataset.method==='Pairing code'){
    showModal('PAIR YOUR WHATSAPP','Enter your own WhatsApp number with its country code. The number and one-time code stay in your private signed-in session.');
    modalBox.innerHTML='<button class="modal-close" aria-label="Close">×</button><p class="eyebrow">SUPREME MD V2 / PRIVATE SESSION</p><h3>PAIR WITH PHONE NUMBER</h3><p>Enter your number including country code, without the leading +. Example format: 2348012345678.</p><form id="waPairForm" style="display:grid;gap:12px;margin:18px 0"><label for="waPairPhone">WHATSAPP PHONE NUMBER</label><input id="waPairPhone" name="phoneNumber" type="tel" inputmode="numeric" autocomplete="tel" placeholder="2348012345678" required minlength="8" maxlength="15" style="padding:13px;background:#10100f;border:1px solid var(--line);color:#fff"><button class="btn gold" id="waPairSubmit" type="submit">GENERATE PAIRING CODE</button></form><p id="waPairStatus" class="admin-note" role="status">Use your own number only. Never share your pairing code.</p><div id="waPairCode" style="display:none;text-align:center;padding:18px;background:#17150f;border:1px solid var(--line);font:700 25px Orbitron;letter-spacing:4px;color:var(--pale);user-select:all"></div><p id="waPairHelp" class="admin-note"></p><button class="btn" id="waPairCancel" type="button">CLOSE</button>';
    const closePair=()=>closeModal();
    modalBox.querySelector('.modal-close').addEventListener('click',closePair);
    modalBox.querySelector('#waPairCancel').addEventListener('click',closePair);
    modalBox.querySelector('#waPairForm').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const submit=modalBox.querySelector('#waPairSubmit');
      const status=modalBox.querySelector('#waPairStatus');
      const codeBox=modalBox.querySelector('#waPairCode');
      const help=modalBox.querySelector('#waPairHelp');
      const phoneNumber=String(new FormData(form).get('phoneNumber')||'').replace(/[^0-9]/g,'');
      if(!/^\d{8,15}$/.test(phoneNumber)){status.textContent='Enter 8–15 digits including your country code.';return}
      submit.disabled=true;status.textContent='Requesting your private pairing code…';
      try{
        const response=await fetch(API_BASE+'/api/whatsapp/pair',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Requested-With':'SUPREME-MD-V2'},body:JSON.stringify({phoneNumber})});
        const data=await response.json().catch(()=>({}));
        if(response.status===401)throw new Error('Sign in before linking your WhatsApp.');
        if(!response.ok)throw new Error(data.error||'Could not generate the pairing code.');
        codeBox.style.display='block';codeBox.textContent=data.pairingCode||'';
        status.textContent='PAIRING CODE READY · Enter this code in WhatsApp on your phone.';
        help.textContent='On your phone: WhatsApp → Linked devices → Link a device → Link with phone number instead. Enter the code shown above. Do not share it with anyone.';
        form.style.display='none';
        const checkConnection=async()=>{
          if(!modal?.classList.contains('show'))return;
          try{
            const stateResponse=await fetch(API_BASE+'/api/whatsapp/session',{credentials:'include'});
            const stateData=await stateResponse.json().catch(()=>({}));
            if(stateData.session?.status==='connected'){
              status.textContent='CONNECTED · Your WhatsApp is linked. SUPREME MD will send your command menu to your own DM.';
              codeBox.style.display='none';help.textContent='Your private session is now active.';
              return;
            }
          }catch(_){}
          setTimeout(checkConnection,2500);
        };
        checkConnection();
      }catch(error){status.textContent=error.message||'Pairing failed. Please try QR linking.';submit.disabled=false}
    });
    return;
  }
  showModal('STARTING SECURE CONNECTION','Preparing your private QR session. Keep this page open…');
  try{
    const response=await fetch(API_BASE+'/api/whatsapp/connect',{method:'POST',credentials:'include',headers:{'X-Requested-With':'SUPREME-MD-V2'}});
    const data=await response.json().catch(()=>({}));
    if(response.status===401){showModal('SIGN IN REQUIRED','Sign in to your SUPREME MD V2 account before linking your own WhatsApp.');return}
    if(!response.ok)throw new Error(data.error||'Could not start the connection.');
    modalBox.innerHTML='<button class="modal-close" aria-label="Close">×</button><p class="eyebrow">SUPREME MD V2 / PRIVATE SESSION</p><h3>LINK YOUR WHATSAPP</h3><p id="waConnectStatus">Waiting for your personal QR code…</p><div id="waQrWrap" style="display:grid;place-items:center;min-height:210px;margin:16px auto"><span style="color:#bca477;font-size:12px">GENERATING QR…</span></div><p class="admin-note">Scan only from your own WhatsApp app. Never share this QR with anyone. This experimental free-hosted connection may stop when the API sleeps or restarts.</p><button class="btn gold" id="waDisconnect" type="button">CANCEL / DISCONNECT</button>';
    modalBox.querySelector('.modal-close').addEventListener('click',closeModal);
    let stopped=false,lastQr=null;
    const statusNode=modalBox.querySelector('#waConnectStatus');
    const qrWrap=modalBox.querySelector('#waQrWrap');
    const disconnect=async()=>{stopped=true;try{await fetch(API_BASE+'/api/whatsapp/session',{method:'DELETE',credentials:'include',headers:{'X-Requested-With':'SUPREME-MD-V2'}})}catch(_){}closeModal()};
    modalBox.querySelector('#waDisconnect').addEventListener('click',disconnect);
    const poll=async()=>{
      if(stopped||!modal?.classList.contains('show'))return;
      try{
        const statusResponse=await fetch(API_BASE+'/api/whatsapp/session',{credentials:'include'});
        const statusData=await statusResponse.json().catch(()=>({}));
        if(statusData.session?.status==='connected'){
          stopped=true;statusNode.textContent='CONNECTED · Your WhatsApp session is active on this server instance.';
          qrWrap.innerHTML='<span style="color:#78d6a3;font:700 13px Orbitron">CONNECTION ESTABLISHED</span>';
          modalBox.querySelector('#waDisconnect').textContent='DISCONNECT WHATSAPP';
          return;
        }
        if(statusData.session?.status==='needs_relink'){
          stopped=true;statusNode.textContent='RELINK REQUIRED · Please start a new QR connection.';qrWrap.innerHTML='';return;
        }
        const qrResponse=await fetch(API_BASE+'/api/whatsapp/qr',{credentials:'include'});
        if(qrResponse.ok){
          const qrData=await qrResponse.json();
          if(qrData.qr&&qrData.qr!==lastQr){lastQr=qrData.qr;qrWrap.innerHTML='<img alt="Private WhatsApp linking QR code" style="width:100%;max-width:280px;background:#fff;padding:10px;border-radius:8px" src="'+qrData.qr+'">';statusNode.textContent='QR READY · Open WhatsApp on your phone and scan this code.'}
        }
      }catch(_){}
      if(!stopped)setTimeout(poll,2000);
    };
    poll();
  }catch(error){showModal('CONNECTION NOT STARTED',error.message||'Please try again later.')}
}));
document.getElementById('accountBtn')?.addEventListener('click',()=>{showAccount('login');refreshSession().then(user=>{if(!user||!modal?.classList.contains('show'))return;modalBox.innerHTML='<button class="modal-close" aria-label="Close">×</button><span class="modal-crown">⟡</span><p class="eyebrow">SUPREME MD V2 / MEMBER IDENTITY</p><h3>YOU ARE SIGNED IN</h3><p>Welcome back, '+user.username+'. Your '+user.role+' account is active.</p><button class="btn gold" id="modalSignOut" type="button">SIGN OUT</button>';modalBox.querySelector('.modal-close').addEventListener('click',closeModal);modalBox.querySelector('#modalSignOut').addEventListener('click',logout)})});document.getElementById('signOutBtn')?.addEventListener('click',logout);
async function logout(){try{await fetch(API_BASE+'/api/auth/logout',{method:'POST',credentials:'include',headers:{'X-Requested-With':'SUPREME-MD-V2'}})}finally{closeModal();const b=document.getElementById('accountBtn');if(b)b.textContent='MEMBER ACCESS';const signOutButton=document.getElementById('signOutBtn');if(signOutButton)signOutButton.hidden=true;const g=document.querySelector('.dash-greeting');if(g)g.textContent='WELCOME TO YOUR SPACE'}}
async function showAdminSuite(initialTab='roles'){
  if(!modalBox)return;
  const validTabs=['roles','analytics','settings'];
  let activeTab=validTabs.includes(initialTab)?initialTab:'roles';
  modalBox.innerHTML='<button class="modal-close" aria-label="Close">×</button><p class="eyebrow">SUPREME MD V2 / CONTROL CENTRE</p><h3>ADMIN COMMAND SUITE</h3><div class="admin-tabs" role="tablist"><button type="button" data-admin-tab="roles">MEMBER ROLES</button><button type="button" data-admin-tab="analytics">ANALYTICS</button><button type="button" data-admin-tab="settings">SECURE SETTINGS</button></div><p id="adminStatus" aria-live="polite">Loading secure administration data…</p><div id="adminContent" class="admin-content"></div>';
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');
  modalBox.querySelector('.modal-close').addEventListener('click',closeModal);
  const status=modalBox.querySelector('#adminStatus');
  const content=modalBox.querySelector('#adminContent');
  async function api(path,options={}){
    const response=await fetch(API_BASE+path,{credentials:'include',...options,headers:{...(options.headers||{}),...(options.method&&options.method!=='GET'?{'X-Requested-With':'SUPREME-MD-V2'}:{})}});
    const data=await response.json().catch(()=>({error:'Invalid server response.'}));
    if(!response.ok)throw new Error(data.error||'Administration request failed.');
    return data;
  }
  async function loadTab(tab){
    activeTab=tab;
    modalBox.querySelectorAll('[data-admin-tab]').forEach(button=>{button.classList.toggle('active',button.dataset.adminTab===tab);button.setAttribute('aria-selected',String(button.dataset.adminTab===tab))});
    status.textContent='Loading '+tab.replaceAll('_',' ')+'…';content.innerHTML='';
    try{
      if(tab==='roles'){
        const [overview,members]=await Promise.all([api('/api/admin/overview'),api('/api/admin/members')]);
        status.textContent='Authorized administrator · member access controls are active.';
        content.innerHTML='<div class="admin-metrics"><div><small>TOTAL MEMBERS</small><b>'+Number(overview.overview.members)+'</b></div><div><small>NEW THIS WEEK</small><b>'+Number(overview.overview.new_members)+'</b></div></div><div class="admin-members"><h4>MEMBER DIRECTORY</h4>'+'<div class="admin-members"><h4>MEMBER DIRECTORY</h4>'+(members.members.map(member=>'<div class="admin-member"><div><b>'+escapeText(member.username)+'</b><small>'+escapeText(member.role.toUpperCase())+' · Joined '+escapeText(new Date(member.createdAt).toLocaleDateString())+'</small></div><div class="admin-member-actions">'+(member.role==='member'?'<button type="button" data-role="admin" data-id="'+Number(member.id)+'">MAKE ADMIN</button><button type="button" data-delete="'+Number(member.id)+'">REMOVE</button>':'<button type="button" data-role="member" data-id="'+Number(member.id)+'">MAKE MEMBER</button>')+'</div></div>').join('')||'<p>No members yet.</p>')+'</div>';
        content.querySelectorAll('[data-role]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await api('/api/admin/members/'+Number(button.dataset.id)+'/role',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:button.dataset.role})});await loadTab('roles')}catch(error){status.textContent=error.message;button.disabled=false}}));
        content.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm('Remove this member account? This cannot be undone.'))return;button.disabled=true;try{await api('/api/admin/members/'+Number(button.dataset.delete),{method:'DELETE'});await loadTab('roles')}catch(error){status.textContent=error.message;button.disabled=false}}));
      }else if(tab==='analytics'){
        const data=await api('/api/admin/analytics');const a=data.analytics;
        status.textContent='Live database metrics · generated '+new Date(a.generatedAt).toLocaleString()+'.';
        content.innerHTML='<div class="admin-metrics"><div><small>ALL ACCOUNTS</small><b>'+Number(a.users.total)+'</b></div><div><small>ACTIVE · 30 DAYS</small><b>'+Number(a.users.active_30d)+'</b></div><div><small>ADMINS</small><b>'+Number(a.users.admins)+'</b></div><div><small>NEW · 7 DAYS</small><b>'+Number(a.signups.last_7_days)+'</b></div><div><small>WHATSAPP SESSIONS</small><b>'+Number(a.sessions.total)+'</b></div><div><small>CONNECTED SESSIONS</small><b>'+Number(a.sessions.connected)+'</b></div></div><p class="admin-note">These are real account and session records. Message-volume analytics are not available because the WhatsApp engine is not active.</p>';
      }else{
        const data=await api('/api/admin/settings');const st=data.settings||{};const sec=data.security||{};
        status.textContent='Platform security configuration · private admin view.';
        const flags=[['Database connection',sec.databaseConfigured],['JWT authentication secret',sec.jwtSecretConfigured],['WhatsApp encryption key',sec.whatsappEncryptionKeyConfigured],['WhatsApp engine',sec.whatsappEngineEnabled]];
        content.innerHTML='<div class="settings-list">'+flags.map(([label,ready])=>'<div class="setting-row"><span>'+label+'</span><b class="'+(ready?'ready':'pending')+'">'+(ready?'READY':'NOT ENABLED')+'</b></div>').join('')+'</div><div class="setting-control"><div><b>MAINTENANCE MODE</b><small>When enabled, show the platform as under maintenance. This setting does not disconnect member accounts.</small></div><label class="switch-label"><input id="maintenanceToggle" type="checkbox" '+(st.maintenance_mode===true?'checked':'')+'><span>Enabled</span></label></div><p class="admin-note">Secrets are never displayed or edited in this browser. Configure private keys only in the hosting provider’s environment settings.</p>';
        content.querySelector('#maintenanceToggle').addEventListener('change',async event=>{const toggle=event.currentTarget;toggle.disabled=true;try{const result=await api('/api/admin/settings/maintenance',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:toggle.checked})});status.textContent='Maintenance mode '+(result.maintenanceMode?'enabled':'disabled')+'.'}catch(error){toggle.checked=!toggle.checked;status.textContent=error.message}finally{toggle.disabled=false}});
      }
    }catch(error){status.textContent=error.message;content.innerHTML='<p class="admin-note">Sign in with an authorized administrator account. This section is restricted to admins.</p>'}
  }
  modalBox.querySelectorAll('[data-admin-tab]').forEach(button=>button.addEventListener('click',()=>loadTab(button.dataset.adminTab)));
  await loadTab(activeTab);
}
document.getElementById('adminPreview')?.addEventListener('click',showAdminSuite);
document.querySelectorAll('[data-open-admin]').forEach(button=>button.addEventListener('click',()=>showAdminSuite(button.dataset.openAdmin)));
modal?.querySelector('.modal-close')?.addEventListener('click',closeModal);modal?.querySelector('.modal-ok')?.addEventListener('click',closeModal);modal?.addEventListener('click',e=>{if(e.target===modal)closeModal();if(e.target.closest('.modal-close'))closeModal();if(e.target.closest('.modal-ok'))closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
const authStyles=document.createElement('style');authStyles.textContent='.auth-form{display:grid;gap:10px;text-align:left;margin:18px 0}.password-wrap{display:flex;gap:7px;align-items:stretch}.password-wrap input{min-width:0;flex:1}.password-toggle{background:#211b12;border:1px solid var(--line);color:var(--gold);padding:0 12px;font:700 9px Orbitron;cursor:pointer;letter-spacing:1px}.auth-form button[disabled]{opacity:.6;cursor:wait}.auth-form label{font-size:10px;letter-spacing:2px;color:var(--gold)}.auth-form input{width:100%;box-sizing:border-box;background:#10100f;border:1px solid var(--line);color:#fff;padding:13px;border-radius:3px;font:inherit}.auth-form button{margin-top:8px}.auth-switch{font-size:13px}.auth-switch button{background:none;border:0;color:var(--gold);font:inherit;text-decoration:underline;cursor:pointer}';document.head.appendChild(authStyles);
const memberStyles=document.createElement('style');memberStyles.textContent='.member-profile{margin:0 0 16px;padding:20px;background:linear-gradient(120deg,#b78c4b12,#171815);border:1px solid #b78c4b44}.member-profile-head{display:flex;justify-content:space-between;gap:12px;font:9px Orbitron;letter-spacing:1.2px;color:#d6bd8c}.member-profile-head span{color:#7ecba5}.member-profile>p{font-size:12px;color:#999;line-height:1.7}.member-profile-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:17px}.member-profile-grid>div{padding:12px;background:#0e0f0d;border:1px solid #ffffff12;min-width:0}.member-profile-grid small,.member-profile-grid strong{display:block;overflow-wrap:anywhere}.member-profile-grid small{font:8px Orbitron;letter-spacing:1px;color:#8e887d;margin-bottom:9px}.member-profile-grid strong{font:600 12px DM Sans;color:#e7d7b5}.member-profile-grid .member-active{color:#78d6a3}@media(max-width:700px){.member-profile-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.appendChild(memberStyles);
const adminStyles=document.createElement('style');adminStyles.textContent='.admin-metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:16px 0}.admin-metrics>div{padding:15px;background:#1a1915;border:1px solid var(--line)}.admin-metrics small,.admin-metrics b{display:block}.admin-metrics small{font:8px Orbitron;color:#9b8b6d;letter-spacing:1px}.admin-metrics b{font:600 24px Orbitron;color:var(--pale);margin-top:8px}.admin-members{text-align:left;max-height:42vh;overflow:auto}.admin-members h4{font:10px Orbitron;letter-spacing:1.5px;color:var(--gold)}.admin-member{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid #ffffff16}.admin-member b,.admin-member small{display:block}.admin-member b{font-size:12px;color:#eee}.admin-member small{font-size:9px;color:#9a9183;margin-top:5px}.admin-member-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.admin-member-actions button{padding:7px;background:#201b12;border:1px solid var(--line);color:var(--pale);font:8px Orbitron;cursor:pointer}.admin-member-actions button:disabled{opacity:.5}@media(max-width:420px){.admin-member{align-items:flex-start;flex-direction:column}.admin-member-actions{justify-content:flex-start}}';document.head.appendChild(adminStyles);
refreshSession();
const themeToggle=document.getElementById('themeToggle');const themeMenu=document.getElementById('themeMenu');
const themeNames={royal:{gold:'#cba45f',pale:'#f2dfb7',line:'#33291b'},emerald:{gold:'#35c995',pale:'#baf5df',line:'#174c3c'},sapphire:{gold:'#579bff',pale:'#c5ddff',line:'#1d3e70'},ruby:{gold:'#ef526b',pale:'#ffd0d8',line:'#632432'},amethyst:{gold:'#b58aff',pale:'#e3d2ff',line:'#49336b'},arctic:{gold:'#65d9e8',pale:'#d0faff',line:'#24545c'}};
function applyTheme(name){const theme=themeNames[name]||themeNames.royal;const root=document.documentElement;root.style.setProperty('--gold',theme.gold);root.style.setProperty('--pale',theme.pale);root.style.setProperty('--line',theme.line);document.querySelectorAll('.theme-choice').forEach(choice=>choice.classList.toggle('active',choice.dataset.theme===name));try{localStorage.setItem('supreme-md-v2-theme',name)}catch(e){}const dot=document.querySelector('.theme-dot');if(dot)dot.style.background=theme.gold}
let savedTheme='royal';try{savedTheme=localStorage.getItem('supreme-md-v2-theme')||'royal'}catch(e){}applyTheme(savedTheme);
themeToggle?.addEventListener('click',()=>{const opening=themeMenu.hidden;themeMenu.hidden=!opening;themeToggle.setAttribute('aria-expanded',String(opening))});
document.querySelectorAll('.theme-choice').forEach(choice=>choice.addEventListener('click',()=>{applyTheme(choice.dataset.theme);themeMenu.hidden=true;themeToggle.setAttribute('aria-expanded','false')}));
document.addEventListener('click',event=>{if(!event.target.closest('.theme-wrap')){if(themeMenu)themeMenu.hidden=true;themeToggle?.setAttribute('aria-expanded','false')}});


async function refreshMaintenanceBanner(){
  try{
    const response=await fetch(API_BASE+'/api/platform/status');
    if(!response.ok)return;
    const data=await response.json();
    let banner=document.getElementById('maintenanceBanner');
    if(data.maintenanceMode){
      if(!banner){banner=document.createElement('div');banner.id='maintenanceBanner';banner.className='maintenance-banner';banner.setAttribute('role','status');banner.textContent='PLATFORM NOTICE · SUPREME MD V2 is currently in maintenance mode. Some features may be limited.';document.body.prepend(banner)}
    }else if(banner)banner.remove();
  }catch(_){}
}
refreshMaintenanceBanner();
