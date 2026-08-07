const data=PSMStorage.get(), summary=PSMStorage.getSummary();
const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
set('dashAccuracy',summary.accuracy+'%');set('dashSolved',summary.uniqueSolved);set('dashStreak',summary.currentStreak);set('dashMastered',summary.mastered);

const today=new Date().toISOString().slice(0,10);
const todayCount=data.history.filter(h=>h.date.slice(0,10)===today).length;
const goal=data.settings.dailyGoal||20;
set('goalValue',`${todayCount}/${goal}`);
document.getElementById('goalRing').style.setProperty('--p',Math.min(100,Math.round(todayCount/goal*100)));

const last=data.exams[0];
if(last)document.getElementById('dashboardExam').innerHTML=`<h2>${last.percentage}%</h2><p>${last.score}/${last.total} correct · ${Math.round((last.duration||0)/60)} min</p><a class="button secondary" href="progress.html">View History</a>`;
document.getElementById('dashboardAchievements').innerHTML=data.achievements.length?data.achievements.slice(-4).reverse().map(a=>`<span class="achievement">🏅 ${a.name}</span>`).join(''):'<p class="muted">Your achievements will appear here.</p>';

const lastHistory=data.history[0];
if(lastHistory){
 set('continueTitle',lastHistory.topic||`Element ${lastHistory.element}`);
 set('continueText',`Continue from your most recent ${lastHistory.correct?'correct':'incorrect'} answer.`);
 document.getElementById('continueLink').href=lastHistory.correct?'practice.html':'practice.html?mode=mistakes';
}

function drawBarChart(canvas,labels,values,maxValue=100){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=34;
 ctx.clearRect(0,0,w,h);ctx.font='14px Segoe UI';ctx.textAlign='center';
 const gap=(w-pad*2)/values.length,barW=Math.min(48,gap*.55);
 values.forEach((v,i)=>{
   const x=pad+gap*i+gap/2, bh=(h-70)*(v/maxValue), y=h-34-bh;
   ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
   ctx.fillRect(x-barW/2,y,barW,bh);
   ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
   ctx.fillText(labels[i],x,h-12);ctx.fillText(v,x,y-8);
 });
}
const days=[];const counts=[];
for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);days.push(d.toLocaleDateString('en',{weekday:'short'}));counts.push(data.history.filter(h=>h.date.slice(0,10)===key).length)}
drawBarChart(document.getElementById('weeklyChart'),days,counts,Math.max(1,...counts));

const elementVals=[1,2,3,4].map(e=>{const list=data.history.filter(h=>h.element===e);return list.length?Math.round(list.filter(h=>h.correct).length/list.length*100):0});
drawBarChart(document.getElementById('elementChart'),['E1','E2','E3','E4'],elementVals,100);
