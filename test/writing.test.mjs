import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateInput,makePrompt,parseResult} from '../session.mjs';
test('a written explanation can be assessed with no spoken transcript',()=>{
 const input=validateInput({topic:'PC parts',transcript:'',writing:'RAM holds temporary working data.'});assert.equal(input.writing,'RAM holds temporary working data.');assert.match(makePrompt(input),/Assess it even when transcript is empty/);assert.match(makePrompt(input),/RAM holds temporary working data/);
 assert.throws(()=>validateInput({topic:'PC parts',transcript:'',writing:''}));assert.throws(()=>validateInput({topic:'PC parts',transcript:'Hello',writing:'x'.repeat(20001)}));
});
test('written answers and written factual claims are verified against the teacher text',()=>{
 const input=validateInput({topic:'RAM',transcript:'',writing:'RAM loses its contents when power is removed.',materials:'RAM loses its contents when power is removed.',questionContext:{id:'q1',question:'What happens when power is removed?'}});
 const output={student:'Maya',question:'How does an SSD differ?',notes:[],feedback:'Good.',answerAssessment:{questionId:'q1',status:'answered',evidence:input.writing},factChecks:[{claim:input.writing,verdict:'supported',citations:[{sourceId:'source-1',lineStart:1,lineEnd:1,quote:input.materials}]}]};
 const result=parseResult(JSON.stringify(output),input);assert.equal(result.answerAssessment.status,'answered');assert.equal(result.factChecks[0].verdict,'supported');
});
