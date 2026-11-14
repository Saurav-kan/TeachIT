import { makePrompt } from './session.mjs';

export function buildRequest(input, model, vision) {
  const content=[{type:'text',text:makePrompt(input)}];
  if(vision) {
    for(const [field,label] of [
      ['previousBoard','Previous board snapshot:'],
      ['board','Current board snapshot:'],
      ['recencyBoard','Supplementary recency view. Purple strokes were made in the last 15 seconds. Dark strokes are older. Original colors remain in the primary image.']
    ]) if(input[field]) content.push({type:'text',text:label},{type:'image_url',image_url:{url:input[field]}});
  }
  // Spark's default reasoning can consume a small shared output budget before JSON finishes.
  return {model,messages:[{role:'user',content}],max_tokens:4096,response_format:{type:'json_object'},...(model.startsWith('meta/muse-spark')?{reasoning:{effort:'low',exclude:true}}:{})};
}

export function readCompletion(result) {
  if(result.choices?.[0]?.finish_reason==='length')throw Object.assign(new Error('The model reached its output limit before completing the classroom response.'),{code:'OUTPUT_LIMIT'});
  const content=result.choices?.[0]?.message?.content;
  if(typeof content==='string')return content;
  if(Array.isArray(content))return content.filter(p=>p.type==='text').map(p=>p.text).join('');
  throw Error('The model returned no classroom response.');
}
