import { Board } from './board.js';
import { Microphone } from './microphone.js';
import { Captions } from './captions.js';
import { AnalysisTrigger } from './analysis-trigger.js';
import { sourceDocuments } from './evidence.js';
import { advanceQuestion, answerSinceQuestion } from './questions.js';

const $=id=>document.getElementById(id);
const questionOpen=()=>state.activeQuestion&&state.activeQuestion.status!=='answered';
const state={mode:'learn',running:false,elapsed:0,startTime:0,duration:600,hints:false,topic:'How photosynthesis works',materials:'',notes:[],analyses:0,lastResult:null,live:false,vision:false,busy:false,epoch:0,lastCall:0,lastSent:'',previousBoard:null,boardRevision:-1,changedAt:0,autoTimer:null,stream:null,recognition:null,micWanted:false,boardVisible:true};
const microphone=new Microphone({onState:renderMicrophoneState,onLevel:renderMicrophoneLevel});
const captions=new Captions({createRecognition:()=>{const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition)throw Error('Unavailable');return new Recognition();},onText:receiveCaptionText,onState:renderCaptionState});
const analysisTrigger=new AnalysisTrigger({ready:()=>(state.running||questionOpen())&&!state.busy&&!state.autoBlocked&&!board.current&&$('transcript').value.trim().split(/\s+/).length>=12&&signature()!==state.lastSent,run:()=>analyze(false,true),delay:()=>Math.max(1500,20000-(Date.now()-state.lastCall))});
const board=new Board($('whiteboard'),()=>{
  $('boardEmpty').hidden=board.strokes.length>0;
  $('boardState').textContent='Changes saved locally';
  state.changedAt=Date.now();scheduleAnalysis();
});
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function signature(){return `${$('transcript').value.trim()}|${state.boardVisible?board.revision:'hidden'}`;}
function scheduleAnalysis(){
  if((!state.running&&!questionOpen())||state.busy||state.autoBlocked)return;
  const words=$('transcript').value.trim().split(/\s+/).filter(Boolean).length;
  if(words<12){classroomStatus(`Waiting for explanation · ${words}/12 words`);return;}
  if(signature()===state.lastSent)return;
  classroomStatus('New explanation queued');analysisTrigger.request();
}
function classroomStatus(text,error=false){$('classroomHealth').textContent=text;$('classroomHealth').classList.toggle('pipeline-error',error);$('retryClassroom').hidden=!error;}
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
}
function renderNotes(){
  const container=$('notes');
  if(!state.notes.length){container.replaceChildren();const p=document.createElement('p');p.className='form-caption';p.textContent='Your ideas will land here. One explanation at a time.';container.append(p);}
  else{container.replaceChildren(...state.notes.map(n=>{const div=document.createElement('div');div.className='note';const title=document.createElement('h4');title.textContent=n.term;const p=document.createElement('p');p.textContent=n.definition;div.append(title,p);return div;}));}
  $('noteCount').textContent=`${state.notes.length} concept${state.notes.length===1?'':'s'} captured`;
}
function applyResult(result,sentTranscript){
  state.lastResult=result;state.analyses++;
  for(const note of result.notes){const existing=state.notes.find(n=>n.term.toLowerCase()===note.term.toLowerCase());if(existing)existing.definition=note.definition;else state.notes.push(note);}
  renderNotes();
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
  const dock=document.querySelector('.teaching-dock');
  const top=card.getBoundingClientRect().top+window.scrollY-dock.getBoundingClientRect().height-24;
  window.scrollTo({top:Math.max(0,top),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  card.focus({preventScroll:true});
};
$('acknowledgeQuestion').onclick=()=>{if(questionOpen()){state.activeQuestion.status='answering';renderQuestion();scheduleAnalysis();}};
$('checkAnswer').onclick=()=>analyze();
function renderFactChecks(){
  const container=$('factChecks');container.replaceChildren();
  const withheld=state.mode==='test'&&!state.hints&&!state.reviewing;
  $('factCheckSummary').textContent=withheld?'Available after your test':!state.live?'Live source checks require an AI connection':!state.factChecks?.length?'No claims checked yet':'AI checks against your materials';
  if(withheld)return;
  for(const check of (state.factChecks||[]).slice(-8).reverse()){
    const card=document.createElement('article');card.className=`fact-check ${check.verdict}`;
    const label=document.createElement('strong');label.textContent=({contradicted:'↗ Conflicts with your material',supported:'✓ Supported by your material',unverified:'? Needs verification'})[check.verdict];
    const claim=document.createElement('p');claim.textContent=`“${check.claim}”`;
    const explanation=document.createElement('p');explanation.textContent=check.explanation;
    card.append(label,claim,explanation);
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
  const text=$('transcript').value.trim();
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
  const transcript=$('transcript').value.trim();
  if(transcript.length<20){if(!automatic){classroomStatus('Add a few sentences first');notice('Add a few sentences first so your students have something to ask about.');}return;}
  if(state.live && Date.now()-state.lastCall<20000){if(!automatic)notice('Let’s give the next explanation a little room. Please wait 20 seconds between analyses.');scheduleAnalysis();return;}
  const epoch=state.epoch;state.autoBlocked=false;state.busy=true;state.lastCall=Date.now();analysisTrigger.cancel();classroomStatus('Reading your explanation…');
  const sentSignature=signature();const sentTranscript=transcript;const revision=board.revision;
  const includeBoard=state.vision&&state.boardVisible&&(board.strokes.length>0||state.previousBoard);
  const image=includeBoard?board.snapshot():undefined;
  $('analyzeBtn').disabled=true;$('hintBtn').disabled=true;$('analyzeBtn').textContent='Students are thinking…';
  try{
    let result;
    if(state.live){
      const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(65000),body:JSON.stringify({topic:state.topic,materials:state.materials,transcript:transcript.slice(-20000),mode:state.mode,hints:state.mode==='learn'||state.hints,requestHint:hint,notes:state.notes.slice(-20),question:state.activeQuestion?.question,questionContext:questionOpen()?{id:state.activeQuestion.id,question:state.activeQuestion.question,student:state.activeQuestion.student,answerSinceQuestion:answerSinceQuestion(state.activeQuestion,transcript)}:null,events:state.boardVisible?board.events.slice(-100):[],board:image,previousBoard:includeBoard&&revision!==state.boardRevision?state.previousBoard:undefined,recencyBoard:includeBoard&&$('recencyInput').checked?board.snapshot(true):undefined})});
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
  finally{state.busy=false;$('analyzeBtn').disabled=false;$('analyzeBtn').textContent='Ask the classroom ↗';$('hintBtn').disabled=state.mode==='test'&&!state.hints;scheduleAnalysis();}
}
function elapsed(){return state.elapsed+(state.running?(Date.now()-state.startTime)/1000:0);}
function renderClock(){
  const seconds=Math.max(0,Math.floor(state.mode==='test'?state.duration-elapsed():elapsed()));
  $('clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  if(state.running&&state.mode==='test'&&seconds===0){finish();notice('Time is up. Your session is ready to review.');}
}
function updateRunning(){
  document.body.classList.toggle('running',state.running);
  $('startBtn').textContent=state.running?'Ⅱ Pause teaching':state.elapsed>0?'▶ Resume teaching':'▶ Start teaching';
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
function finish(){pause();stopCamera();state.reviewing=true;renderFactChecks();$('reviewFactChecks').replaceChildren(...Array.from($('factChecks').children,c=>c.cloneNode(true)));$('reviewFactChecks').querySelectorAll('.source-link').forEach((button,i)=>{const refs=(state.factChecks||[]).slice(-8).reverse().flatMap(c=>c.citations);button.onclick=()=>openSource(refs[i]);});$('reviewScore').textContent=state.lastResult?.score==null?'—':`${state.lastResult.score}/100`;$('reviewFeedback').textContent=state.lastResult?.feedback||'No classroom feedback yet. Explain a topic and ask your students a question.';$('reviewConcepts').textContent=state.notes.length;$('reviewRequests').textContent=state.analyses;$('reviewSource').textContent=state.live?'Provisional AI practice feedback, not a validated exam grade. Integrity detection is not implemented.':'Demo results. No real AI grading or drawing interpretation. Integrity detection is not implemented.';$('reviewDialog').showModal();}
$('endBtn').onclick=finish;$('reviewNav').onclick=finish;
$('analyzeBtn').onclick=()=>analyze();$('hintBtn').onclick=()=>analyze(true);
$('transcript').oninput=()=>{state.changedAt=Date.now();resizeTranscript();scheduleAnalysis();};
$('sampleBtn').onclick=()=>{
  if(state.topic!=='How photosynthesis works'){notice('Start a new lesson with the default photosynthesis topic to try the sample.');return;}
  $('transcript').value='Plants use sunlight to turn water and carbon dioxide into glucose. This process is called photosynthesis. Chlorophyll absorbs light energy in the chloroplasts. The glucose stores chemical energy that the plant can use to grow. Oxygen is released as a byproduct.';
  resizeTranscript();
  analyze();
};
function openSetup(){if(state.busy){notice('Wait for the classroom to finish thinking before changing your lesson.');return;}pause();$('topicInput').value=state.topic;$('materialsInput').value=state.materials;$('durationInput').value=state.duration/60;$('hintsInput').checked=state.hints;$('setupDialog').showModal();}
$('newLesson').onclick=openSetup;$('settingsBtn').onclick=openSetup;$('materialsNav').onclick=openSetup;
$('classroomNav').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
$('setupForm').onsubmit=e=>{
  e.preventDefault();const topic=$('topicInput').value.trim();if(!topic)return;
  state.epoch++;state.elapsed=0;state.lastCall=0;state.lastSent='';state.previousBoard=null;state.boardRevision=-1;state.notes=[];state.analyses=0;state.lastResult=null;state.autoBlocked=false;classroomStatus('Waiting for your explanation');$('recentSpeech').textContent='Your spoken words will appear here.';
  state.topic=topic;state.materials=$('materialsInput').value.slice(0,18000);state.duration=Number($('durationInput').value)*60;state.hints=$('hintsInput').checked;
  state.activeQuestion=null;state.factChecks=[];state.answerHistory=[];state.reviewing=false;document.body.classList.remove('question-answered');$('answerReceipt').hidden=true;$('answerStatus').hidden=true;$('answerFeedback').hidden=true;$('answerEvidence').hidden=true;$('checkAnswer').hidden=true;renderFactChecks();
  setQuestionPending(false);
  board.clear();$('transcript').value='';$('lessonTitle').textContent=topic;$('transcript').placeholder=`How would you explain ${topic.toLowerCase()}?`;
  $('questionText').textContent='Start explaining, and your students will help you find the gaps.';$('questionLabel').textContent='A QUESTION IS A NEW CONNECTION';$('questionInitial').textContent='?';
  document.querySelectorAll('.student-card').forEach(el=>el.classList.remove('asking'));
  $('tip').textContent='Try explaining it like your students are hearing it for the first time.';
  renderNotes();setMode(state.mode);updateRunning();$('setupDialog').close();notice('Lesson ready. Your classroom is yours.');
};
$('upload').onchange=async e=>{
  const files=Array.from(e.target.files);let text=$('materialsInput').value;
  for(const file of files){if(file.size>100000 || !/\.(txt|md)$/i.test(file.name)){notice('Please choose .txt or .md files smaller than 100 KB.',true);continue;}text+=`\n\n[Source: ${file.name.replace(/[\r\n\[\]]/g,'')}]\n${await file.text()}`;}
  $('materialsInput').value=text.slice(0,18000);$('uploadStatus').textContent=`${files.length} file(s) selected. Source notes limited to 18,000 characters.`;e.target.value='';
};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('toggleBoard').onclick=()=>{state.boardVisible=!state.boardVisible;$('boardCard').classList.toggle('board-hidden',!state.boardVisible);$('toggleBoard').textContent=state.boardVisible?'Hide board ↗':'Show board ↗';$('toggleBoard').setAttribute('aria-expanded',String(state.boardVisible));$('boardOff').hidden=state.boardVisible;if(state.boardVisible)board.render();};
$('toggleNotes').onclick=()=>{const content=$('notebookContent');content.hidden=!content.hidden;const button=$('toggleNotes');button.setAttribute('aria-expanded',String(!content.hidden));button.setAttribute('aria-label',content.hidden?'Expand student notes':'Collapse student notes');button.textContent=content.hidden?'+':'−';button.closest('.notes-card').classList.toggle('notes-collapsed',content.hidden);};
$('pen').onclick=()=>{board.tool='pen';$('pen').classList.add('active');$('eraser').classList.remove('active');$('pen').setAttribute('aria-pressed','true');$('eraser').setAttribute('aria-pressed','false');};
$('eraser').onclick=()=>{board.tool='eraser';$('eraser').classList.add('active');$('pen').classList.remove('active');$('eraser').setAttribute('aria-pressed','true');$('pen').setAttribute('aria-pressed','false');};
document.querySelectorAll('[data-color]').forEach(button=>{button.setAttribute('aria-pressed',String(button.classList.contains('active')));button.onclick=()=>{board.color=button.dataset.color;$('pen').click();document.querySelectorAll('[data-color]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});};});
$('undo').onclick=()=>board.undo();$('clear').onclick=()=>board.clear();
$('recencyBtn').onclick=()=>{$('aiPreview').src=board.snapshot(true);$('aiDialog').showModal();};
function download(){
  const exportChecks=state.mode==='test'&&!state.hints&&!state.reviewing?[]:(state.factChecks||[]);
  const content=`# ${state.topic}\n\nMode: ${state.mode==='learn'?'Learn IT':'Test IT'}\nSource: ${state.live?'AI classroom':'Scripted demo'}\n\n## Student notes\n\n${state.notes.map(n=>`### ${n.term}\n${n.definition}`).join('\n\n')}\n\n## Latest question\n${state.activeQuestion?.question||'No question yet.'}\n\n## Feedback\n${state.lastResult?.feedback||'No feedback yet.'}\n\n## Answer status\n${state.activeQuestion?.status||'No question yet'}\n${state.activeQuestion?.feedback||''}\n\n## Answered questions\n${(state.answerHistory||[]).map(q=>q.question+' — '+q.feedback).join('\n')}\n\n## Fact checks (AI assessment against lesson materials)\n${exportChecks.map(c=>c.verdict+': '+c.claim+'\n'+c.explanation+'\n'+c.citations.map(r=>r.sourceName+' lines '+r.lineStart+'–'+r.lineEnd+': '+r.quote).join('\n')).join('\n\n')}\n\n## Explanation\n${$('transcript').value}\n`;
  const url=URL.createObjectURL(new Blob([content],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download='TeachIT-session.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('download').onclick=download;$('reviewDownload').onclick=download;
function stopCamera(){state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;$('camera').srcObject=null;$('camera').hidden=true;$('cameraPlaceholder').hidden=false;$('cameraStop').hidden=true;}
$('cameraStart').onclick=async()=>{
  if(!navigator.mediaDevices?.getUserMedia){notice('Camera access is unavailable here. Try opening the classroom in Edge or Chrome.',true);return;}
  try{state.stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});$('camera').srcObject=state.stream;$('camera').hidden=false;$('cameraPlaceholder').hidden=true;$('cameraStop').hidden=false;notice('Camera preview is local. Video is not recorded or sent to the model.');}catch{notice('Camera access was not granted. You can keep teaching without it.',true);}
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
  $('micStatus').textContent=live?'Microphone active':pending?'Allow microphone access':interrupted?'Microphone interrupted':status==='error'?'Microphone unavailable':'Microphone muted';
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
