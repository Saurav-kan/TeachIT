import {test} from 'node:test';
import assert from 'node:assert/strict';
import {upstreamFailure} from '../upstream-errors.mjs';
test('upstream certificate failures are not mislabeled as malformed lesson input',()=>{
  const result=upstreamFailure({cause:{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'}});assert.equal(result.status,502);assert.equal(result.code,'TLS_TRUST');assert.match(result.error,/trusted system certificate/);
});
test('timeouts distinguish unavailable AI from a healthy microphone',()=>{
  const result=upstreamFailure({name:'TimeoutError'});assert.equal(result.status,504);assert.match(result.error,/transcript is saved/);
});
