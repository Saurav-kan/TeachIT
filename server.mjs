import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateInput, parseResult } from './session.mjs';
import { buildRequest, readCompletion } from './provider.mjs';
import { upstreamFailure } from './upstream-errors.mjs';

const root = fileURLToPath(new URL('./public/',import.meta.url));
const key = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || 'meta/muse-spark-1.3-contributor';
const base = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const vision = process.env.OPENROUTER_VISION !== 'false';
let busy=false, lastRequest=0;
function json(res,status,data) { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
async function body(req) { let data=''; for await(const chunk of req) { data+=chunk; if(Buffer.byteLength(data)>2_500_000) throw new Error('Request is too large.'); } return JSON.parse(data); }
const server=http.createServer(async(req,res)=>{
  // Loopback only, no cross-origin API access. Browsers send Origin on POST.
  const host=req.headers.host;
  if(!/^localhost:\d+$|^127\.0\.0\.1:\d+$/.test(host||'')) return json(res,403,{error:'Local requests only.'});
  if(req.headers.origin && ![`http://${host}`].includes(req.headers.origin)) return json(res,403,{error:'Cross-origin request blocked.'});
  const url=new URL(req.url,`http://${host}`);
  try {
    if(url.pathname==='/api/config' && req.method==='GET') return json(res,200,{live:Boolean(key),model,vision});
    if(url.pathname==='/api/analyze' && req.method==='POST') {
      if(!key) return json(res,503,{error:'No API key configured. Use the sample classroom or add OPENROUTER_API_KEY to .env.'});
      if(busy || Date.now()-lastRequest<20000) return json(res,429,{error:'Please wait before the next classroom analysis.'});
      let input;
      try{input=validateInput(await body(req));}catch{return json(res,400,{error:'The lesson input is invalid or too large. Shorten the materials or explanation and try again.'});}
      if(busy || Date.now()-lastRequest<20000) return json(res,429,{error:'Please wait before the next classroom analysis.'});
      busy=true; lastRequest=Date.now();
      try {
        let response;
        try{response=await fetch(`${base.replace(/\/$/,'')}/chat/completions`,{
          method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','User-Agent':'TeachIT/0.1','X-Title':'TeachIT'},
          body:JSON.stringify(buildRequest(input,model,vision)),signal:AbortSignal.timeout(60000)
        });}catch(error){const failure=upstreamFailure(error);return json(res,failure.status,failure);}
        if(!response.ok){
          const reason=response.status===401?'Check the OpenRouter key in the local .env file.':response.status===402?'Check the OpenRouter account credit balance.':response.status===403?'Check model access and the provider’s data-policy settings.':response.status===429?'The provider is rate limited. Please wait before retrying.':'Check model availability and image support.';
          return json(res,502,{code:'UPSTREAM_REJECTED',error:`OpenRouter returned ${response.status}. ${reason}`});
        }
        try{
          const result=await response.json();const output=readCompletion(result);
          return json(res,200,{...parseResult(output,input),source:'live',usage:result.usage||null,boardSeen:vision&&Boolean(input.board)});
        }catch{return json(res,502,{code:'UPSTREAM_FORMAT',error:'The AI response was incomplete or not in the expected format. Your transcript is saved; retry the analysis.'});}
      } finally {busy=false;}
    }
    if(req.method!=='GET') return json(res,405,{error:'Method not allowed.'});
    const files={'/':'index.html','/app.js':'app.js','/evidence.js':'evidence.js','/questions.js':'questions.js','/board.js':'board.js','/microphone.js':'microphone.js','/captions.js':'captions.js','/analysis-trigger.js':'analysis-trigger.js','/style.css':'style.css','/vivid.css':'vivid.css','/workspace.css':'workspace.css','/assets/cobalt-pattern.png':'assets/cobalt-pattern.png','/assets/connection-border.png':'assets/connection-border.png','/assets/corner-flourish.png':'assets/corner-flourish.png'};
    const file=files[url.pathname]; if(!file) return json(res,404,{error:'Not found.'});
    const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[ext], 'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(await readFile(path.join(root,file)));
  } catch(error) {json(res,400,{error:error.name==='TimeoutError'?'The model took too long. Try again.':'Could not process the request. Check input size and format.'});}
});
server.listen(Number(process.env.PORT||3210),'127.0.0.1',()=>console.log(`TeachIT classroom: http://127.0.0.1:${server.address().port}`));
