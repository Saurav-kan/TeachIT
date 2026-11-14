import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AnalysisTrigger} from '../public/analysis-trigger.js';
test('continuous speech does not postpone the first analysis forever',()=>{
  let callback,runs=0,scheduled=0;const trigger=new AnalysisTrigger({ready:()=>true,run:()=>runs++,delay:()=>1500,setTimer:fn=>{callback=fn;scheduled++;return 1;},clearTimer:()=>assert.fail('Speech should not reset the deadline')});
  for(let i=0;i<100;i++)trigger.request();assert.equal(scheduled,1);callback();assert.equal(runs,1);
});
test('pausing cancels queued work and a stale callback rechecks readiness',()=>{
  let callback,ready=true,canceled=false;const trigger=new AnalysisTrigger({ready:()=>ready,run:()=>assert.fail('Paused analysis must not run'),delay:()=>20000,setTimer:fn=>{callback=fn;return 1;},clearTimer:()=>canceled=true});
  trigger.request();ready=false;trigger.cancel();callback();assert.equal(canceled,true);assert.equal(trigger.timer,null);
});
