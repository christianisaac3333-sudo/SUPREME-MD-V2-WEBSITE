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
  panel.innerHTML='<div class="member-profile-head"><b>YOUR MEMBER PROFILE</b><span>SECURE ACCOUNT</span></div><div class="member-profile-grid"><div><small>USERNAME</small><strong>'+escapeText(user.username)+'</strong></div><div><small>ACCOUNT ROLE</small><strong>'+escapeText(user.role.toUpperCase())+'</strong></div><div><small>MEMBER SINCE</small><strong>'+escapeText(joined)+'</strong></div><div><small>ACCOUNT STATUS</small><strong class="member-active">ACTIVE</strong></div></div><div id="telegramLinkPanel" class="telegram-link-panel"><div class="telegram-link-head"><b>TELEGRAM ACCOUNT</b><span>SHARED BOT</span></div><p id="telegramLinkStatus">Checking Telegram link…</p><div id="telegramLinkActions"></div></div>';
  loadTelegramLink(panel);
}
async function loadTelegramLink(panel){
  const status=panel.querySelector('#telegramLinkStatus');
  const actions=panel.querySelector('#telegramLinkActions');
  if(!status||!actions)return;
  try{
    const response=await fetch(API_BASE+'/api/telegram/status',{credentials:'include'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Could not load Telegram status.');
    if(!data.enabled){status.textContent='The shared Telegram bot is not configured yet.';return}
    if(data.linked){
      status.textContent='LINKED'+(data.username?' · @'+data.username:'')+'. Your Telegram account is connected to this website identity.';
      actions.innerHTML='<button class="btn outline" id="telegramUnlink" type="button">UNLINK TELEGRAM</button>';
      actions.querySelector('#telegramUnlink').addEventListener('click',async()=>{
        const button=actions.querySelector('#telegramUnlink');button.disabled=true;button.textContent='PLEASE WAIT…';
        try{const result=await fetch(API_BASE+'/api/telegram/link',{method:'DELETE',credentials:'include',headers:{'X-Requested-With':'SUPREME-MD-V2'}});const payload=await result.json().catch(()=>({}));if(!result.ok)throw new Error(payload.error||'Could not unlink Telegram.');loadTelegramLink(panel)}
        catch(error){status.textContent=error.message;button.disabled=false;button.textContent='UNLINK TELEGRAM'}
      });
      return;
    }
    status.textContent='Not linked. Link your Telegram identity to your SUPREME MD V2 account to use the shared bot.';
    actions.innerHTML='<button class="btn gold" id="telegramGenerate" type="button">GENERATE LINK CODE</button><div id="telegramCodeBox" hidden></div>';
    actions.querySelector('#telegramGenerate').addEventListener('click',async()=>{
      const button=actions.querySelector('#telegramGenerate');button.disabled=true;button.textContent='GENERATING…';
      try{
        const result=await fetch(API_BASE+'/api/telegram/link-code',{method:'POST',credentials:'include',headers:{'X-Requested-With':'SUPREME-MD-V2'}});
        const payload=await result.json().catch(()=>({}));if(!result.ok)throw new Error(payload.error||'Could not generate a link code.');
        const box=actions.querySelector('#telegramCodeBox');box.hidden=false;
        box.innerHTML='<strong>'+escapeText(payload.code)+'</strong><p>Open @Supremecy_bot in Telegram and send <b>/link</b> followed by this code. It expires in 10 minutes. Keep it private.</p><button class="btn outline" id="telegramCopy" type="button">COPY CODE</button>';
        box.querySelector('#telegramCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(payload.code);box.querySelector('#telegramCopy').textContent='COPIED'}catch(_){status.textContent='Select and copy the code above manually.'}});
        status.textContent='One-time link code generated. Complete linking in a private chat with @Supremecy_bot.';
        button.textContent='GENERATE NEW CODE';button.disabled=false;
      }catch(error){status.textContent=error.message;button.disabled=false;button.textContent='TRY AGAIN'}
    });
  }catch(error){status.textContent=error.message}
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
    showModal('PAIR YOUR WHATSAPP','Enter your own WhatsApp number with its country code. Pairing can take up to 45 seconds. The free API may take longer if it is waking up.');
    modalBox.innerHTML='<button class="modal-close" aria-label="Close">×</button><p class="eyebrow">SUPREME MD V2 / PRIVATE SESSION</p><h3>PAIR WITH PHONE NUMBER</h3><p>Enter your number including country code, without the leading +. Example: 2348012345678.</p><form id="waPairForm" style="display:grid;gap:12px;margin:18px 0"><label for="waPairPhone">WHATSAPP PHONE NUMBER</label><input id="waPairPhone" name="phoneNumber" type="tel" inputmode="numeric" autocomplete="tel" placeholder="2348012345678" required minlength="8" maxlength="15" style="padding:13px;background:#10100f;border:1px solid var(--line);color:#fff"><button class="btn gold" id="waPairSubmit" type="submit">GENERATE PAIRING CODE</button></form><p id="waPairStatus" class="admin-note" role="status">Use your own number only. Never share your pairing code.</p><div id="waPairCode" style="display:none;text-align:center;padding:18px;background:#17150f;border:1px solid var(--line);font:700 25px Orbitron;letter-spacing:4px;color:var(--pale);user-select:all"></div><button class="btn gold" id="waPairCopy" type="button" style="display:none;margin:10px auto">COPY CODE</button><p id="waPairHelp" class="admin-note"></p><button class="btn" id="waPairCancel" type="button">CLOSE</button>';
    const closePair=()=>closeModal();
    modalBox.querySelector('.modal-close').addEventListener('click',closePair);
    modalBox.querySelector('#waPairCancel').addEventListener('click',closePair);
    modalBox.querySelector('#waPairForm').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const submit=modalBox.querySelector('#waPairSubmit');
      const status=modalBox.querySelector('#waPairStatus');
      const codeBox=modalBox.querySelector('#waPairCode');
      const copyButton=modalBox.querySelector('#waPairCopy');
      const help=modalBox.querySelector('#waPairHelp');
      const phoneNumber=String(new FormData(form).get('phoneNumber')||'').replace(/[^0-9]/g,'');
      if(!/^\d{8,15}$/.test(phoneNumber)){status.textContent='Enter 8–15 digits including your country code.';return}
      submit.disabled=true;status.textContent='Connecting securely to WhatsApp… this may take up to 45 seconds, and longer if the free API is waking up. Keep this window open.';
      const controller=new AbortController();
      const requestTimeout=setTimeout(()=>controller.abort(),100000);
      try{
        const response=await fetch(API_BASE+'/api/whatsapp/pair',{method:'POST',credentials:'include',signal:controller.signal,headers:{'Content-Type':'application/json','X-Requested-With':'SUPREME-MD-V2'},body:JSON.stringify({phoneNumber})});
        const data=await response.json().catch(()=>({}));
        if(response.status===401)throw new Error('Sign in before linking your WhatsApp.');
        if(!response.ok)throw new Error(data.error||'WhatsApp could not prepare a pairing code. Wait a little and retry.');
        if(!data.pairingCode)throw new Error('No pairing code was returned. Please retry.');
        codeBox.style.display='block';codeBox.textContent=data.pairingCode;
        copyButton.style.display='inline-flex';
        status.textContent='PAIRING CODE READY · Copy it and enter it in WhatsApp now.';
        help.textContent='On your phone: WhatsApp → Linked devices → Link a device → Link with phone number instead. Enter the code shown above. Keep it private.';
        form.style.display='none';
        copyButton.addEventListener('click',async()=>{
          try{
            await navigator.clipboard.writeText(data.pairingCode);
            copyButton.textContent='COPIED';
            status.textContent='CODE COPIED · Return to WhatsApp and enter it.';
          }catch(_){
            status.textContent='Copy was blocked by your browser. Press and hold the code above to copy it.';
            const selection=window.getSelection();
            const range=document.createRange();
            range.selectNodeContents(codeBox);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        });
        const checkConnection=async()=>{
          if(!modal?.classList.contains('show'))return;
          try{
            const stateResponse=await fetch(API_BASE+'/api/whatsapp/session',{credentials:'include'});
            const stateData=await stateResponse.json().catch(()=>({}));
            if(stateData.session?.status==='connected'){
              status.textContent='CONNECTED · Your WhatsApp is linked. SUPREME MD will send your command menu to your own DM.';
              codeBox.style.display='none';copyButton.style.display='none';help.textContent='Your private session is now active.';
              return;
            }
          }catch(_){}
          setTimeout(checkConnection,2500);
        };
        checkConnection();
      }catch(error){
        status.textContent=error.name==='AbortError'?'The request took too long. The free API may still be waking up. Wait a minute, then retry.':(error.message||'Pairing failed. Please try again.');
        submit.disabled=false;
      }finally{clearTimeout(requestTimeout)}
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
const themeNames={royal:{gold:'#cba45f',pale:'#f2dfb7',line:'#33291b'},emerald:{gold:'#35c995',pale:'#baf5df',line:'#174c3c'},sapphire:{gold:'#579bff',pale:'#c5ddff',line:'#1d3e70'},ruby:{gold:'#ef526b',pale:'#ffd0d8',line:'#632432'},amethyst:{gold:'#b58aff',pale:'#e3d2ff',line:'#49336b'},arctic:{gold:'#65d9e8',pale:'#d0faff',line:'#24545c'},obsidian:{gold:'#d0b6a1',pale:'#f4e8dd',line:'#59483d'},copper:{gold:'#d88755',pale:'#f6d2bb',line:'#68402e'},aurora:{gold:'#79d9b4',pale:'#d0ffea',line:'#285b4b'},platinum:{gold:'#c8d0dc',pale:'#f0f4fa',line:'#465263'}};
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


/* MEMBER TOOLS: live account, session, service and help utilities */
function openToolModal(heading,body){
  if(!modalBox)return;
  modalBox.innerHTML='<button class="modal-close" aria-label="Close">×</button><span class="modal-crown">♤</span><p class="eyebrow">SUPREME MD V2 / MEMBER TOOLS</p><h3>'+escapeText(heading)+'</h3><div id="memberToolBody">'+body+'</div>';
  modal?.classList.add('show');modal?.setAttribute('aria-hidden','false');
  modalBox.querySelector('.modal-close')?.addEventListener('click',closeModal);
}
async function openMemberTool(kind){
  if(kind==='settings'){
    const user=await refreshSession();
    if(!user){openToolModal('SIGN IN REQUIRED','<p class="admin-note">Sign in to view your private profile and preferences.</p><button class="btn gold" id="toolLogin">MEMBER SIGN IN</button>');modalBox.querySelector('#toolLogin')?.addEventListener('click',()=>showAccount('login'));return}
    const joined=user.createdAt?new Date(user.createdAt).toLocaleDateString():'—';
    openToolModal('PROFILE & SETTINGS','<button type="button" class="tool-back" id="profileBack">← BACK</button><div class="tool-detail-list"><div class="tool-detail-row"><span>USERNAME</span><b>'+escapeText(user.username)+'</b></div><div class="tool-detail-row"><span>ACCOUNT ROLE</span><b>'+escapeText(user.role.toUpperCase())+'</b></div><div class="tool-detail-row"><span>MEMBER SINCE</span><b>'+escapeText(joined)+'</b></div></div><p class="admin-note">Choose an accent theme. Your selection is saved in this browser on this device.</p><div class="theme-choice-grid">'+Object.keys(themeNames).map(name=>'<button class="theme-choice '+(document.querySelector(".theme-choice[data-theme="+name+"]")?.classList.contains("active")?'active':'')+'" type="button" data-tool-theme="'+name+'"><i style="--swatch:'+themeNames[name].gold+'"></i><span>'+name.toUpperCase()+'</span></button>').join('')+'</div>');
    modalBox.querySelector('#profileBack')?.addEventListener('click',closeModal);modalBox.querySelectorAll('[data-tool-theme]').forEach(button=>button.addEventListener('click',()=>{applyTheme(button.dataset.toolTheme);modalBox.querySelectorAll('[data-tool-theme]').forEach(b=>b.classList.toggle('active',b===button))}));return;
  }
  if(kind==='support'){
    openToolModal('SUPPORT CENTRE','<div class="tool-faq"><b>HOW DO I CREATE AN ACCOUNT?</b><p>Choose Member Access, select Create an account, and follow the instructions. Use a unique password.</p></div><div class="tool-faq"><b>HOW DO I LINK WHATSAPP?</b><p>Sign in first, then choose QR code or Pairing Code in the Connection Centre. Only link your own account and never share a QR or pairing code.</p></div><div class="tool-faq"><b>WHY IS MY CONNECTION OFFLINE?</b><p>The API is hosted on a free service and may sleep or restart. Check service status, then try reconnecting.</p></div><div class="tool-faq"><b>WHERE CAN I GET HELP?</b><p>Use the official SUPREME community Telegram channel for general announcements. Do not post passwords, QR codes, pairing codes or private account details.</p></div><a class="btn outline" href="https://t.me/SUPREME_DOMAIN" target="_blank" rel="noopener">OPEN SUPREME COMMUNITY</a>');return;
  }
  if(kind==='guide'){
    openToolModal('SUPREME GUIDE','<p class="admin-note">A quick help guide for the current website version. This is an offline guide, not a connected generative AI service.</p><div class="tool-faq"><b>ACCOUNT ACCESS</b><p>Register with a username and a strong password of at least 10 characters. Sign in to access your private tools.</p></div><div class="tool-faq"><b>PAIRING CODE</b><p>Enter your own WhatsApp number with its country code. Copy the one-time code and enter it in WhatsApp → Linked devices.</p></div><div class="tool-faq"><b>QR CONNECTION</b><p>Open WhatsApp Linked devices on your phone and scan the QR displayed in your private signed-in session.</p></div><div class="tool-faq"><b>ADMIN ACCESS</b><p>Administrative tools are restricted to accounts with an authorized admin role.</p></div><p class="safe-note">SUPREME AI is available from the quick launch at the top of the page.</p>');return;
  }
  if(kind==='status'){
    openToolModal('LIVE SERVICE STATUS','<p class="admin-note" id="toolStatusText">Checking the website API and database…</p><div class="tool-detail-list" id="toolStatusList"></div><button class="btn outline" id="toolStatusRefresh" type="button">REFRESH STATUS</button>');
    const refresh=async()=>{
      const textNode=modalBox.querySelector('#toolStatusText');const list=modalBox.querySelector('#toolStatusList');if(!textNode||!list)return;
      textNode.textContent='Checking services…';list.innerHTML='';
      const checks=[['API SERVICE',API_BASE+'/api/health'],['PLATFORM STATUS',API_BASE+'/api/platform/status']];
      const results=await Promise.all(checks.map(async([name,url])=>{try{const response=await fetch(url,{cache:'no-store'});const data=await response.json();return {name,ok:response.ok,detail:name==='API SERVICE'?(data.database==='connected'?'API responding · Database connected':'API responded'):data.maintenanceMode?'Maintenance mode enabled':'Operational'}}catch(_){return {name,ok:false,detail:'Not responding'}}}));
      list.innerHTML=results.map(item=>'<div class="tool-detail-row"><span>'+item.name+'</span><b style="color:'+(item.ok?'#78d6a3':'#e5a36a')+'">'+(item.ok?'ONLINE':'UNAVAILABLE')+' · '+escapeText(item.detail)+'</b></div>').join('');
      textNode.textContent='Last checked: '+new Date().toLocaleTimeString()+'. Free hosting may sleep between requests.';
      const inline=document.getElementById('serviceStatusInline');if(inline)inline.innerHTML=results.every(x=>x.ok)?'<span class="status-dot"></span> API AND PLATFORM STATUS CHECKS PASSED.':'<span class="status-dot"></span> ONE OR MORE SERVICES DID NOT RESPOND.';
    };
    modalBox.querySelector('#toolStatusRefresh')?.addEventListener('click',refresh);refresh();return;
  }
  if(kind==='sessions'){
    const user=await refreshSession();
    if(!user){openToolModal('SIGN IN REQUIRED','<p class="admin-note">Sign in to manage your private WhatsApp session.</p><button class="btn gold" id="toolLogin">MEMBER SIGN IN</button>');modalBox.querySelector('#toolLogin')?.addEventListener('click',()=>showAccount('login'));return}
    openToolModal('SESSION MANAGER','<p class="admin-note" id="sessionManagerStatus">Loading your private session…</p><div class="tool-detail-list" id="sessionManagerDetails"></div><button class="btn outline" id="sessionManagerRefresh" type="button">REFRESH SESSION</button> <button class="btn outline" id="sessionManagerDisconnect" type="button">DISCONNECT SESSION</button>');
    const refresh=async()=>{
      const status=modalBox.querySelector('#sessionManagerStatus');const details=modalBox.querySelector('#sessionManagerDetails');if(!status||!details)return;
      try{const response=await fetch(API_BASE+'/api/whatsapp/session',{credentials:'include',cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load session.');const s=data.session||{};status.textContent='Your account session status is '+String(s.status||'unknown').toUpperCase()+'.';details.innerHTML='<div class="tool-detail-row"><span>STATUS</span><b>'+escapeText(String(s.status||'unknown').toUpperCase())+'</b></div><div class="tool-detail-row"><span>PHONE</span><b>'+escapeText(s.phoneMasked||'Not linked')+'</b></div><div class="tool-detail-row"><span>CONNECTED SINCE</span><b>'+escapeText(s.connectedAt?new Date(s.connectedAt).toLocaleString():'—')+'</b></div><div class="tool-detail-row"><span>LAST UPDATED</span><b>'+escapeText(s.updatedAt?new Date(s.updatedAt).toLocaleString():'—')+'</b></div><div class="tool-detail-row"><span>HOSTING</span><b>FREE · MAY SLEEP</b></div>'}
      catch(error){status.textContent=error.message;details.innerHTML=''}
    };
    modalBox.querySelector('#sessionManagerRefresh')?.addEventListener('click',refresh);
    modalBox.querySelector('#sessionManagerDisconnect')?.addEventListener('click',async()=>{const button=modalBox.querySelector('#sessionManagerDisconnect');if(!confirm('Disconnect your own WhatsApp session?'))return;button.disabled=true;try{const response=await fetch(API_BASE+'/api/whatsapp/session',{method:'DELETE',credentials:'include',headers:{'X-Requested-With':'SUPREME-MD-V2'}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not disconnect.');await refresh()}catch(error){modalBox.querySelector('#sessionManagerStatus').textContent=error.message}finally{button.disabled=false}});
    refresh();return;
  }
  if(kind==='notifications'){
    const user=await refreshSession();
    if(!user){openToolModal('SIGN IN REQUIRED','<p class="admin-note">Sign in to view your private account notifications.</p><button class="btn gold" id="toolLogin">MEMBER SIGN IN</button>');modalBox.querySelector('#toolLogin')?.addEventListener('click',()=>showAccount('login'));return}
    openToolModal('NOTIFICATION CENTRE','<p class="admin-note" id="notificationStatus">Loading your account activity…</p><div id="notificationItems" class="tool-detail-list"></div><button class="btn outline" id="notificationRefresh" type="button">REFRESH NOTIFICATIONS</button>');
    const refresh=async()=>{
      const status=modalBox.querySelector('#notificationStatus');const items=modalBox.querySelector('#notificationItems');if(!status||!items)return;
      try{const response=await fetch(API_BASE+'/api/member/activity',{credentials:'include',cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load notifications.');const activity=data.activity||[];items.innerHTML=activity.map(item=>'<div class="tool-detail-row"><span>'+escapeText(item.type||'UPDATE')+' · '+escapeText(item.createdAt?new Date(item.createdAt).toLocaleString():'Now')+'</span><b>'+escapeText(item.message||'Account update')+'</b></div>').join('')||'<p class="admin-note">No new notifications.</p>';status.textContent='Showing '+activity.length+' account update(s). More notification types will appear as they are added.'}
      catch(error){status.textContent=error.message}
    };
    modalBox.querySelector('#notificationRefresh')?.addEventListener('click',refresh);refresh();return;
  }
}
document.querySelectorAll('[data-member-tool]').forEach(button=>button.addEventListener('click',()=>openMemberTool(button.dataset.memberTool)));
/* Branded first-visit loading screen */
(function(){
  if(document.getElementById('supremeLoader'))return;
  const loader=document.createElement('div');loader.id='supremeLoader';loader.className='loading-screen';loader.innerHTML='<div class="loading-core"><div class="loading-emblem">♤</div><div class="loading-caption">SUPREME MD / INITIALISING</div><div class="loading-line"></div></div>';
  document.body.appendChild(loader);
  const hide=()=>setTimeout(()=>loader.classList.add('is-hidden'),650);
  if(document.readyState==='complete')hide();else window.addEventListener('load',hide,{once:true});
})();


/* SUPREME LIVE DASHBOARD UPGRADE — real per-member connection state */
async function refreshSupremeLiveDashboard(){
  const shell=document.querySelector('.dash-main');
  const metrics=document.querySelector('.metric-grid');
  if(!shell||!metrics)return;
  let refreshButton=shell.querySelector('#supremeDashboardRefresh');
  if(!refreshButton){
    const top=shell.querySelector('.dash-top');
    if(top){
      refreshButton=document.createElement('button');
      refreshButton.id='supremeDashboardRefresh';
      refreshButton.className='btn outline dashboard-refresh';
      refreshButton.type='button';
      refreshButton.textContent='REFRESH LIVE DATA';
      top.appendChild(refreshButton);
      refreshButton.addEventListener('click',refreshSupremeLiveDashboard);
    }
  }
  const user=await refreshSession();
  if(!user){
    metrics.innerHTML='<div class="metric"><span>ACCOUNT</span><b class="pending">LOCKED</b><small>Sign in to load your data</small></div><div class="metric"><span>WHATSAPP</span><b class="pending">—</b><small>Private session status</small></div><div class="metric"><span>TELEGRAM</span><b class="pending">—</b><small>Account link status</small></div>';
    const activity=document.querySelector('.activity-empty');
    if(activity)activity.innerHTML='<span>♤</span><b>Your private dashboard is locked</b><small>Sign in to view your own connection status and account activity.</small>';
    return;
  }
  if(refreshButton){refreshButton.disabled=true;refreshButton.textContent='REFRESHING…'}
  const get=async path=>{
    const response=await fetch(API_BASE+path,{credentials:'include',cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Request failed');
    return data;
  };
  const [wa,tg,activity]=await Promise.all([
    get('/api/whatsapp/session').catch(()=>null),
    get('/api/telegram/status').catch(()=>null),
    get('/api/member/activity').catch(()=>null)
  ]);
  const waState=wa?.session?.status||'unavailable';
  const tgState=!tg?'unavailable':!tg.enabled?'not configured':tg.linked?'linked':'not linked';
  const stateLabel=value=>String(value).replace(/_/g,' ').toUpperCase();
  metrics.innerHTML=
    '<div class="metric"><span>WHATSAPP SESSION</span><b class="'+(waState==='connected'?'live-good':'pending')+'">'+escapeText(stateLabel(waState))+'</b><small>'+(wa?.session?.phoneMasked?'Account · '+escapeText(wa.session.phoneMasked):'Your private device connection')+'</small></div>'+
    '<div class="metric"><span>TELEGRAM LINK</span><b class="'+(tg?.linked?'live-good':'pending')+'">'+escapeText(stateLabel(tgState))+'</b><small>'+(tg?.username?'@'+escapeText(tg.username):'Shared bot account link')+'</small></div>'+
    '<div class="metric"><span>MEMBER ACCOUNT</span><b class="live-good">'+escapeText(stateLabel(user.role))+'</b><small>Signed in as '+escapeText(user.username)+'</small></div>';
  const panel=document.querySelector('.activity-panel');
  if(panel){
    let list=panel.querySelector('.live-activity-list');
    if(!list){list=document.createElement('div');list.className='live-activity-list';panel.querySelector('.activity-empty')?.replaceWith(list);if(!panel.querySelector('.activity-empty'))panel.appendChild(list)}
    const rows=activity?.activity||[];
    list.innerHTML=rows.length?rows.slice(0,8).map(item=>'<div class="live-activity-row"><span class="live-activity-mark">✦</span><div><b>'+escapeText(item.message||'Account update')+'</b><small>'+escapeText(item.type||'UPDATE')+' · '+escapeText(item.createdAt?new Date(item.createdAt).toLocaleString():'Just now')+'</small></div></div>').join(''):'<div class="activity-empty"><span>⌁</span><b>No recent activity yet</b><small>New account and connection events will appear here as they are recorded.</small></div>';
  }
  const chip=document.querySelector('.demo-chip');
  if(chip)chip.textContent='LIVE MEMBER DATA';
  const caption=document.querySelector('.preview-caption');
  if(caption)caption.textContent='LIVE MEMBER VIEW · PERSONAL CONNECTION STATUS · '+new Date().toLocaleTimeString();
  if(refreshButton){refreshButton.disabled=false;refreshButton.textContent='REFRESH LIVE DATA'}
}
refreshSupremeLiveDashboard();


/* Secure account password controls */
const supremeOriginalOpenMemberTool=openMemberTool;
openMemberTool=async function(kind){
  await supremeOriginalOpenMemberTool(kind);
  if(kind!=='settings'||!modalBox||!modal?.classList.contains('show'))return;
  const body=modalBox.querySelector('#memberToolBody');
  if(!body||body.querySelector('#changePasswordForm'))return;
  const section=document.createElement('section');
  section.className='tool-faq';
  section.innerHTML='<b>ACCOUNT SECURITY</b><form id="changePasswordForm" class="auth-form"><label for="currentMemberPassword">CURRENT PASSWORD</label><input id="currentMemberPassword" type="password" autocomplete="current-password" minlength="10" maxlength="72" required><label for="newMemberPassword">NEW PASSWORD</label><input id="newMemberPassword" type="password" autocomplete="new-password" minlength="10" maxlength="72" required><label for="confirmMemberPassword">CONFIRM NEW PASSWORD</label><input id="confirmMemberPassword" type="password" autocomplete="new-password" minlength="10" maxlength="72" required><button class="btn gold" type="submit">UPDATE PASSWORD</button><p id="passwordChangeStatus" class="admin-note" role="status">Use a unique password and do not share it.</p></form>';
  body.appendChild(section);
  section.querySelector('#changePasswordForm').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;const status=section.querySelector('#passwordChangeStatus');const submit=form.querySelector('button[type="submit"]');
    const currentPassword=form.querySelector('#currentMemberPassword').value;const newPassword=form.querySelector('#newMemberPassword').value;const confirmPassword=form.querySelector('#confirmMemberPassword').value;
    if(newPassword!==confirmPassword){status.textContent='The new passwords do not match.';return}
    submit.disabled=true;submit.textContent='UPDATING…';
    try{const response=await fetch(API_BASE+'/api/auth/change-password',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Requested-With':'SUPREME-MD-V2'},body:JSON.stringify({currentPassword,newPassword})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Could not update password.');form.reset();status.textContent='Password updated successfully.'}
    catch(error){status.textContent=error.message}finally{submit.disabled=false;submit.textContent='UPDATE PASSWORD'}
  });
};


/* SUPREME AI — private saved conversations and multi-provider chat */
const supremePreviousOpenMemberTool=openMemberTool;
openMemberTool=async function(kind){
  await supremePreviousOpenMemberTool(kind);
  if(kind!=='ai')return;
  openToolModal('SUPREME AI','<p class="admin-note">Preparing your private AI workspace…</p>');
  const body=modalBox.querySelector('#memberToolBody');if(!body)return;
  const user=await refreshSession();
  if(!user){body.innerHTML='<p class="admin-note">Sign in to use your private Supreme AI workspace.</p><button class="btn gold" id="supremeAiLogin" type="button">MEMBER SIGN IN</button>';body.querySelector('#supremeAiLogin')?.addEventListener('click',()=>showAccount('login'));return}
  body.innerHTML='<div class="supreme-ai-workspace"><aside class="supreme-ai-sidebar"><button type="button" class="btn gold supreme-ai-new" id="supremeAiNew">＋ NEW CHAT</button><div class="supreme-ai-history-title">YOUR CONVERSATIONS</div><div id="supremeAiConversationList" class="supreme-ai-conversation-list"><p class="supreme-ai-status">Loading saved chats…</p></div><p class="supreme-ai-sidebar-foot">PRIVATE TO YOUR ACCOUNT</p></aside><section class="supreme-ai-main"><div class="supreme-ai-intro"><strong>♤ SUPREME AI / INTELLIGENCE CORE</strong><p>Your private AI workspace. Conversations are saved to your account. Never enter passwords, private codes or sensitive personal information.</p></div><div class="supreme-ai-toolbar"><label class="supreme-ai-model-label" for="supremeAiProvider">MODEL PROVIDER</label><select id="supremeAiProvider" class="supreme-ai-provider"><option value="">Loading providers…</option></select><button type="button" class="supreme-ai-delete" id="supremeAiDelete" disabled>DELETE CHAT</button></div><div id="supremeAiMessages" class="supreme-ai-messages" aria-live="polite"><div class="supreme-ai-message"><small>SUPREME AI</small>Welcome. Choose a provider and ask your first question.</div></div><form id="supremeAiForm" class="supreme-ai-form"><textarea id="supremeAiPrompt" maxlength="2000" required placeholder="Message Supreme AI…"></textarea><div class="supreme-ai-form-bottom"><p id="supremeAiStatus" class="supreme-ai-status" role="status">Loading available providers…</p><button class="btn gold" type="submit">SEND MESSAGE</button></div></form></section></div>';
  const form=body.querySelector('#supremeAiForm'),input=body.querySelector('#supremeAiPrompt'),messages=body.querySelector('#supremeAiMessages'),status=body.querySelector('#supremeAiStatus'),send=form.querySelector('button[type="submit"]'),selector=body.querySelector('#supremeAiProvider'),list=body.querySelector('#supremeAiConversationList'),newButton=body.querySelector('#supremeAiNew'),deleteButton=body.querySelector('#supremeAiDelete');
  let history=[],conversationId=null,conversationTitle='New conversation';
  const headers={'Content-Type':'application/json','X-Requested-With':'SUPREME-MD-V2'};
  const api=async(path,options={})=>{const response=await fetch(API_BASE+path,{credentials:'include',cache:'no-store',...options});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Request failed.');return data};
  const addBubble=(item)=>{const bubble=document.createElement('div');bubble.className='supreme-ai-message '+(item.role==='user'?'user':'');const label=document.createElement('small');label.textContent=item.role==='user'?'YOU':'SUPREME AI';bubble.appendChild(label);bubble.appendChild(document.createTextNode(item.content));messages.appendChild(bubble)};
  const renderHistory=()=>{messages.innerHTML='';if(!history.length){const welcome=document.createElement('div');welcome.className='supreme-ai-message';welcome.innerHTML='<small>SUPREME AI</small>Welcome. Ask a question to begin a new conversation.';messages.appendChild(welcome)}else history.forEach(addBubble);messages.scrollTop=messages.scrollHeight};
  const refreshList=async()=>{try{const data=await api('/api/ai/conversations');list.innerHTML='';if(!data.conversations.length){list.innerHTML='<p class="supreme-ai-status">No saved conversations yet.</p>';return}data.conversations.forEach(item=>{const row=document.createElement('button');row.type='button';row.className='supreme-ai-history-item'+(String(item.id)===String(conversationId)?' active':'');row.textContent=item.title||'New conversation';row.addEventListener('click',()=>loadConversation(item.id));list.appendChild(row)})}catch(error){list.textContent=error.message}};
  const loadConversation=async(id)=>{try{const data=await api('/api/ai/conversations/'+encodeURIComponent(id));const item=data.conversation;conversationId=String(item.id);conversationTitle=item.title||'New conversation';history=Array.isArray(item.messages)?item.messages:[];selector.value=item.provider;renderHistory();deleteButton.disabled=false;status.textContent='Saved conversation opened.';await refreshList()}catch(error){status.textContent=error.message}};
  const newChat=()=>{conversationId=null;conversationTitle='New conversation';history=[];renderHistory();deleteButton.disabled=true;status.textContent='New conversation · choose a model and start chatting.';refreshList()};
  newButton.addEventListener('click',newChat);
  deleteButton.addEventListener('click',async()=>{if(!conversationId||!confirm('Delete this saved conversation?'))return;deleteButton.disabled=true;try{await api('/api/ai/conversations/'+encodeURIComponent(conversationId),{method:'DELETE',headers});newChat();status.textContent='Conversation deleted.'}catch(error){status.textContent=error.message;deleteButton.disabled=false}});
  try{
    const data=await api('/api/ai/models');selector.innerHTML='';
    data.providers.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.disabled=!item.enabled;option.textContent=item.label+' — '+(item.enabled?item.model:'NOT CONFIGURED');selector.appendChild(option)});
    const first=data.providers.find(item=>item.enabled);if(first)selector.value=first.id;
    status.textContent=first?'Your conversations are private and saved automatically.':'No AI providers are configured. The administrator must add provider API keys in Render.';
  }catch(error){selector.innerHTML='<option value="">Providers unavailable</option>';status.textContent=error.message}
  await refreshList();
  form.addEventListener('submit',async event=>{
    event.preventDefault();const message=input.value.trim(),provider=selector.value;if(!message)return;if(!provider){status.textContent='No AI provider is available yet.';return}
    const nextHistory=[...history,{role:'user',content:message}];addBubble({role:'user',content:message});input.value='';send.disabled=true;send.textContent='THINKING…';status.textContent='Connecting to '+selector.options[selector.selectedIndex].text+'…';
    try{
      const data=await api('/api/ai/chat',{method:'POST',headers,body:JSON.stringify({provider,message,history:history.slice(-6)})});
      const assistant={role:'assistant',content:data.answer};history=[...nextHistory,assistant].slice(-24);addBubble(assistant);
      if(!conversationId){conversationTitle=message.slice(0,70)||'New conversation';const created=await api('/api/ai/conversations',{method:'POST',headers,body:JSON.stringify({provider,title:conversationTitle})});conversationId=String(created.conversation.id);deleteButton.disabled=false}
      await api('/api/ai/conversations/'+encodeURIComponent(conversationId),{method:'PATCH',headers,body:JSON.stringify({provider,title:conversationTitle,messages:history})});
      status.textContent='Saved · '+data.providerLabel+' · '+data.model;await refreshList();messages.scrollTop=messages.scrollHeight;
    }catch(error){status.textContent=error.message||'Could not reach Supreme AI.'}
    finally{send.disabled=false;send.textContent='SEND MESSAGE';input.focus()}
  });
};
