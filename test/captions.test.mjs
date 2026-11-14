import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Captions} from '../public/captions.js';
function setup(){
  const instances=[],texts=[],states=[],timers=new Map(),intervals=new Map();let id=0,time=100;
  class Recognition{constructor(){instances.push(this);}start(){this.onstart?.();}abort(){this.aborted=true;}}
  const captions=new Captions({createRecognition:()=>new Recognition(),onText:text=>texts.push(text),onState:(state,reason)=>states.push([state,reason]),now:()=>time,setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:key=>timers.delete(key),setIntervalFn:fn=>{intervals.set(++id,fn);return id;},clearIntervalFn:key=>intervals.delete(key)});
  return {captions,instances,texts,states,timers,intervals,setTime:value=>time=value,retry(){const [key,fn]=timers.entries().next().value;timers.delete(key);fn();}};
}
function result(text,final){const value=[{transcript:text}];value.isFinal=final;return value;}
test('interim words remain visible and final result replays do not duplicate text',()=>{
  const h=setup();h.captions.start();const recognition=h.instances[0];assert.equal(recognition.interimResults,true);
  recognition.onresult({results:[result('Plants use',false)]});assert.equal(h.texts.at(-1).interim,'Plants use');
  const event={results:[result('Plants use sunlight.',true)]};recognition.onresult(event);recognition.onresult(event);
  assert.equal(h.texts.filter(t=>t.final).map(t=>t.final).join(' '),'Plants use sunlight.');h.captions.stop();
});
test('a disconnect preserves an unfinished phrase and creates a fresh recognition session',()=>{
  const h=setup();h.captions.start();const first=h.instances[0];first.onresult({results:[result('Chlorophyll absorbs light',false)]});first.onend();
  assert.equal(h.texts.at(-1).final,'Chlorophyll absorbs light');assert.equal(h.texts.at(-1).provisional,true);assert.equal(h.timers.size,1);
  h.retry();assert.equal(h.instances.length,2);assert.notEqual(h.instances[1],first);assert.ok(h.captions.wanted);h.captions.stop();
});
test('transient network failures retry with a bounded terminal state',()=>{
  const h=setup();h.captions.start();
  for(let i=0;i<5;i++){h.instances.at(-1).onerror({error:'network'});if(i<4)h.retry();}
  assert.equal(h.captions.wanted,false);assert.deepEqual(h.states.at(-1),['error','network']);assert.equal(h.timers.size,0);assert.equal(h.intervals.size,0);
});
test('muting cancels a queued reconnect and retains the last partial phrase',()=>{
  const h=setup();h.captions.start();h.instances[0].onresult({results:[result('Energy is stored in',false)]});h.instances[0].onerror({error:'network'});h.captions.stop();
  assert.equal(h.timers.size,0);assert.equal(h.intervals.size,0);assert.equal(h.captions.wanted,false);assert.equal(h.texts.filter(t=>t.final).length,1);
});
test('device audio without transcript progress reconnects instead of silently stalling',()=>{
  const h=setup();h.captions.start();h.setTime(16000);h.captions.voice();[...h.intervals.values()][0]();
  assert.equal(h.timers.size,1);assert.deepEqual(h.states.at(-1),['reconnecting','speech-timeout']);h.captions.stop();
});
test('an unsupported speech API does not leave a watchdog running',()=>{
  let intervals=0;const captions=new Captions({createRecognition:()=>{throw Error();},setIntervalFn:()=>++intervals});captions.start();assert.equal(intervals,0);assert.equal(captions.wanted,false);
});
