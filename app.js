const menu=document.querySelector('.menu-toggle');const nav=document.querySelector('nav');menu?.addEventListener('click',()=>nav.classList.toggle('open'));document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));const modal=document.getElementById('modal');const title=document.getElementById('modalTitle');const copy=document.getElementById('modalText');function showModal(t,m){title.textContent=t;copy.textContent=m;modal.classList.add('show');modal.setAttribute('aria-hidden','false')}function closeModal(){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}document.querySelectorAll('.connect-option').forEach(button=>button.addEventListener('click',()=>{const method=button.dataset.method;showModal(method.toUpperCase()+' SELECTED','This is a frontend preview only. Live WhatsApp pairing is not connected yet. A separate backend must securely create the QR or pairing code and manage the session. Never share your WhatsApp verification code or session credentials with anyone.')}));document.getElementById('accountBtn')?.addEventListener('click',()=>showModal('MEMBER ACCESS','Account registration and sign-in are not active yet. Secure authentication, a database and server-side session handling must be configured first. No account details are collected here.'));document.getElementById('adminPreview')?.addEventListener('click',()=>showModal('ADMIN SUITE PREVIEW','The admin interface is a design preview. Real role permissions, member management and analytics require authenticated server-side controls. This preview does not grant administrative access.'));document.querySelector('.modal-close')?.addEventListener('click',closeModal);document.querySelector('.modal-ok')?.addEventListener('click',closeModal);modal?.addEventListener('click',e=>{if(e.target===modal)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
const themeToggle=document.getElementById('themeToggle');
const themeMenu=document.getElementById('themeMenu');
const themeNames={
  royal:{gold:'#cba45f',pale:'#f2dfb7',line:'#33291b'},
  emerald:{gold:'#35c995',pale:'#baf5df',line:'#174c3c'},
  sapphire:{gold:'#579bff',pale:'#c5ddff',line:'#1d3e70'},
  ruby:{gold:'#ef526b',pale:'#ffd0d8',line:'#632432'},
  amethyst:{gold:'#b58aff',pale:'#e3d2ff',line:'#49336b'},
  arctic:{gold:'#65d9e8',pale:'#d0faff',line:'#24545c'}
};
function applyTheme(name){
  const theme=themeNames[name]||themeNames.royal;
  const root=document.documentElement;
  root.style.setProperty('--gold',theme.gold);
  root.style.setProperty('--pale',theme.pale);
  root.style.setProperty('--line',theme.line);
  document.querySelectorAll('.theme-choice').forEach(choice=>choice.classList.toggle('active',choice.dataset.theme===name));
  try{localStorage.setItem('supreme-md-v2-theme',name)}catch(e){}
  const dot=document.querySelector('.theme-dot');if(dot)dot.style.background=theme.gold;
}
let savedTheme='royal';try{savedTheme=localStorage.getItem('supreme-md-v2-theme')||'royal'}catch(e){}
applyTheme(savedTheme);
themeToggle?.addEventListener('click',()=>{
  const opening=themeMenu.hidden;themeMenu.hidden=!opening;
  themeToggle.setAttribute('aria-expanded',String(opening));
});
document.querySelectorAll('.theme-choice').forEach(choice=>choice.addEventListener('click',()=>{
  applyTheme(choice.dataset.theme);themeMenu.hidden=true;themeToggle.setAttribute('aria-expanded','false');
}));
document.addEventListener('click',event=>{
  if(!event.target.closest('.theme-wrap')){if(themeMenu)themeMenu.hidden=true;themeToggle?.setAttribute('aria-expanded','false')}
});
