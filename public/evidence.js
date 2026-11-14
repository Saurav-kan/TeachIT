export const normalizeEvidence=text=>String(text||'').replace(/\s+/g,' ').trim().toLowerCase();

// Stable document and line identifiers also drive the browser's source viewer.
export function sourceDocuments(materials){
  const documents=[];let current={id:'source-1',name:'Lesson materials',lines:[]};
  for(const line of String(materials||'').split(/\r?\n/)){
    const marker=line.match(/^\[Source: (.+)\]$/)||line.match(/^([^\[\]\r\n]+\.(?:txt|md))$/i);
    if(marker){if(current.lines.some(l=>l.trim()))documents.push(current);current={id:`source-${documents.length+1}`,name:marker[1].slice(0,160),lines:[]};}
    else current.lines.push(line);
  }
  if(current.lines.some(l=>l.trim()))documents.push(current);
  return documents;
}

export function verifiedCitation(citation,documents){
  if(!citation||!Number.isInteger(citation.lineStart)||!Number.isInteger(citation.lineEnd))return null;
  const doc=documents.find(d=>d.id===citation.sourceId);
  const {lineStart:start,lineEnd:end}=citation;
  if(!doc||start<1||end<start||end>doc.lines.length||end-start>12)return null;
  const quote=String(citation.quote||'').slice(0,1500);
  if(normalizeEvidence(quote).length<12||!normalizeEvidence(doc.lines.slice(start-1,end).join('\n')).includes(normalizeEvidence(quote)))return null;
  return {sourceId:doc.id,sourceName:doc.name,lineStart:start,lineEnd:end,quote};
}
