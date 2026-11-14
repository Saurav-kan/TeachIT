export function upstreamFailure(error){
  const code=error?.cause?.code||error?.code;
  if(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','DEPTH_ZERO_SELF_SIGNED_CERT'].includes(code))return {status:502,code:'TLS_TRUST',error:'OpenRouter’s certificate chain could not be verified. Restart TeachIT with Start-TeachIT.cmd so Node uses the trusted system certificate store.'};
  if(['TimeoutError','AbortError'].includes(error?.name))return {status:504,code:'UPSTREAM_TIMEOUT',error:'The AI classroom took too long to respond. Your transcript is saved; retry the analysis.'};
  return {status:502,code:'UPSTREAM_NETWORK',error:'Could not reach OpenRouter. Check the network connection, then retry the analysis. Your transcript is saved.'};
}
