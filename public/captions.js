// Speech recognition is independent from device-level audio capture.
export class Captions {
  constructor({createRecognition,onText=()=>{},onState=()=>{},now=Date.now,setTimer=(fn,delay)=>globalThis.setTimeout(fn,delay),clearTimer=id=>globalThis.clearTimeout(id),setIntervalFn=(fn,delay)=>globalThis.setInterval(fn,delay),clearIntervalFn=id=>globalThis.clearInterval(id)}={}){
    Object.assign(this,{createRecognition,onText,onState,now,setTimer,clearTimer,setIntervalFn,clearIntervalFn});
    this.wanted=false;this.recognition=null;this.retryTimer=null;this.watchdog=null;this.attempts=0;this.interim='';this.lastVoice=0;this.generation=0;
  }
  start(){if(this.wanted)return;this.wanted=true;this.attempts=0;this.lastResult=this.now();this.connect();if(this.wanted)this.watchdog=this.setIntervalFn(()=>{if(this.wanted&&this.recognition&&this.lastVoice>0&&this.now()-this.lastVoice<1800&&this.now()-this.lastResult>15000)this.recover('speech-timeout');},1000);}
  voice(){this.lastVoice=this.now();}
  flush(){if(this.interim.trim()){this.onText({final:this.interim.trim(),interim:'',provisional:true});this.interim='';}}
  detach(){const recognition=this.recognition;this.recognition=null;++this.generation;if(recognition){recognition.onstart=null;recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch{}}}
  connect(){
    if(!this.wanted)return;
    const generation=++this.generation;let recognition;
    try{recognition=this.createRecognition();}catch{this.fail('unavailable');return;}
    this.recognition=recognition;const committed=new Set();
    recognition.continuous=true;recognition.interimResults=true;recognition.lang='en-US';
    this.onState('starting');this.lastResult=this.now();
    const current=()=>this.wanted&&this.recognition===recognition&&generation===this.generation;
    recognition.onstart=()=>{if(current())this.onState('listening');};
    recognition.onresult=event=>{
      if(!current())return;
      this.lastResult=this.now();this.attempts=0;
      const finals=[],drafts=[];
      for(let i=0;i<event.results.length;i++){
        const result=event.results[i],text=String(result[0]?.transcript||'').trim();
        if(result.isFinal){if(!committed.has(i)){committed.add(i);if(text)finals.push(text);}}
        else if(text)drafts.push(text);
      }
      this.interim=drafts.join(' ');this.onText({final:finals.join(' '),interim:this.interim,provisional:false});this.onState('listening');
    };
    recognition.onerror=event=>{if(!current())return;const reason=event.error||'unknown';if(['not-allowed','service-not-allowed','language-not-supported'].includes(reason))this.fail(reason);else this.recover(reason);};
    recognition.onend=()=>{if(current())this.recover('ended');};
    try{recognition.start();}catch{if(current())this.recover('start-failed');}
  }
  recover(reason){
    if(!this.wanted||this.retryTimer!==null)return;
    this.flush();this.detach();
    const ordinary=reason==='ended'||reason==='no-speech';
    if(!ordinary&&++this.attempts>4){this.fail(reason);return;}
    this.onState('reconnecting',reason);
    this.retryTimer=this.setTimer(()=>{this.retryTimer=null;this.connect();},ordinary?350:Math.min(4000,500*2**(this.attempts-1)));
  }
  fail(reason){this.flush();this.wanted=false;this.clearTimer(this.retryTimer);this.retryTimer=null;this.clearIntervalFn(this.watchdog);this.watchdog=null;this.detach();this.onState('error',reason);}
  stop(){this.flush();this.wanted=false;this.clearTimer(this.retryTimer);this.retryTimer=null;this.clearIntervalFn(this.watchdog);this.watchdog=null;this.detach();this.onState('muted');}
}
