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
  }catch(error){message.textContent=error.message||'Could not reach the account service.';submit.disabled=false;submit.textContent=mode==='register'?'CREATE ACCOUNT ↗':'SIGN IN ↗'}
}
async function refreshSession(){
  const accountButton=document.getElementById('accountBtn');
  try{const response=await fetch(API_BASE+'/api/auth/me',{credentials:'include'});if(!response.ok){if(accountButton)accountButton.textContent='MEMBER ACCESS ↗';const signOutButton=document.getElementById('signOutBtn');if(signOutButton)signOutButton.hidden=true;return null}
    const data=await response.json();if(accountButton)accountButton.textContent='SIGNED IN: '+data.user.username.toUpperCase();
    const signOutButton=document.getElementById('signOutBtn');if(signOutButton)signOutButton.hidden=false;
    const greeting=document.querySelector('.dash-greeting');if(greeting)greeting.textContent='WELCOME, '+data.user.username.toUpperCase();
    const demo=document.querySelector('.demo-chip');if(demo)demo.textContent=data.user.role.toUpperCase();
    const caption=document.querySelector('.preview-caption');if(caption)caption.textContent='SIGNED IN AS '+data.user.role.toUpperCase()+' · LIVE ACCOUNT SESSION';
    return data.user;
  }catch(_){return null}
}
document.querySelectorAll('.connect-option').forEach(button=>button.addEventListener('click',()=>showModal(button.dataset.method.toUpperCase()+' SELECTED','WhatsApp QR and pairing are not connected yet. Your account system is being activated first. Never share verification codes or session credentials.')));
document.getElementById('accountBtn')?.addEventListener('click',()=>{showAccount('login');refreshSession().then(user=>{if(!user||!modal?.classList.contains('show'))return;modalBox.innerHTML='<button class="modal-close" aria-label="Close">×</button><span class="modal-crown">⟡</span><p class="eyebrow">SUPREME MD V2 / MEMBER IDENTITY</p><h3>YOU ARE SIGNED IN</h3><p>Welcome back, '+user.username+'. Your '+user.role+' account is active.</p><button class="btn gold" id="modalSignOut" type="button">SIGN OUT ↗</button>';modalBox.querySelector('.modal-close').addEventListener('click',closeModal);modalBox.querySelector('#modalSignOut').addEventListener('click',logout)})});document.getElementById('signOutBtn')?.addEventListener('click',logout);
async function logout(){try{await fetch(API_BASE+'/api/auth/logout',{method:'POST',credentials:'include',headers:{'X-Requested-With':'SUPREME-MD-V2'}})}finally{closeModal();const b=document.getElementById('accountBtn');if(b)b.textContent='MEMBER ACCESS ↗';const signOutButton=document.getElementById('signOutBtn');if(signOutButton)signOutButton.hidden=true;const g=document.querySelector('.dash-greeting');if(g)g.textContent='WELCOME TO YOUR SPACE'}}
document.getElementById('adminPreview')?.addEventListener('click',async()=>{const response=await fetch(API_BASE+'/api/admin/overview',{credentials:'include'});const data=await response.json();if(response.ok)showModal('ADMIN COMMAND SUITE','Members: '+data.overview.members+' · New members in 7 days: '+data.overview.new_members);else showModal('ADMIN ACCESS','Sign in with an authorized admin account to access the protected command suite. '+(data.error||''))});
modal?.querySelector('.modal-close')?.addEventListener('click',closeModal);modal?.querySelector('.modal-ok')?.addEventListener('click',closeModal);modal?.addEventListener('click',e=>{if(e.target===modal)closeModal();if(e.target.closest('.modal-close'))closeModal();if(e.target.closest('.modal-ok'))closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
const authStyles=document.createElement('style');authStyles.textContent='.auth-form{display:grid;gap:10px;text-align:left;margin:18px 0}.password-wrap{display:flex;gap:7px;align-items:stretch}.password-wrap input{min-width:0;flex:1}.password-toggle{background:#211b12;border:1px solid var(--line);color:var(--gold);padding:0 12px;font:700 9px Orbitron;cursor:pointer;letter-spacing:1px}.auth-form button[disabled]{opacity:.6;cursor:wait}.auth-form label{font-size:10px;letter-spacing:2px;color:var(--gold)}.auth-form input{width:100%;box-sizing:border-box;background:#10100f;border:1px solid var(--line);color:#fff;padding:13px;border-radius:3px;font:inherit}.auth-form button{margin-top:8px}.auth-switch{font-size:13px}.auth-switch button{background:none;border:0;color:var(--gold);font:inherit;text-decoration:underline;cursor:pointer}';document.head.appendChild(authStyles);
refreshSession();
const themeToggle=document.getElementById('themeToggle');const themeMenu=document.getElementById('themeMenu');
const themeNames={royal:{gold:'#cba45f',pale:'#f2dfb7',line:'#33291b'},emerald:{gold:'#35c995',pale:'#baf5df',line:'#174c3c'},sapphire:{gold:'#579bff',pale:'#c5ddff',line:'#1d3e70'},ruby:{gold:'#ef526b',pale:'#ffd0d8',line:'#632432'},amethyst:{gold:'#b58aff',pale:'#e3d2ff',line:'#49336b'},arctic:{gold:'#65d9e8',pale:'#d0faff',line:'#24545c'}};
function applyTheme(name){const theme=themeNames[name]||themeNames.royal;const root=document.documentElement;root.style.setProperty('--gold',theme.gold);root.style.setProperty('--pale',theme.pale);root.style.setProperty('--line',theme.line);document.querySelectorAll('.theme-choice').forEach(choice=>choice.classList.toggle('active',choice.dataset.theme===name));try{localStorage.setItem('supreme-md-v2-theme',name)}catch(e){}const dot=document.querySelector('.theme-dot');if(dot)dot.style.background=theme.gold}
let savedTheme='royal';try{savedTheme=localStorage.getItem('supreme-md-v2-theme')||'royal'}catch(e){}applyTheme(savedTheme);
themeToggle?.addEventListener('click',()=>{const opening=themeMenu.hidden;themeMenu.hidden=!opening;themeToggle.setAttribute('aria-expanded',String(opening))});
document.querySelectorAll('.theme-choice').forEach(choice=>choice.addEventListener('click',()=>{applyTheme(choice.dataset.theme);themeMenu.hidden=true;themeToggle.setAttribute('aria-expanded','false')}));
document.addEventListener('click',event=>{if(!event.target.closest('.theme-wrap')){if(themeMenu)themeMenu.hidden=true;themeToggle?.setAttribute('aria-expanded','false')}});
