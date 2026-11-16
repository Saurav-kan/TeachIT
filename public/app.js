import { Board } from './board.js';
import { Microphone } from './microphone.js';
import { Captions } from './captions.js';
import { AnalysisTrigger } from './analysis-trigger.js';
import { sourceDocuments, normalizeEvidence } from './evidence.js';
import { advanceQuestion, answerSinceQuestion } from './questions.js';

const $=id=>document.getElementById(id);
let followLatestNotes=true,noteTick=0;
const noteSnapshots=new Map(),noteOrder=new Map();
function referenceTab(name,focus=false){
  for(const key of ['notes','checks','transcript']){const selected=key===name;const tab=$(`${key}Tab`);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$(`${key}Panel`).hidden=!selected;}
  if(focus)$(`${name}Tab`).focus();
  if(name==='transcript')resizeTranscript();
}
for(const [i,key] of ['notes','checks','transcript'].entries()){
  $(`${key}Tab`).onclick=()=>referenceTab(key);
  $(`${key}Tab`).onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%3;else if(e.key==='ArrowLeft')next=(i+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;e.preventDefault();referenceTab(['notes','checks','transcript'][next],true);};
}
function followNotes(value){followLatestNotes=value;$('followNotes').setAttribute('aria-pressed',String(value));$('followNotes').textContent=value?'Following':'↑ Latest';}
$('followNotes').onclick=()=>{followNotes(true);renderNotes();$('notebookContent').scrollTop=0;};
$('notebookContent').onscroll=()=>{followNotes($('notebookContent').scrollTop<20);};
const questionOpen=()=>state.activeQuestion&&state.activeQuestion.status!=='answered';
const state={mode:'learn',running:false,elapsed:0,startTime:0,duration:600,hints:false,topic:'How photosynthesis works',materials:'',notes:[],analyses:0,lastResult:null,live:false,vision:false,busy:false,epoch:0,lastCall:0,lastSent:'',previousBoard:null,boardRevision:-1,changedAt:0,autoTimer:null,stream:null,recognition:null,micWanted:false,boardVisible:true};
const microphone=new Microphone({onState:renderMicrophoneState,onLevel:renderMicrophoneLevel});
const captions=new Captions({createRecognition:()=>{const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition)throw Error('Unavailable');return new Recognition();},onText:receiveCaptionText,onState:renderCaptionState});
const analysisTrigger=new AnalysisTrigger({ready:()=>(state.running||questionOpen())&&!state.busy&&!state.autoBlocked&&!board.current&&!importingImages&&teachingText().trim().split(/\s+/).length>=12&&signature()!==state.lastSent,run:()=>analyze(false,true),delay:()=>Math.max(1500,20000-(Date.now()-state.lastCall))});
const board=new Board($('whiteboard'),()=>{
  $('boardEmpty').hidden=board.hasContent;
  $('boardState').textContent='Changes saved locally';
  state.changedAt=Date.now();scheduleAnalysis();
});
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function teachingText(){return [$('transcript').value.trim(),state.boardVisible?$('writing').value.trim():''].filter(Boolean).join('\n\n');}
function signature(){return `${teachingText()}|${state.boardVisible?board.revision:'hidden'}`;}
function scheduleAnalysis(){
  if((!state.running&&!questionOpen())||state.busy||state.autoBlocked||importingImages)return;
  const words=teachingText().split(/\s+/).filter(Boolean).length;
  if(words<12){classroomStatus(`Waiting for explanation · ${words}/12 words`);return;}
  if(signature()===state.lastSent)return;
  classroomStatus('New explanation queued');analysisTrigger.request();
}
function statusIndicator(){const error=Boolean(document.querySelector('.pipeline-health .pipeline-error'));$('statusDetails').classList.toggle('has-error',error);if(error)$('statusDetails').open=true;}
function classroomStatus(text,error=false){$('classroomHealth').textContent=text;$('classroomHealth').classList.toggle('pipeline-error',error);$('retryClassroom').hidden=!error;statusIndicator();}
function resizeTranscript(){const input=$('transcript');const follow=input.scrollHeight-input.scrollTop-input.clientHeight<40;input.style.height='auto';input.style.height=Math.min(260,Math.max(88,input.scrollHeight))+'px';if(follow&&document.activeElement!==input)input.scrollTop=input.scrollHeight;}
function receiveCaptionText({final,interim,provisional}){
  if(final){const input=$('transcript');input.value+=(input.value&&!/\s$/.test(input.value)?' ':'')+final;state.changedAt=Date.now();resizeTranscript();scheduleAnalysis();}
  $('liveCaption').hidden=!interim&&!provisional;
  $('liveCaption').textContent=interim?`Hearing: ${interim}`:provisional?'Last phrase preserved from a draft—check its wording.':'';
  const latest=interim||final||'';if(latest)$('recentSpeech').textContent=`Heard: ${latest.length>160?'…'+latest.slice(-160):latest}`;
}
function renderCaptionState(status,reason){
  const labels={muted:'Muted',starting:'Starting…',listening:'Listening',reconnecting:'Reconnecting…',error:`Stopped · ${reason||'unavailable'}`};
  if($('captionHealth').textContent!==(labels[status]||status))$('captionHealth').textContent=labels[status]||status;$('captionHealth').classList.toggle('pipeline-error',status==='error');$('retryCaptions').hidden=status!=='error';
  $('transcriptStatus').textContent=status==='listening'?'Capturing spoken explanation':status==='reconnecting'?'Speech service reconnecting · text preserved':status==='error'?'Captions stopped · retry at the top':'Mic muted · type or enable microphone';
  if(status==='error')notice('Speech-to-text stopped while the microphone meter may still be active. Retry captions at the top; your existing explanation is preserved.',true);
  statusIndicator();
}
function renderNotes(){
  const container=$('notes');
  const notebook=$('notebookContent'),scrollTop=notebook.scrollTop;
  const oldNotes=[...container.querySelectorAll('.note')];
  const previousOrder=new Map(oldNotes.map((node,i)=>[node.dataset.term,i]));
  const anchor=oldNotes.find(node=>node.getBoundingClientRect().bottom>notebook.getBoundingClientRect().top);
  const anchorTop=anchor?.getBoundingClientRect().top;
  const changed=new Set();
  for(const note of state.notes){const key=note.term.toLowerCase();if(noteSnapshots.get(key)!==note.definition){changed.add(key);noteSnapshots.set(key,note.definition);noteOrder.set(key,++noteTick);}}
  const notes=[...state.notes].sort((a,b)=>followLatestNotes?(noteOrder.get(b.term.toLowerCase())||0)-(noteOrder.get(a.term.toLowerCase())||0):(previousOrder.get(a.term.toLowerCase())??Infinity)-(previousOrder.get(b.term.toLowerCase())??Infinity));
  if(!state.notes.length){container.replaceChildren();const p=document.createElement('p');p.className='form-caption';p.textContent='Your ideas will land here. One explanation at a time.';container.append(p);}
  else{container.replaceChildren(...notes.map(n=>{const div=document.createElement('div');div.dataset.term=n.term.toLowerCase();div.className=changed.has(div.dataset.term)&&(noteOrder.get(div.dataset.term)||0)>noteTick-3?'note just-updated':'note';const title=document.createElement('h4');title.textContent=n.term;const p=document.createElement('p');p.textContent=n.definition;div.append(title,p);return div;}));}
  notebook.scrollTop=followLatestNotes?0:scrollTop;
  if(!followLatestNotes&&anchor){const replacement=[...container.querySelectorAll('.note')].find(node=>node.dataset.term===anchor.dataset.term);if(replacement)notebook.scrollTop+=replacement.getBoundingClientRect().top-anchorTop;}
  $('noteCount').textContent=`${state.notes.length} concept${state.notes.length===1?'':'s'}`;
}
function applyResult(result,sentTranscript){
  state.lastResult=result;state.analyses++;
  for(const note of result.notes){const existing=state.notes.find(n=>n.term.toLowerCase()===note.term.toLowerCase());if(existing)existing.definition=note.definition;else state.notes.push(note);}
  const previous=state.activeQuestion;
  state.activeQuestion=advanceQuestion(previous,result,sentTranscript,`question-${state.epoch}-${state.analyses}`);
  if(previous?.id===state.activeQuestion?.id&&previous.status!=='answered'&&state.activeQuestion.status==='answered'){
    state.answerHistory??=[];state.answerHistory.push({...state.activeQuestion});
    $('answerReceipt').hidden=true;
  }
  if(previous?.status==='answered'&&previous.id!==state.activeQuestion?.id){$('answerReceipt').hidden=false;$('answerReceipt').textContent=`✓ Previous question answered correctly · ${previous.feedback||'Answer accepted by the AI classroom.'}`;}
  renderQuestion(previous?.id!==state.activeQuestion?.id);
  state.factChecks??=[];
  for(const check of result.factChecks||[]){const index=state.factChecks.findIndex(c=>c.claim.toLowerCase()===check.claim.toLowerCase());if(index<0)state.factChecks.push(check);else state.factChecks[index]=check;}
  for(const check of result.factChecks||[]){if(check.verdict==='corrected'&&check.resolvedBy){for(const note of state.notes){if(normalizeEvidence(note.definition).replace(/[.!?]+$/,'')===normalizeEvidence(check.claim).replace(/[.!?]+$/,''))note.definition=check.resolvedBy;}}}
  renderNotes();
  renderFactChecks();
  if(result.hint)$('tip').textContent=result.hint;else $('tip').textContent=result.feedback;
  $('notesLabel').textContent=result.source==='demo'?'DEMO':'LIVE';
  notice(result.source==='demo'?'Demo classroom: questions follow a sample script; no AI evaluation or drawing interpretation occurred.':`Classroom updated. ${result.boardSeen?'Whiteboard included.':'Text-only analysis; drawings were not interpreted.'}`);
}
function renderQuestion(arrival=false){
  const q=state.activeQuestion;if(!q)return;
  const answered=q.status==='answered';
  const labels={waiting:'Awaiting your answer',answering:'Listening for your answer',partial:'Partly answered',incorrect:'Try again',answered:'✓ Answered correctly'};
  $('questionInitial').textContent=q.student[0];$('questionLabel').textContent=`${q.student.toUpperCase()}${answered?' · ANSWER ACCEPTED':' HAS A QUESTION'}${state.live?'':' · SCRIPTED DEMO'}`;
  $('questionText').textContent=q.question;
  $('answerStatus').hidden=false;$('answerStatus').textContent=labels[q.status];$('answerStatus').dataset.status=q.status;
  $('answerFeedback').hidden=!q.feedback;$('answerFeedback').textContent=q.feedback;
  $('answerEvidence').hidden=!q.evidence;$('answerEvidence').textContent=q.evidence?`You said: “${q.evidence}”`:'';
  document.body.classList.toggle('question-answered',answered);
  setQuestionPending(!answered,q.student,arrival);
  $('questionAlert').hidden=false;
  $('questionAlertText').textContent=answered?`${q.student} · Answered correctly`:`${q.student} · ${labels[q.status]}`;
  $('questionAlertIcon').textContent=answered?'✓':'!';
  $('acknowledgeQuestion').hidden=answered||q.status==='answering';
  $('checkAnswer').hidden=answered;
  document.querySelectorAll('.student-card').forEach(el=>el.classList.toggle('asking',!answered&&el.dataset.student===q.student));
}
function setQuestionPending(pending,student='',arrival=true){
  document.body.classList.toggle('question-pending',pending);
  $('questionAlert').hidden=!pending;
  $('questionAlertText').textContent=pending?`${student} has a question`:'';
  $('acknowledgeQuestion').hidden=!pending;
  $('boardCard').classList.remove('question-arrival');
  if(pending&&arrival){void $('boardCard').offsetWidth;$('boardCard').classList.add('question-arrival');}
}
$('questionAlert').onclick=()=>{
  const card=$('questionCard');
  if(window.matchMedia('(min-width: 701px)').matches){card.scrollTop=0;card.focus({preventScroll:true});return;}
  const dock=document.querySelector('.teaching-dock');
  const top=card.getBoundingClientRect().top+window.scrollY-dock.getBoundingClientRect().height-24;
  window.scrollTo({top:Math.max(0,top),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  card.focus({preventScroll:true});
};
$('acknowledgeQuestion').onclick=()=>{if(questionOpen()){state.activeQuestion.status='answering';renderQuestion();scheduleAnalysis();}};
$('checkAnswer').onclick=()=>analyze();
function orderedFactChecks(){const rank={contradicted:0,unverified:1,corrected:2,supported:3};return (state.factChecks||[]).slice(-8).reverse().sort((a,b)=>rank[a.verdict]-rank[b.verdict]);}
function renderFactChecks(){
  const container=$('factChecks');container.replaceChildren();
  const withheld=state.mode==='test'&&!state.hints&&!state.reviewing;
  const count=withheld?0:(state.factChecks||[]).filter(c=>c.verdict==='contradicted').length;$('checksCount').hidden=!count;$('checksCount').textContent=count;
  $('factCheckSummary').textContent=withheld?'Available after your test':!state.live?'Live source checks require an AI connection':!state.factChecks?.length?'No claims checked yet':'AI checks against your materials';
  if(withheld)return;
  for(const check of orderedFactChecks()){
    const card=document.createElement('article');card.className=`fact-check ${check.verdict}`;
    const label=document.createElement('strong');label.textContent=({contradicted:'↗ Conflicts with your material',corrected:'✓ Corrected in your explanation',supported:'✓ Supported by your material',unverified:'? Needs verification'})[check.verdict];
    const claim=document.createElement('p');claim.textContent=`“${check.claim}”`;
    const explanation=document.createElement('p');explanation.textContent=check.explanation;
    card.append(label,claim,explanation);
    if(check.resolvedBy){const correction=document.createElement('p');correction.textContent=`You corrected this: “${check.resolvedBy}”`;card.append(correction);}
    if(!check.citations.length){const topic=document.createElement('small');topic.textContent=`Review: ${check.reviewTopic}. Add a relevant source to check this claim.`;card.append(topic);}
    for(const citation of check.citations){const button=document.createElement('button');button.className='source-link';button.textContent=`${citation.sourceName} · lines ${citation.lineStart}–${citation.lineEnd} ↗`;button.onclick=()=>openSource(citation);card.append(button);}
    container.append(card);
  }
}
function openSource(citation){
  const doc=sourceDocuments(state.materials).find(d=>d.id===citation.sourceId);if(!doc)return;
  $('sourceTitle').textContent=doc.name;$('sourceLines').replaceChildren();
  doc.lines.forEach((text,i)=>{const line=document.createElement('div');line.className='source-line';line.dataset.line=i+1;line.classList.toggle('cited',i+1>=citation.lineStart&&i+1<=citation.lineEnd);const number=document.createElement('span');number.textContent=i+1;const content=document.createElement('span');content.textContent=text||' ';line.append(number,content);$('sourceLines').append(line);});
  $('sourceDialog').showModal();$('sourceLines').querySelector('.cited')?.scrollIntoView({block:'center'});
}
function demoResult(hint){
  const text=teachingText();
  const sample=state.topic.toLowerCase().includes('photosynthesis')&&/chlorophyll/i.test(text);
  const sentences=text.match(/[^.!?]+[.!?]?/g)||[text];
  let notes=sentences.slice(0,4).map((s,i)=>({term:`Idea ${i+1}`,definition:s.trim()}));
  let question=`Could you give us a concrete example of ${state.topic.toLowerCase()} and walk through why it works?`;
  if(sample){
    const candidates=[['Photosynthesis','Plants use sunlight to turn water and carbon dioxide into glucose.','glucose'],['Chlorophyll','Chlorophyll absorbs light energy in the chloroplasts.','chloroplast'],['Oxygen','Oxygen is released as a byproduct.','byproduct']];
    notes=candidates.filter(x=>text.toLowerCase().includes(x[2])).map(([term,definition])=>({term,definition}));
    question=['You said sunlight provides energy. How is that energy stored in the glucose?','How do the water and carbon dioxide actually reach the chloroplasts?','If a plant gets water and carbon dioxide but no light, what changes?'][state.analyses%3];
  }
  return {student:['Maya','Leo','Sam'][state.analyses%3],question,notes,score:null,feedback:'Try connecting each step with “because,” then explain it using an example.',hint:hint?'Start with the inputs, follow what changes, then describe the result.':null,source:'demo',boardSeen:false};
}
async function analyze(hint=false,automatic=false){
  if(state.busy)return;
  if(state.mode==='test'&&hint&&!state.hints)return;
  const transcript=$('transcript').value.trim(),writing=state.boardVisible?$('writing').value.trim():'';
  const explanation=teachingText();
  if(explanation.length<20){if(!automatic){classroomStatus('Add a few sentences first');notice('Add a few sentences first so your students have something to ask about.');}return;}
  if(state.live && Date.now()-state.lastCall<20000){if(!automatic)notice('Let’s give the next explanation a little room. Please wait 20 seconds between analyses.');scheduleAnalysis();return;}
  const epoch=state.epoch;state.autoBlocked=false;state.busy=true;state.lastCall=Date.now();analysisTrigger.cancel();classroomStatus('Reading your explanation…');
  const sentSignature=signature();const sentTranscript=explanation;const revision=board.revision;
  const includeBoard=state.vision&&state.boardVisible&&(board.hasContent||state.previousBoard);
  const image=includeBoard?board.snapshot():undefined;
  $('analyzeBtn').disabled=true;$('hintBtn').disabled=true;$('analyzeBtn').textContent='Thinking…';
  try{
    let result;
    if(state.live){
      const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(65000),body:JSON.stringify({topic:state.topic,materials:state.materials,transcript:transcript.slice(-20000),writing:writing.slice(-20000),mode:state.mode,hints:state.mode==='learn'||state.hints,requestHint:hint,notes:state.notes.slice(-20),question:state.activeQuestion?.question,claimsToRecheck:(state.factChecks||[]).filter(c=>c.verdict==='contradicted').slice(-3).map(c=>c.claim),questionContext:questionOpen()?{id:state.activeQuestion.id,question:state.activeQuestion.question,student:state.activeQuestion.student,answerSinceQuestion:answerSinceQuestion(state.activeQuestion,explanation)}:null,events:state.boardVisible?board.events.slice(-100):[],board:image,previousBoard:includeBoard&&revision!==state.boardRevision?state.previousBoard:undefined,recencyBoard:includeBoard&&$('recencyInput').checked?board.snapshot(true):undefined})});
      result=await response.json();if(!response.ok)throw Error(result.error||'Classroom analysis failed.');
    }else result=demoResult(hint);
    if(epoch!==state.epoch)return;
    if(state.mode==='test'&&!state.hints)result.hint=null;
    applyResult(result,sentTranscript);state.lastSent=sentSignature;state.boardRevision=revision;
    classroomStatus(`Updated · ${state.notes.length} concept${state.notes.length===1?'':'s'} · ${state.analyses} ${state.analyses===1?'analysis':'analyses'}`);if(state.live)$('connection').textContent='● AI connected';
    if(image)state.previousBoard=image;
    $('boardState').textContent=result.boardSeen?'Shared with the classroom':'Saved locally';
    $('captureStatus').textContent=state.live?`Analysis ${state.analyses} · ${result.boardSeen?'board + explanation':'explanation only'}`:`Demo analysis ${state.analyses} · no API charges`;
  }catch(error){if(epoch===state.epoch){state.autoBlocked=true;const message=error.name==='TimeoutError'?'The AI classroom timed out. Retry analysis.':error.message;classroomStatus(message,true);notice(message,true);}}
  finally{state.busy=false;$('analyzeBtn').disabled=false;$('analyzeBtn').textContent='Ask students';$('hintBtn').disabled=state.mode==='test'&&!state.hints;scheduleAnalysis();}
}
function elapsed(){return state.elapsed+(state.running?(Date.now()-state.startTime)/1000:0);}
function renderClock(){
  const seconds=Math.max(0,Math.floor(state.mode==='test'?state.duration-elapsed():elapsed()));
  $('clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  if(state.running&&state.mode==='test'&&seconds===0){finish();notice('Time is up. Your session is ready to review.');}
}
function updateRunning(){
  document.body.classList.toggle('running',state.running);
  $('startBtn').textContent=state.running?'Ⅱ Pause':state.elapsed>0?'▶ Resume':'▶ Start';
  $('startBtn').setAttribute('aria-pressed',String(state.running));
  $('audienceStatus').textContent=state.running?(microphone.status==='live'?'Listening':'Reading your explanation'):'Ready to listen';
  $('learnMode').disabled=state.running||state.elapsed>0;$('testMode').disabled=state.running||state.elapsed>0;
}
function pause(){if(state.running){state.elapsed=elapsed();state.running=false;}analysisTrigger.cancel();stopMic();updateRunning();renderClock();}
$('startBtn').onclick=async()=>{
  if(state.running){pause();return;}
  if(state.mode==='test'&&state.elapsed>=state.duration){notice('This timed session has ended. Start a new lesson to try again.');return;}
  state.reviewing=false;renderFactChecks();state.running=true;state.startTime=Date.now();updateRunning();scheduleAnalysis();
  notice(state.live?'Classroom started. Explain your topic, then pause to let your students respond.':'Demo classroom started. Try the sample explanation to see the intended flow.');
  if(microphone.status!=='live')await enableMic();
};
setInterval(renderClock,1000);
function setMode(mode){if(state.running||state.elapsed>0)return;state.mode=mode;$('learnMode').classList.toggle('active',mode==='learn');$('testMode').classList.toggle('active',mode==='test');$('learnMode').setAttribute('aria-pressed',mode==='learn');$('testMode').setAttribute('aria-pressed',mode==='test');$('clockLabel').textContent=mode==='learn'?'Self-paced':'Time remaining';$('hintBtn').disabled=mode==='test'&&!state.hints;renderClock();renderFactChecks();}
$('learnMode').onclick=()=>setMode('learn');$('testMode').onclick=()=>setMode('test');
function finish(){pause();stopCamera();state.reviewing=true;renderFactChecks();$('reviewFactChecks').replaceChildren(...Array.from($('factChecks').children,c=>c.cloneNode(true)));$('reviewFactChecks').querySelectorAll('.source-link').forEach((button,i)=>{const refs=orderedFactChecks().flatMap(c=>c.citations);button.onclick=()=>openSource(refs[i]);});$('reviewScore').textContent=state.lastResult?.score==null?'—':`${state.lastResult.score}/100`;$('reviewFeedback').textContent=state.lastResult?.feedback||'No classroom feedback yet. Explain a topic and ask your students a question.';$('reviewConcepts').textContent=state.notes.length;$('reviewRequests').textContent=state.analyses;$('reviewSource').textContent=state.live?'Provisional AI practice feedback, not a validated exam grade. Integrity detection is not implemented.':'Demo results. No real AI grading or drawing interpretation. Integrity detection is not implemented.';$('reviewDialog').showModal();}
$('endBtn').onclick=finish;$('reviewNav').onclick=finish;
$('analyzeBtn').onclick=()=>analyze();$('hintBtn').onclick=()=>analyze(true);
$('transcript').oninput=()=>{state.changedAt=Date.now();resizeTranscript();scheduleAnalysis();};
$('sampleBtn').onclick=()=>{
  if(state.topic!=='How photosynthesis works'){notice('Start a new lesson with the default photosynthesis topic to try the sample.');return;}
  $('transcript').value='Plants use sunlight to turn water and carbon dioxide into glucose. This process is called photosynthesis. Chlorophyll absorbs light energy in the chloroplasts. The glucose stores chemical energy that the plant can use to grow. Oxygen is released as a byproduct.';
  resizeTranscript();
  analyze();
};
function openSetup(){if(state.busy){notice('Wait for the classroom to finish thinking before changing your lesson.');return;}pause();$('topicInput').value=state.topic;$('materialsInput').value=state.materials;$('durationInput').value=state.duration/60;$('hintsInput').checked=state.hints;renderLessonImages();$('setupDialog').showModal();}
$('newLesson').onclick=openSetup;$('settingsBtn').onclick=openSetup;$('materialsNav').onclick=openSetup;
$('classroomNav').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
let pendingLessonImages=[];
$('setupForm').onsubmit=async e=>{
  e.preventDefault();if(importingImages)return;const topic=$('topicInput').value.trim();if(!topic)return;
  state.epoch++;state.elapsed=0;state.lastCall=0;state.lastSent='';state.previousBoard=null;state.boardRevision=-1;state.notes=[];state.analyses=0;state.lastResult=null;state.autoBlocked=false;classroomStatus('Waiting for your explanation');$('recentSpeech').textContent='Your spoken words will appear here.';
  state.topic=topic;state.materials=$('materialsInput').value.slice(0,18000);state.duration=Number($('durationInput').value)*60;state.hints=$('hintsInput').checked;
  noteSnapshots.clear();noteOrder.clear();followNotes(true);referenceTab('notes');
  state.activeQuestion=null;state.factChecks=[];state.answerHistory=[];state.reviewing=false;document.body.classList.remove('question-answered');$('answerReceipt').hidden=true;$('answerStatus').hidden=true;$('answerFeedback').hidden=true;$('answerEvidence').hidden=true;$('checkAnswer').hidden=true;renderFactChecks();
  setQuestionPending(false);
  board.reset();$('writing').value='';$('writingCount').textContent='0 words';teachingSurface('drawing');$('transcript').value='';$('lessonTitle').textContent=topic;$('transcript').placeholder=`How would you explain ${topic.toLowerCase()}?`;
  $('questionText').textContent='Start explaining, and your students will help you find the gaps.';$('questionLabel').textContent='A QUESTION IS A NEW CONNECTION';$('questionInitial').textContent='?';
  document.querySelectorAll('.student-card').forEach(el=>el.classList.remove('asking'));
  $('tip').textContent='Try explaining it like your students are hearing it for the first time.';
  renderNotes();setMode(state.mode);updateRunning();
  if(pendingLessonImages.length){$('setLesson').disabled=true;$('setLesson').textContent='Loading images…';try{imageLibrary.length=0;renderImageLibrary();await importImages(pendingLessonImages);pendingLessonImages=[];$('lessonImageUpload').value='';renderLessonImages();}finally{$('setLesson').disabled=false;$('setLesson').textContent='Set lesson →';}}
  $('setupDialog').close();notice('Lesson ready. Your classroom is yours.');
};
let assignmentKind='people';
const assignmentChoices={people:[['self','Saurav Kandel (myself)'],['jordan','Jordan Lee'],['avery','Avery Patel']],groups:[['study','Study group A'],['intro','Introduction to computing'],['ethics','Ethics seminar']]};
const assignmentSelections={people:'self',groups:'study'};
function assignmentTab(kind,focus=false){
  assignmentSelections[assignmentKind]=$('assignmentSelect').value;assignmentKind=kind;
  for(const name of ['people','groups']){const button=$(name==='people'?'assignPeople':'assignGroups');button.setAttribute('aria-selected',String(name===kind));button.tabIndex=name===kind?0:-1;}
  $('assignmentSelect').replaceChildren(...assignmentChoices[kind].map(([value,label])=>new Option(label,value)));$('assignmentSelect').value=assignmentSelections[kind];
  if(focus)$(kind==='people'?'assignPeople':'assignGroups').focus();
}
for(const kind of ['people','groups']){const button=$(kind==='people'?'assignPeople':'assignGroups');button.onclick=()=>assignmentTab(kind);button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();assignmentTab(e.key==='Home'?'people':e.key==='End'?'groups':kind==='people'?'groups':'people',true);}};}
function renderLessonImages(){
  const names=pendingLessonImages.length?pendingLessonImages.map(file=>file.name):imageLibrary.map(item=>item.name);
  $('lessonImageStatus').textContent=names.length?`${names.length} image${names.length===1?'':'s'} ready for the lesson library.`:'Available in the image library when the lesson opens.';
  $('lessonImageList').replaceChildren(...names.map(name=>{const li=document.createElement('li');li.textContent=name;return li;}));
}
$('lessonImageUpload').onchange=e=>{pendingLessonImages=Array.from(e.target.files);renderLessonImages();};
$('upload').onchange=async e=>{
  const files=Array.from(e.target.files);let text=$('materialsInput').value;
  for(const file of files){if(file.size>100000 || !/\.(txt|md)$/i.test(file.name)){notice('Please choose .txt or .md files smaller than 100 KB.',true);continue;}text+=`\n\n[Source: ${file.name.replace(/[\r\n\[\]]/g,'')}]\n${await file.text()}`;}
  $('materialsInput').value=text.slice(0,18000);$('uploadStatus').textContent=`${files.length} file(s) selected. Source notes limited to 18,000 characters.`;e.target.value='';
};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('toggleBoard').onclick=()=>{state.boardVisible=!state.boardVisible;$('boardCard').classList.toggle('board-hidden',!state.boardVisible);$('toggleBoard').textContent=state.boardVisible?'Hide board ↗':'Show board ↗';$('toggleBoard').setAttribute('aria-expanded',String(state.boardVisible));$('boardOff').hidden=state.boardVisible;if(state.boardVisible)board.render();};
$('toggleNotes').onclick=()=>{const content=$('notebookContent');content.hidden=!content.hidden;const button=$('toggleNotes');button.setAttribute('aria-expanded',String(!content.hidden));button.setAttribute('aria-label',content.hidden?'Expand student notes':'Collapse student notes');button.textContent=content.hidden?'+':'−';button.closest('.notes-card').classList.toggle('notes-collapsed',content.hidden);};
$('pen').onclick=()=>{board.setTool('pen');$('selectImage').classList.remove('active');$('selectImage').setAttribute('aria-pressed','false');$('pen').classList.add('active');$('eraser').classList.remove('active');$('pen').setAttribute('aria-pressed','true');$('eraser').setAttribute('aria-pressed','false');};
$('eraser').onclick=()=>{board.setTool('eraser');$('selectImage').classList.remove('active');$('selectImage').setAttribute('aria-pressed','false');$('eraser').classList.add('active');$('pen').classList.remove('active');$('eraser').setAttribute('aria-pressed','true');$('pen').setAttribute('aria-pressed','false');};
document.querySelectorAll('[data-color]').forEach(button=>{button.setAttribute('aria-pressed',String(button.classList.contains('active')));button.onclick=()=>{board.color=button.dataset.color;$('pen').click();document.querySelectorAll('[data-color]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});};});
$('undo').onclick=()=>board.undo();$('clear').onclick=()=>board.clear();
$('recencyBtn').onclick=()=>{$('aiPreview').src=board.snapshot(true);$('aiDialog').showModal();};
function teachingSurface(name,focus=false){
  for(const key of ['drawing','writing']){const selected=key===name;$(`${key}Tab`).setAttribute('aria-selected',String(selected));$(`${key}Tab`).tabIndex=selected?0:-1;$(`${key}Pane`).hidden=!selected;}
  if(focus)$(`${name}Tab`).focus();if(name==='drawing')board.render();
}
for(const key of ['drawing','writing']){
  $(`${key}Tab`).onclick=()=>teachingSurface(key);
  $(`${key}Tab`).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();teachingSurface(e.key==='Home'?'drawing':e.key==='End'?'writing':key==='drawing'?'writing':'drawing',true);}};
}
$('writing').oninput=()=>{const words=$('writing').value.trim().split(/\s+/).filter(Boolean).length;$('writingCount').textContent=`${words} word${words===1?'':'s'}`;state.changedAt=Date.now();scheduleAnalysis();};
function selectImages(){board.setTool('select');for(const id of ['pen','eraser','selectImage']){$(id).classList.toggle('active',id==='selectImage');$(id).setAttribute('aria-pressed',String(id==='selectImage'));}board.canvas.focus({preventScroll:true});}
$('selectImage').onclick=selectImages;
function imageControls(){
  const image=board.selected,list=$('imageLayerList');$('imageControls').hidden=!board.images.length;list.replaceChildren();
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select an image';list.append(placeholder);
  for(const item of [...board.images].reverse()){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;list.append(option);}
  list.value=image?.id||'';
  for(const id of ['imageBackward','imageForward','imageBack','imageFront','deleteImage'])$(id).disabled=!image;
  if(image){$('imageBackward').disabled=$('imageBack').disabled=board.elements.indexOf(image)===0;$('imageForward').disabled=$('imageFront').disabled=board.elements.indexOf(image)===board.elements.length-1;}
}
board.onSelection=imageControls;
$('imageLayerList').onchange=()=>{selectImages();board.select($('imageLayerList').value||null);};
for(const [id,direction] of [['imageBackward','backward'],['imageForward','forward'],['imageBack','back'],['imageFront','front']])$(id).onclick=()=>board.layer(direction);
$('deleteImage').onclick=()=>board.deleteSelected();
let importingImages=false;
const imageLibrary=[];
function placeLibraryImage(id,position){
  const item=imageLibrary.find(item=>item.id===id);if(!item)return;
  if(board.images.length>=12){notice('The board can hold 12 images. Delete one to add another.',true);return;}
  teachingSurface('drawing');board.addImage(item.image,item.name,item.mask,position);selectImages();
}
function renderImageLibrary(){
  $('imageLibraryItems').replaceChildren();$('imageLibraryEmpty').hidden=!!imageLibrary.length;
  for(const item of imageLibrary){
    const button=document.createElement('button');button.className='library-image';button.draggable=true;button.title=`Add ${item.name}`;button.setAttribute('aria-label',`Add ${item.name} to board`);
    const thumbnail=document.createElement('img');thumbnail.src=item.image.src;thumbnail.alt='';thumbnail.draggable=false;
    const label=document.createElement('span');label.textContent=item.name.replace(/\.[^.]+$/,'');button.append(thumbnail,label);
    button.onclick=()=>placeLibraryImage(item.id);
    button.ondragstart=e=>{e.dataTransfer.setData('application/x-teachit-image',item.id);e.dataTransfer.effectAllowed='copy';};
    $('imageLibraryItems').append(button);
  }
}
async function importImages(files,position){
  if(importingImages)return;const epoch=state.epoch;importingImages=true;$('addImage').disabled=true;$('addImage').textContent='Loading…';
  try{
    for(const file of Array.from(files)){
      if(epoch!==state.epoch)break;
      if(imageLibrary.length>=24){notice('The image library can hold 24 images.',true);break;}
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){notice('Choose PNG, JPG or WebP images up to 10 MB each.',true);continue;}
      const url=URL.createObjectURL(file);
      try{
        const source=new Image();source.src=url;await source.decode();
        if(source.width*source.height>36000000)throw Error('This image is too large. Use an image smaller than 36 megapixels.');
        const scale=Math.min(1,1600/Math.max(source.width,source.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
        const image=new Image();image.src=canvas.toDataURL('image/png');await image.decode();
        const maskCanvas=document.createElement('canvas'),ratio=Math.min(1,384/Math.max(image.width,image.height));maskCanvas.width=Math.max(1,Math.round(image.width*ratio));maskCanvas.height=Math.max(1,Math.round(image.height*ratio));const ctx=maskCanvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,maskCanvas.width,maskCanvas.height);const mask=ctx.getImageData(0,0,maskCanvas.width,maskCanvas.height);
        if(epoch!==state.epoch)break;const item={id:crypto.randomUUID(),image,name:file.name,mask};imageLibrary.push(item);renderImageLibrary();if(position)placeLibraryImage(item.id,position);
      }catch(error){notice(error.message||'This image could not be opened. Try another PNG or JPG.',true);}
      finally{URL.revokeObjectURL(url);}
    }
  }finally{importingImages=false;$('addImage').disabled=false;$('addImage').textContent='＋ Image';$('imageUpload').value='';scheduleAnalysis();}
}
$('addImage').onclick=()=>$('imageUpload').click();
$('imageUpload').onchange=e=>importImages(e.target.files);
for(const event of ['dragenter','dragover'])$('boardWrap').addEventListener(event,e=>{if(e.dataTransfer.types.includes('Files')||e.dataTransfer.types.includes('application/x-teachit-image')){e.preventDefault();e.dataTransfer.dropEffect='copy';$('boardWrap').classList.add('drop-ready');}});
$('boardWrap').addEventListener('dragleave',e=>{if(!$('boardWrap').contains(e.relatedTarget))$('boardWrap').classList.remove('drop-ready');});
$('boardWrap').addEventListener('drop',e=>{e.preventDefault();$('boardWrap').classList.remove('drop-ready');const rect=$('whiteboard').getBoundingClientRect(),position=[(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height],id=e.dataTransfer.getData('application/x-teachit-image');if(id)placeLibraryImage(id,position);else importImages(e.dataTransfer.files,position);});
function download(){
  const exportChecks=state.mode==='test'&&!state.hints&&!state.reviewing?[]:(state.factChecks||[]);
  const content=`# ${state.topic}\n\nMode: ${state.mode==='learn'?'Learn IT':'Test IT'}\nSource: ${state.live?'AI classroom':'Scripted demo'}\n\n## Student notes\n\n${state.notes.map(n=>`### ${n.term}\n${n.definition}`).join('\n\n')}\n\n## Latest question\n${state.activeQuestion?.question||'No question yet.'}\n\n## Feedback\n${state.lastResult?.feedback||'No feedback yet.'}\n\n## Answer status\n${state.activeQuestion?.status||'No question yet'}\n${state.activeQuestion?.feedback||''}\n\n## Answered questions\n${(state.answerHistory||[]).map(q=>q.question+' — '+q.feedback).join('\n')}\n\n## Fact checks (AI assessment against lesson materials)\n${exportChecks.map(c=>c.verdict+': '+c.claim+'\n'+c.explanation+'\n'+c.citations.map(r=>r.sourceName+' lines '+r.lineStart+'–'+r.lineEnd+': '+r.quote).join('\n')).join('\n\n')}\n\n## Written explanation\n${$('writing').value}\n\n## Spoken explanation\n${$('transcript').value}\n`;
  const url=URL.createObjectURL(new Blob([content],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download='TeachIT-session.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('download').onclick=download;$('reviewDownload').onclick=download;
function stopCamera(){state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;$('camera').srcObject=null;$('camera').hidden=true;$('cameraPlaceholder').hidden=false;$('cameraStop').hidden=true;$('cameraStart').textContent='▣ Camera';$('cameraStart').setAttribute('aria-label','Enable camera');$('cameraStart').setAttribute('aria-pressed','false');}
$('cameraStart').onclick=async()=>{
  if(state.stream){stopCamera();return;}
  if(!navigator.mediaDevices?.getUserMedia){notice('Camera access is unavailable here. Try opening the classroom in Edge or Chrome.',true);return;}
  try{state.stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});$('camera').srcObject=state.stream;$('camera').hidden=false;$('cameraPlaceholder').hidden=true;$('cameraStop').hidden=false;$('cameraStart').textContent='▣ Camera on';$('cameraStart').setAttribute('aria-label','Turn camera off');$('cameraStart').setAttribute('aria-pressed','true');notice('Camera preview is local. Video is not recorded or sent to the model.');}catch{notice('Camera access was not granted. You can keep teaching without it.',true);}
};
$('cameraStop').onclick=stopCamera;
function stopCaptions(){captions.stop();}
function renderMicrophoneState(status,error){
  const live=status==='live',pending=status==='requesting',interrupted=status==='interrupted';
  const button=$('micBtn');
  button.classList.toggle('is-live',live);button.classList.toggle('is-muted',!live);
  button.classList.toggle('is-pending',pending);button.classList.toggle('is-error',status==='error');
  button.dataset.state=status;button.setAttribute('aria-pressed',String(live));
  button.setAttribute('aria-busy',String(pending));
  button.setAttribute('aria-label',pending?'Cancel microphone request':live||interrupted?'Mute microphone':'Enable microphone');
  $('micStatus').textContent=live?'Mic on':pending?'Allow mic':interrupted?'Interrupted':status==='error'?'Unavailable':'Muted';
  $('micLevelText').textContent=live?'Speak to check your level':pending?'Use your browser’s permission prompt':interrupted?'Audio input is temporarily suspended':status==='error'?'Click the mic to try again':'Click the mic or start teaching';
  if(status==='muted'||status==='error'){state.micWanted=false;stopCaptions();$('transcriptStatus').textContent='Mic muted · type or enable microphone';}
  if(interrupted){stopCaptions();$('transcriptStatus').textContent='Audio interrupted · captions paused';}
  if(live&&state.micWanted)startCaptions();
  if(error){
    const denied=['NotAllowedError','PermissionDeniedError'].includes(error.name);
    notice(denied?'Microphone access was not granted. Allow it in your browser, or keep teaching by typing.':error.message||'Could not open the microphone. Check your input device and try again.',true);
  }
  if(state.running)$('audienceStatus').textContent=live?'Listening':'Reading your explanation';
}
function renderMicrophoneLevel(level){
  const live=microphone.status==='live';
  for(const led of $('micBtn').querySelectorAll('.mic-led'))led.classList.toggle('lit',live&&Number(led.dataset.step)<=level.bars);
  $('micBtn').dataset.quality=live?level.quality:'quiet';
  if(live){
    if(level.quality!=='quiet')captions.voice();
    $('micLevelText').textContent=({quiet:'Listening · waiting for your voice',good:'Good input level',high:'High input · move back a little',clipping:'Too loud · lower gain or move back'})[level.quality];
  }
}
function stopMic(){state.micWanted=false;stopCaptions();microphone.stop();}
async function enableMic(){
  if(microphone.status==='requesting'&&state.micStartPromise)return state.micStartPromise;
  if(!navigator.mediaDevices?.getUserMedia||!(window.AudioContext||window.webkitAudioContext)){
    renderMicrophoneState('error',new Error('Live microphone input is unavailable here. Open TeachIT in Chrome or Edge, or type your explanation.'));return false;
  }
  state.micWanted=true;const pending=microphone.start();state.micStartPromise=pending;
  try{return await pending;}finally{if(state.micStartPromise===pending)state.micStartPromise=null;}
}
function startCaptions(){
  if(state.micWanted&&microphone.status==='live')captions.start();
}
$('micBtn').onclick=()=>{if(state.micWanted||microphone.status==='requesting'){stopMic();return;}enableMic();};
$('retryCaptions').onclick=async()=>{captions.stop();if(microphone.status==='live')startCaptions();else await enableMic();};
$('retryClassroom').onclick=()=>analyze();
$('speakQuestion').onclick=()=>{if(!('speechSynthesis'in window)){notice('Speech playback is unavailable in this browser.');return;}speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance($('questionText').textContent));};
window.addEventListener('pagehide',()=>{stopCamera();stopMic();});
try{const response=await fetch('/api/config');if(!response.ok)throw Error();const config=await response.json();state.live=config.live;state.vision=config.vision;$('connection').textContent=config.live?'● AI configured':'● Demo mode';$('notesLabel').textContent=config.live?'LIVE':'DEMO';$('connection').title=config.live?config.model:'No API key configured';if(config.live)$('captureStatus').textContent=config.vision?'Selected board snapshots + explanation on analysis.':'Text-only mode · enable vision after verifying model support.';}catch{notice('Could not connect to the local server. Restart with npm start.',true);}

renderFactChecks();
