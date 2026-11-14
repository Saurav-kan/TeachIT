import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateInput, parseResult } from './session.mjs';
import { buildRequest, readCompletion } from './provider.mjs';

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
      const input=validateInput(await body(req));
      if(busy || Date.now()-lastRequest<20000) return json(res,429,{error:'Please wait before the next classroom analysis.'});
      busy=true; lastRequest=Date.now();
      try {
        const response=await fetch(`${base.replace(/\/$/,'')}/chat/completions`,{
          method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','User-Agent':'TeachIT/0.1','X-Title':'TeachIT'},
          body:JSON.stringify(buildRequest(input,model,vision)),signal:AbortSignal.timeout(60000)
        });
        if(!response.ok) return json(res,502,{error:`Model provider returned ${response.status}. Check model access, API credentials, and image support.`});
        const result=await response.json();
        const output=readCompletion(result);
        return json(res,200,{...parseResult(output),source:'live',usage:result.usage||null,boardSeen:vision&&Boolean(input.board)});
      } finally {busy=false;}
    }
    if(req.method!=='GET') return json(res,405,{error:'Method not allowed.'});
    const files={'/':'index.html','/app.js':'app.js','/board.js':'board.js','/style.css':'style.css'};
    const file=files[url.pathname]; if(!file) return json(res,404,{error:'Not found.'});
    const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[ext], 'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(await readFile(path.join(root,file)));
  } catch(error) {json(res,400,{error:error.name==='TimeoutError'?'The model took too long. Try again.':'Could not process the request. Check input size and format.'});}
});
server.listen(Number(process.env.PORT||3210),'127.0.0.1',()=>console.log(`TeachIT classroom: http://127.0.0.1:${server.address().port}`));
