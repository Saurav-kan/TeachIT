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
  return {model,messages:[{role:'user',content}],max_tokens:1800,response_format:{type:'json_object'}};
}

export function readCompletion(result) {
  const content=result.choices?.[0]?.message?.content;
  if(typeof content==='string')return content;
  if(Array.isArray(content))return content.filter(p=>p.type==='text').map(p=>p.text).join('');
  throw Error('The model returned no classroom response.');
}
