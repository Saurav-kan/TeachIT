import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, parseResult, makePrompt } from '../session.mjs';

test('test sessions default to no hints and preserve explicit permission',()=>{
  const input={topic:'Plants',transcript:'Plants convert light into stored chemical energy.',mode:'test'};
  assert.match(makePrompt(validateInput(input)),/Do not provide hints/);
  assert.doesNotMatch(makePrompt(validateInput({...input,hints:true})),/Do not provide hints/);
});
test('reject malformed and excessive model inputs',()=>{
  assert.throws(()=>validateInput({topic:'Plants',transcript:'x'.repeat(20001)}));
  assert.throws(()=>validateInput({topic:'Plants',transcript:'Hello',board:'https://external.example/image.jpg'}));
  const valid=validateInput({topic:'Plants',transcript:'Hello',materials:'a'.repeat(20000),events:Array(200).fill({type:'pen'})});
  assert.equal(valid.materials.length,18000);assert.equal(valid.events.length,100);
});
test('sanitize structured output without treating it as executable markup',()=>{
  const result=parseResult('```json\n'+JSON.stringify({student:'Unknown',question:'<script>test</script>',notes:[null,{term:'Light',definition:'A source of energy.'}],score:120,feedback:'Continue',hint:null})+'\n```');
  assert.equal(result.student,'Maya');assert.equal(result.score,100);assert.equal(result.notes.length,1);assert.equal(result.question,'<script>test</script>');
  assert.throws(()=>parseResult('{"question":12}'));
});
test('do not repeat image base64 in the text prompt',()=>{
  const prompt=makePrompt(validateInput({topic:'Plants',transcript:'An explanation.',board:'data:image/jpeg;base64,YWJj'}));
  assert.doesNotMatch(prompt,/base64/);assert.match(prompt,/untrusted lesson material/);
});
