import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, readCompletion } from '../provider.mjs';

const input={topic:'Plants',transcript:'Plants turn sunlight into stored energy.',board:'data:image/jpeg;base64,YWJj',previousBoard:'data:image/jpeg;base64,ZGVm'};
test('OpenRouter vision requests keep images in labeled chat content parts',()=>{
  const request=buildRequest(input,'meta/muse-spark-1.3-contributor',true);
  assert.equal(request.model,'meta/muse-spark-1.3-contributor');
  assert.equal(request.messages[0].role,'user');
  const content=request.messages[0].content;
  assert.equal(content.filter(p=>p.type==='image_url').length,2);
  assert.deepEqual(content.at(-1),{type:'image_url',image_url:{url:input.board}});
  assert.doesNotMatch(content[0].text,/base64/);
});
test('text-only configuration excludes all image parts',()=>{
  const content=buildRequest(input,'meta/muse-spark-1.3-contributor',false).messages[0].content;
  assert.equal(content.length,1);assert.equal(content[0].type,'text');
});
test('read completion content without accepting empty or reasoning-only output',()=>{
  assert.equal(readCompletion({choices:[{message:{content:'{"question":"Why?"}'}}]}),'{"question":"Why?"}');
  assert.equal(readCompletion({choices:[{message:{content:[{type:'text',text:'Hello'}]}}]}),'Hello');
  assert.throws(()=>readCompletion({choices:[{message:{content:null,reasoning:'Internal reasoning'}}]}));
});
test('a reasoning model has room to finish its structured response',()=>{
  const request=buildRequest(input,'meta/muse-spark-1.3-contributor',false);assert.equal(request.reasoning.effort,'low');assert.ok(request.max_tokens>=4096);
  assert.throws(()=>readCompletion({choices:[{finish_reason:'length',message:{content:'{"question":'}}]}),{code:'OUTPUT_LIMIT'});
});
