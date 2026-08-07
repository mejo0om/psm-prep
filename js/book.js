Promise.all([
 fetch('data/book-sections.json').then(r=>r.json()),
 ...[1,2,3,4].map(n=>fetch(`data/elements/element${n}.json`).then(r=>r.json()))
]).then(([sections,...groups])=>{
 const menu=document.getElementById('bookMenu'),list=document.getElementById('sectionList'),summary=document.getElementById('bookSummary');
 const titles={1:'Process safety leadership',2:'Management of process risk',3:'Process safety hazard control',4:'Fire and explosion protection'};
 menu.innerHTML=[1,2,3,4].map(e=>`<button data-e="${e}" class="${e===1?'active':''}"><b>Element ${e}</b><br><small>${titles[e]}</small></button>`).join('');
 function render(e){
   document.querySelectorAll('#bookMenu button').forEach(b=>b.classList.toggle('active',Number(b.dataset.e)===e));
   const qs=groups[e-1],answered=qs.filter(q=>PSMStorage.get().questionStats[q.id]).length;
   summary.innerHTML=`<span class="eyebrow">ELEMENT ${e}</span><h2>${titles[e]}</h2><p>${qs.length} official question-bank items · ${answered} answered</p><div class="progress-track"><span style="width:${Math.round(answered/qs.length*100)}%"></span></div>`;
   list.innerHTML=sections[e].map(s=>{
     const mapped=qs.filter(q=>q.bookSection===s.code).length;
     return `<article class="section-card"><header><div><span class="badge">${s.code}</span><h3>${s.topic}</h3></div><b>${mapped} questions</b></header><p>Official book pages ${s.start}${s.end!==s.start?`–${s.end}`:''}</p><a class="button secondary" href="practice.html?section=${s.code}">Practice this section</a></article>`;
   }).join('');
 }
 menu.querySelectorAll('button').forEach(b=>b.onclick=()=>render(Number(b.dataset.e)));render(1);
});
