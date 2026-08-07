(() => {
  'use strict';

  const PUBLIC = new Set(['login.html','register.html','forgot-password.html','reset-password.html']);
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const cfg = window.PSM_SUPABASE;
  const ACTIVE_USER_KEY = 'PSM_ACTIVE_USER_ID';
  let client = null;
  let currentUser = null;
  let recoveryMode = false;
  let authReadyResolve;
  const authReady = new Promise(resolve => { authReadyResolve = resolve; });

  const $ = id => document.getElementById(id);
  const msg = (text,type='info') => {
    const el=$('authMessage');
    if(!el) return;
    el.textContent=text;
    el.className=`auth-message show ${type}`;
  };
  const hideLoading = () => $('authLoading')?.classList.add('hidden');
  const safeNext = raw => {
    try {
      if(!raw) return 'index.html';
      const u=new URL(raw,location.href);
      if(u.origin!==location.origin) return 'index.html';
      const last=u.pathname.split('/').pop()||'index.html';
      if(PUBLIC.has(last.toLowerCase())) return 'index.html';
      return last+u.search+u.hash;
    } catch { return 'index.html'; }
  };
  const getName = user => user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';
  const escapeHtml = s => String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  async function profileFor(user){
    if(!user || !client) return null;
    const {data,error}=await client.from('profiles').select('id,full_name,email,role,created_at,updated_at').eq('id',user.id).maybeSingle();
    if(error) throw error;
    return data || {id:user.id,full_name:getName(user),email:user.email,role:'student'};
  }

  function createAccountArea(profile,user,compact=false){
    const area=document.createElement('div');
    area.className=compact ? 'account-area account-area-mobile' : 'account-area';
    area.innerHTML=`
      <div class="account-name" title="${escapeHtml(user?.email||'')}">${escapeHtml(profile?.full_name||getName(user))}</div>
      <div class="account-actions">
        <a href="profile.html" aria-label="Open profile">Profile</a>
        <button type="button" data-logout aria-label="Log out">Logout</button>
      </div>`;
    return area;
  }

  async function decorate(user){
    if(!user) return;
    let profile;
    try { profile=await profileFor(user); }
    catch(e) { console.warn('Profile could not be loaded:',e.message); profile={full_name:getName(user),email:user.email}; }

    const displayName=profile?.full_name||getName(user);
    document.querySelectorAll('[data-user-name]').forEach(el=>{
      el.textContent=displayName;
      el.title=user?.email||'';
    });
    const welcome=document.querySelector('.welcome-card h1');
    if(welcome) welcome.textContent=`Welcome back, ${displayName}.`;

    // Fallback for older pages that do not yet contain the account controls.
    document.querySelectorAll('.sidebar-bottom').forEach(box=>{
      if(!box.querySelector('[data-account-area="desktop"]')) {
        const area=createAccountArea(profile,user,false);
        area.dataset.accountArea='desktop';
        box.prepend(area);
      }
    });

    document.querySelectorAll('.mobile-topbar').forEach(header=>{
      if(!header.querySelector('[data-account-area="mobile"]')) {
        const area=createAccountArea(profile,user,true);
        area.dataset.accountArea='mobile';
        header.append(area);
      }
    });
  }

  function setActiveUser(user){
    const id=user?.id||null;
    if(id) localStorage.setItem(ACTIVE_USER_KEY,id); else localStorage.removeItem(ACTIVE_USER_KEY);
    window.PSMStorage?.setActiveUser?.(id);
  }

  async function logout(){
    if(client) await client.auth.signOut();
    setActiveUser(null);
    location.replace('login.html');
  }

  async function waitForUser(timeoutMs=10000){
    await Promise.race([
      authReady,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Authentication timed out.')),timeoutMs))
    ]);
    return currentUser;
  }

  async function initialize(){
    try {
      if(!cfg?.url||!cfg?.publishableKey||!window.supabase){
        throw new Error('Supabase Auth configuration is unavailable.');
      }

      client=window.supabase.createClient(cfg.url,cfg.publishableKey,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
      });

      window.PSM_AUTH={
        client,
        getUser:()=>currentUser,
        waitForUser,
        ready:authReady,
        profileFor,
        logout
      };

      client.auth.onAuthStateChange((event,session)=>{
        if(event==='PASSWORD_RECOVERY') recoveryMode=true;
        currentUser=session?.user||null;
        setActiveUser(currentUser);
        window.dispatchEvent(new CustomEvent('psm-auth-change',{detail:{user:currentUser}}));
      });

      const {data,error}=await client.auth.getSession();
      if(error) throw error;
      currentUser=data?.session?.user||null;
      setActiveUser(currentUser);
      authReadyResolve({client,user:currentUser});

      if(!PUBLIC.has(page) && !currentUser){
        const next=encodeURIComponent((location.pathname.split('/').pop()||'index.html')+location.search+location.hash);
        location.replace(`login.html?next=${next}`);
        return;
      }

      if(PUBLIC.has(page) && currentUser && page!=='reset-password.html'){
        location.replace(safeNext(new URLSearchParams(location.search).get('next')));
        return;
      }

      if(page==='reset-password.html' && !currentUser){
        bindForms();
        const form=$('resetForm');
        if(form) setBusy(form,true);
        hideLoading();
        msg('This password reset link is invalid or has expired. Request a new link from the sign-in page.','error');
        return;
      }

      if(currentUser) await decorate(currentUser);
      bindForms();
      hideLoading();
    } catch(error) {
      console.error('PSM authentication initialization failed:',error);
      authReadyResolve({client:null,user:null,error});
      hideLoading();
      msg(error.message || 'Authentication could not be initialized.','error');
    }
  }

  function setBusy(form,busy){ form?.querySelectorAll('button,input').forEach(el=>el.disabled=busy); }

  function bindForms(){
    $('loginForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const f=e.currentTarget; setBusy(f,true);
      const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
      setBusy(f,false);
      if(error) return msg(error.message,'error');
      currentUser=data?.user||null;
      setActiveUser(currentUser);
      location.replace(safeNext(new URLSearchParams(location.search).get('next')));
    });

    $('registerForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const f=e.currentTarget,full_name=$('fullName').value.trim(),email=$('email').value.trim(),password=$('password').value,confirm=$('confirmPassword').value;
      if(full_name.length<2) return msg('Please enter your full name.','error');
      if(password.length<8) return msg('Password must contain at least 8 characters.','error');
      if(password!==confirm) return msg('Passwords do not match.','error');
      setBusy(f,true);
      const redirectTo=new URL('login.html?confirmed=1',location.href).href;
      const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name},emailRedirectTo:redirectTo}});
      setBusy(f,false);
      if(error) return msg(error.message,'error');
      if(data.session){ location.replace('index.html'); return; }
      f.reset(); msg('Account created. Check your email and confirm your account before signing in.','success');
    });

    $('forgotForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const f=e.currentTarget;
      const email=$('email').value.trim();
      if(!email) return msg('Please enter your email address.','error');
      setBusy(f,true);
      const redirectTo=new URL('reset-password.html',location.href).href;
      const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
      setBusy(f,false);
      if(error) return msg(error.message,'error');
      f.reset();
      msg('If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.','success');
    });

    $('resetForm')?.addEventListener('submit',async e=>{
      e.preventDefault(); const f=e.currentTarget,p=$('password').value,c=$('confirmPassword').value;
      if(p.length<8) return msg('Password must contain at least 8 characters.','error');
      if(p!==c) return msg('Passwords do not match.','error');
      setBusy(f,true);
      const {error}=await client.auth.updateUser({password:p});
      if(error){ setBusy(f,false); return msg(error.message,'error'); }
      await client.auth.signOut();
      setActiveUser(null);
      msg('Password updated successfully. Redirecting to sign in…','success');
      setTimeout(()=>location.replace('login.html?password_updated=1'),900);
    });

    $('profileForm')?.addEventListener('submit',async e=>{
      e.preventDefault(); const f=e.currentTarget,name=$('fullName').value.trim();
      if(name.length<2) return msg('Please enter your full name.','error');
      setBusy(f,true);
      const {error:a}=await client.auth.updateUser({data:{full_name:name}});
      const {error:b}=await client.from('profiles').upsert({id:currentUser.id,full_name:name,email:currentUser.email,updated_at:new Date().toISOString()},{onConflict:'id'});
      setBusy(f,false); if(a||b) return msg((a||b).message,'error');
      msg('Profile updated successfully.','success');
      document.querySelectorAll('[data-user-name],.account-name').forEach(el=>el.textContent=name);
    });

    if(page==='login.html'){
      const params=new URLSearchParams(location.search);
      if(params.has('confirmed')) msg('Email confirmed. You can now sign in.','success');
      if(params.has('password_updated')) msg('Password updated successfully. Sign in with your new password.','success');
    }
    if(page==='profile.html'&&currentUser) loadProfile();
  }

  async function loadProfile(){
    const p=await profileFor(currentUser);
    $('fullName').value=p?.full_name||getName(currentUser);
    $('profileEmail').textContent=currentUser.email||'';
    $('profileRole').textContent=p?.role||'student';
    $('profileCreated').textContent=new Date(p?.created_at||currentUser.created_at).toLocaleString();
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-logout]');
    if(!button) return;
    event.preventDefault();
    logout().catch(error=>{
      console.error('Logout failed:',error);
      location.replace('login.html');
    });
  });

  document.addEventListener('DOMContentLoaded',initialize);
})();
