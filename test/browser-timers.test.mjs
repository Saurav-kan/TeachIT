import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Captions} from '../public/captions.js';
import {AnalysisTrigger} from '../public/analysis-trigger.js';
test('caption and analysis timer callbacks retain the browser global receiver',()=>{
  const names=['setTimeout','clearTimeout','setInterval','clearInterval'];const original=Object.fromEntries(names.map(name=>[name,globalThis[name]]));let calls=0;
  for(const name of names)globalThis[name]=function(){assert.equal(this,globalThis);calls++;return 1;};
  try{const captions=new Captions({createRecognition:()=>({start(){},abort(){}})});captions.start();captions.stop();const analysis=new AnalysisTrigger({ready:()=>true,run(){},delay:()=>10});analysis.request();analysis.cancel();assert.ok(calls>=4);}finally{for(const name of names)globalThis[name]=original[name];}
});
