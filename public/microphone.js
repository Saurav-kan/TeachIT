// The level is digital input amplitude, not a calibrated sound-pressure reading.
export function measureInput(samples) {
  if (!samples.length) return { rms:0, peak:0, db:-160, bars:0, quality:'quiet' };
  let sum=0, peak=0;
  for(const sample of samples) { const value=Number.isFinite(sample)?sample:0; sum+=value*value; peak=Math.max(peak,Math.abs(value)); }
  const rms=Math.sqrt(sum/samples.length);
  const db=20*Math.log10(Math.max(rms,1e-8));
  const quality=peak>=0.98?'clipping':peak>=0.85||db>-9?'high':db>-50?'good':'quiet';
  const bars=quality==='clipping'?8:quality==='high'?7:db<=-60?0:Math.max(1,Math.min(6,Math.ceil((db+60)/8)));
  return {rms,peak,db,bars,quality};
}

export class Microphone {
  constructor({onState=()=>{},onLevel=()=>{},getStream,createContext,requestFrame,cancelFrame}={}) {
    this.onState=onState;this.onLevel=onLevel;
    this.getStream=getStream||(()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}));
    this.createContext=createContext||(()=>new (window.AudioContext||window.webkitAudioContext)());
    this.requestFrame=requestFrame||(callback=>window.requestAnimationFrame(callback));
    this.cancelFrame=cancelFrame||(id=>window.cancelAnimationFrame(id));
    this.epoch=0;this.status='muted';this.frame=null;
  }
  setState(status,error){this.status=status;this.onState(status,error);}
  async start(){
    if(this.status==='live')return true;
    const epoch=++this.epoch;this.setState('requesting');
    let stream,context,source;
    try{
      // Resume the context from the click, before a permission dialog can consume activation.
      context=this.createContext();this.pendingContext=context;
      const resume=Promise.resolve(context.resume()).then(()=>null,error=>error);
      stream=await this.getStream();
      const resumeError=await resume;
      if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());if(context.state!=='closed')await context.close().catch(()=>{});return false;}
      if(resumeError)throw resumeError;
      if(context.state!=='running')throw new Error('Audio capture was suspended. Try enabling the microphone again.');
      this.pendingContext=null;
      this.stream=stream;this.context=context;
      this.analyser=context.createAnalyser();this.analyser.fftSize=2048;
      source=context.createMediaStreamSource(stream);this.source=source;source.connect(this.analyser);
      // No speaker output connection: microphone audio is never played back.
      this.samples=new Float32Array(this.analyser.fftSize);
      for(const track of stream.getAudioTracks()){
        track.addEventListener('ended',()=>{if(epoch===this.epoch){this.stop();this.setState('error',new Error('Microphone disconnected.'));}},{once:true});
        track.addEventListener('mute',()=>{if(epoch===this.epoch&&this.status==='live'){this.setState('interrupted');this.onLevel(measureInput([]));}});
        track.addEventListener('unmute',()=>{if(epoch===this.epoch&&context.state==='running')this.setState('live');});
      }
      context.onstatechange=()=>{if(epoch!==this.epoch)return;if(context.state==='running')this.setState('live');else if(context.state!=='closed'){this.setState('interrupted');this.onLevel(measureInput([]));}};
      this.setState('live');
      let last=0,hotUntil=0,hotQuality='quiet';
      const tick=time=>{
        if(epoch!==this.epoch)return;
        if(this.status==='live'&&time-last>=60){
          last=time;this.analyser.getFloatTimeDomainData(this.samples);
          const level=measureInput(this.samples);
          if(level.quality==='clipping'){hotUntil=time+500;hotQuality='clipping';}
          else if(level.quality==='high'&&(time>=hotUntil||hotQuality!=='clipping')){hotUntil=time+500;hotQuality='high';}
          if(time<hotUntil){level.quality=hotQuality;level.bars=hotQuality==='clipping'?8:7;}
          this.onLevel(level);
        }
        this.frame=this.requestFrame(tick);
      };
      this.frame=this.requestFrame(tick);return true;
    }catch(error){
      stream?.getTracks().forEach(t=>t.stop());
      source?.disconnect();
      if(context&&context.state!=='closed')await context.close().catch(()=>{});
      if(epoch!==this.epoch)return false;
      this.pendingContext=null;this.stream=null;this.context=null;this.source=null;this.analyser=null;
      this.setState('error',error);return false;
    }
  }
  stop(){
    ++this.epoch;
    if(this.frame!==null)this.cancelFrame(this.frame);this.frame=null;
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
    this.source?.disconnect();this.source=null;this.analyser=null;
    for(const context of new Set([this.context,this.pendingContext]))if(context&&context.state!=='closed'){context.onstatechange=null;context.close().catch(()=>{});}
    this.context=null;this.pendingContext=null;
    this.onLevel(measureInput([]));this.setState('muted');
  }
}
