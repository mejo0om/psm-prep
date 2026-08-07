let records=[];
const examNumbers=[1,2,3,4,5,6,8,9];
Promise.all([
 ...[1,2,3,4].map(n=>fetch(`data/elements/element${n}.json`).then(r=>r.json())),
 ...examNumbers.map(n=>fetch(`data/exams/exam${n}.json`).then(r=>r.json())),
 fetch('data/acronyms.json?v=3.2.4', { cache: 'no-store' }).then(r=>r.json())
]).then(data=>{
 const acronyms=data.pop();
 const examGroups=data.splice(4);
 data.flat().forEach(q=>records.push({type:'question',element:q.element,title:q.question,subtitle:`Element ${q.element} · ${q.bookSection||''} ${q.bookTopic||''}`,body:[...q.options,q.correctOptionText,q.bookReference,q.sourcePage].filter(Boolean).join(' '),id:q.id}));
 examGroups.forEach((group,index)=>group.forEach(q=>records.push({type:'question',element:q.element,title:q.question,subtitle:`Mock Exam ${examNumbers[index]} · ${q.bookSection||''} ${q.bookTopic||''}`,body:[...q.options,q.correctOptionText,q.bookReference,q.sourcePage].filter(Boolean).join(' '),id:q.id})));
 acronyms.forEach(a=>records.push({type:'acronym',element:a.element,title:`${a.acronym} — ${a.fullName}`,subtitle:`Element ${a.element} · Book page ${a.bookPage||'—'}`,body:a.description,id:a.acronym}));
 runSearch();
}).catch(error=>{
 console.error(error);
 document.getElementById('searchResults').innerHTML='<p class="muted">Some content could not be loaded.</p>';
});
['globalSearch','typeFilter','elementFilter'].forEach(id=>document.getElementById(id).addEventListener('input',runSearch));
function runSearch(){
 const q=document.getElementById('globalSearch').value.trim().toLowerCase(),type=document.getElementById('typeFilter').value,el=document.getElementById('elementFilter').value;
 const list=records.filter(r=>(!q||`${r.title} ${r.subtitle} ${r.body}`.toLowerCase().includes(q))&&(type==='all'||r.type===type)&&(el==='all'||String(r.element)===el)).slice(0,100);
 document.getElementById('searchCount').textContent=`${list.length} result${list.length===1?'':'s'} shown`;
 document.getElementById('searchResults').innerHTML=list.map(r=>`<article class="search-result"><span class="badge">${r.type}</span><h3>${r.title}</h3><p>${r.subtitle}</p><small>${r.body.slice(0,220)}</small></article>`).join('')||'<p class="muted">No matching content.</p>';
}
