(function(){
 const root=document.documentElement, data=PSMStorage.get();
 root.dataset.theme=data.settings.theme||'light';
 document.querySelectorAll('#themeToggle').forEach(btn=>btn.addEventListener('click',()=>{
   const next=root.dataset.theme==='dark'?'light':'dark';
   root.dataset.theme=next;
   const d=PSMStorage.get();d.settings.theme=next;PSMStorage.save(d);
 }));
 const s=PSMStorage.getSummary();
 const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
 set('homeAccuracy',s.accuracy+'%');
 set('homeSolved',s.uniqueSolved);
 set('homeWrong',s.wrong);
 set('homeFavorites',s.favorites);
 set('homeStreak',s.currentStreak);
 set('homeMastered',s.mastered);
 const bar=document.getElementById('homeAccuracyBar');if(bar)bar.style.width=s.accuracy+'%';
})();
