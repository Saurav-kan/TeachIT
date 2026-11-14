import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Microphone, measureInput } from '../public/microphone.js';

test('silence leaves the actual-input meter empty',()=>{
  const result=measureInput(new Float32Array(2048));
  assert.equal(result.bars,0);assert.equal(result.quality,'quiet');assert.ok(Number.isFinite(result.db));
});
test('voice, high signal and clipping are distinct rather than decorative animation',()=>{
  const sine=amplitude=>Float32Array.from({length:2048},(_,i)=>amplitude*Math.sin(i*Math.PI/16));
  const voice=measureInput(sine(.15));assert.equal(voice.quality,'good');assert.ok(voice.bars>0&&voice.bars<=6);
  const loud=measureInput(sine(.9));assert.equal(loud.quality,'high');assert.equal(loud.bars,7);
  const clipped=measureInput(sine(1));assert.equal(clipped.quality,'clipping');assert.equal(clipped.bars,8);
});

function harness(getStream){
  class Track extends EventTarget {stop(){this.stopped=true;}}
  const track=new Track();const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const source={connect(){},disconnect(){this.disconnected=true;}};
  const context={state:'suspended',resume(){this.state='running';return Promise.resolve();},close(){this.state='closed';return Promise.resolve();},createAnalyser(){return {fftSize:2048,getFloatTimeDomainData(array){array.fill(.05);}};},createMediaStreamSource(){return source;}};
  const states=[],frames=new Map();let next=0;
  const mic=new Microphone({getStream:getStream||(()=>Promise.resolve(stream)),createContext:()=>context,onState:status=>states.push(status),requestFrame:fn=>{frames.set(++next,fn);return next;},cancelFrame:id=>frames.delete(id)});
  return {mic,track,stream,source,context,states,frames};
}
test('muting releases the input track, graph and animation immediately',async()=>{
  const h=harness();assert.equal(await h.mic.start(),true);assert.equal(h.mic.status,'live');assert.equal(h.frames.size,1);
  h.mic.stop();assert.equal(h.track.stopped,true);assert.equal(h.source.disconnected,true);assert.equal(h.context.state,'closed');assert.equal(h.frames.size,0);assert.equal(h.mic.status,'muted');
});
test('granting permission after cancellation cannot turn capture back on',async()=>{
  let grant;const permission=new Promise(resolve=>grant=resolve);const h=harness(()=>permission);
  const start=h.mic.start();assert.equal(h.mic.status,'requesting');h.mic.stop();grant(h.stream);
  assert.equal(await start,false);assert.equal(h.track.stopped,true);assert.equal(h.mic.status,'muted');assert.equal(h.frames.size,0);
});
test('denied permission leaves no live indicator or open audio context',async()=>{
  const h=harness(()=>Promise.reject(Object.assign(new Error('Denied'),{name:'NotAllowedError'})));
  assert.equal(await h.mic.start(),false);assert.equal(h.mic.status,'error');assert.equal(h.context.state,'closed');assert.equal(h.frames.size,0);assert.ok(!h.states.includes('live'));
});
test('an input device disconnect returns the control to an error state',async()=>{
  const h=harness();await h.mic.start();h.track.dispatchEvent(new Event('ended'));
  assert.equal(h.mic.status,'error');assert.equal(h.track.stopped,true);assert.equal(h.context.state,'closed');assert.equal(h.frames.size,0);
});
test('browser animation callbacks retain the Window receiver',async()=>{
  const previous=globalThis.window;const h=harness();let canceled=false;
  globalThis.window={requestAnimationFrame(){assert.equal(this,globalThis.window);return 7;},cancelAnimationFrame(id){assert.equal(this,globalThis.window);assert.equal(id,7);canceled=true;}};
  try{const mic=new Microphone({getStream:()=>Promise.resolve(h.stream),createContext:()=>h.context});assert.equal(await mic.start(),true);mic.stop();assert.equal(canceled,true);}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
