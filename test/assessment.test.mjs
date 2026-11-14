import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseResult,validateInput,makePrompt} from '../session.mjs';
import {sourceDocuments,verifiedCitation} from '../public/evidence.js';
import {advanceQuestion,answerSinceQuestion} from '../public/questions.js';

const input=validateInput({topic:'Plants',materials:'[Source: biology.txt]\nGlucose stores chemical energy.\nOxygen is released as a byproduct.',transcript:'Glucose stores electrical energy. Oxygen is released as a byproduct.',questionContext:{id:'q1',question:'How is energy stored?',answerSinceQuestion:'Glucose stores electrical energy.'}});
const response={student:'Maya',question:'What happens next?',notes:[],feedback:'Keep going',answerAssessment:{questionId:'q1',status:'incorrect',feedback:'Revisit energy storage.',evidence:'Glucose stores electrical energy.'},factChecks:[{claim:'Glucose stores electrical energy.',verdict:'contradicted',explanation:'The material says chemical energy.',reviewTopic:'Energy storage in glucose',citations:[{sourceId:'source-1',lineStart:1,lineEnd:1,quote:'Glucose stores chemical energy.'}]}]};
test('source contradictions preserve exact file and line evidence',()=>{
  const result=parseResult(JSON.stringify(response),input);assert.equal(result.answerAssessment.status,'incorrect');assert.equal(result.factChecks[0].verdict,'contradicted');assert.equal(result.factChecks[0].citations[0].sourceName,'biology.txt');
});
test('invented quotations, files and line ranges cannot become verified corrections',()=>{
  for(const citation of [{sourceId:'unknown',lineStart:1,lineEnd:1,quote:'Glucose stores chemical energy.'},{sourceId:'source-1',lineStart:12,lineEnd:12,quote:'Glucose stores chemical energy.'},{sourceId:'source-1',lineStart:1,lineEnd:1,quote:'Glucose stores electrical energy.'}]){
    const result=parseResult(JSON.stringify({...response,factChecks:[{...response.factChecks[0],citations:[citation]}]}),input);
    assert.equal(result.factChecks[0].verdict,'unverified');assert.equal(result.factChecks[0].citations.length,0);assert.doesNotMatch(result.factChecks[0].explanation,/says chemical/);
  }
});
test('no documents and invented teacher statements do not yield verified claims',()=>{
  assert.equal(parseResult(JSON.stringify(response),{...input,materials:''}).factChecks[0].verdict,'unverified');
  assert.equal(parseResult(JSON.stringify(response),{...input,transcript:'Something else.'}).factChecks.length,0);
});
test('answer correctness needs a matching question and a real transcript quote',()=>{
  const result=parseResult(JSON.stringify({...response,answerAssessment:{questionId:'q1',status:'answered',evidence:'A made-up correct answer'}}),input);assert.equal(result.answerAssessment.status,'unaddressed');
  assert.equal(parseResult(JSON.stringify(response),{...input,questionContext:{id:'q2'}}).answerAssessment,null);
});
test('a cited misconception is resolved only by a later real correction',()=>{
  const corrected={...input,transcript:input.transcript+' I meant glucose stores chemical energy.'};
  const check={...response.factChecks[0],resolvedBy:'I meant glucose stores chemical energy.'};
  assert.equal(parseResult(JSON.stringify({...response,factChecks:[check]}),corrected).factChecks[0].verdict,'corrected');
  assert.equal(parseResult(JSON.stringify({...response,factChecks:[check]}),input).factChecks[0].verdict,'contradicted');
  assert.equal(parseResult(JSON.stringify({...response,factChecks:[check]}),{...corrected,materials:''}).factChecks[0].verdict,'unverified');
});
test('automatic assessment does not depend on an acknowledgement button',()=>{
  const baseline='Plants use sunlight.';
  const current={id:'q1',student:'Maya',question:'How is energy stored?',baseline,status:'waiting'};
  const result={...response,answerAssessment:{questionId:'q1',status:'answered',evidence:'Glucose stores chemical energy.',feedback:'Correct.'}};
  const next=advanceQuestion(current,result,baseline+' Glucose stores chemical energy.','q2');
  assert.equal(next.status,'answered');assert.equal(next.id,'q1');assert.equal(next.question,current.question);
  assert.equal(answerSinceQuestion(current,baseline+' Glucose stores chemical energy.'),'Glucose stores chemical energy.');
  assert.equal(advanceQuestion(next,result,'New baseline','q3').id,'q3');
});
test('partial and unrelated answers retain the question; stale responses cannot resolve it',()=>{
  const current={id:'q1',question:'Why?',status:'answering',baseline:'Original'};
  assert.equal(advanceQuestion(current,{...response,answerAssessment:{questionId:'q1',status:'partial',feedback:'Explain why.'}},'','q2').status,'partial');
  assert.equal(advanceQuestion(current,{...response,answerAssessment:{questionId:'q2',status:'answered'}},'','q3'),current);
  assert.equal(advanceQuestion(current,{...response,answerAssessment:{questionId:'q1',status:'unaddressed'}},'','q2').status,'answering');
  assert.equal(answerSinceQuestion(current,'Edited explanation'),'Edited explanation');
});
test('multiple uploaded files get stable source identifiers and local line numbers',()=>{
  const docs=sourceDocuments('Intro notes\n\n[Source: one.md]\nFirst source line.\n[Source: two.txt]\nSecond source line.');
  assert.deepEqual(docs.map(d=>[d.id,d.name]),[['source-1','Lesson materials'],['source-2','one.md'],['source-3','two.txt']]);
  assert.equal(verifiedCitation({sourceId:'source-3',lineStart:1,lineEnd:1,quote:'Second source line.'},docs).sourceName,'two.txt');
});
test('prompt supplies numbered sources without duplicating raw material and requests automatic assessment',()=>{
  const prompt=makePrompt(input);assert.match(prompt,/regardless of any button press/);assert.match(prompt,/"line":1/);assert.equal(prompt.split('Glucose stores chemical energy.').length-1,1);assert.match(prompt,/model knowledge alone is not a verified correction/);
});
