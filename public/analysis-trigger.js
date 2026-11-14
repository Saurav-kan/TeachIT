// Repeated speech updates must not continually move the analysis deadline.
export class AnalysisTrigger {
  constructor({ready,run,delay,setTimer=(fn,delay)=>globalThis.setTimeout(fn,delay),clearTimer=id=>globalThis.clearTimeout(id)}){Object.assign(this,{ready,run,delay,setTimer,clearTimer});this.timer=null;}
  request(){if(this.timer!==null||!this.ready())return;this.timer=this.setTimer(()=>{this.timer=null;if(this.ready())this.run();},this.delay());}
  cancel(){if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
}
