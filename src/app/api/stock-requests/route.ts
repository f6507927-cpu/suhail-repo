import { requireRole } from "../../../lib/auth/guards";
import { privateJson,httpError,sameOriginPost } from "../../../lib/auth/http";
import { AuthError } from "../../../lib/auth/errors";
import { createStockRequest,removeStockRequest } from "../../../lib/stock-requests";
import { normalizedStockRequest } from "../../../lib/stock-request-input";

export const dynamic="force-dynamic";
async function readQuery(request:Request) {
  // D-136 limits request frequency in proxy.ts; bound the JSON body as well.
  const reader=request.body?.getReader();
  if(!reader)throw new AuthError(400,"invalid_query");
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let bytes=0,text="";
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>1024){await reader.cancel();throw new Error("oversized");}
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
    const value:unknown=JSON.parse(text);
    if(!value || typeof value!=="object" || Array.isArray(value) ||
      Object.keys(value).length!==1 || !Object.hasOwn(value,"query"))throw new Error("shape");
    const query=normalizedStockRequest((value as {query:unknown}).query);
    if(!query)throw new Error("query");
    return query;
  }catch{throw new AuthError(400,"invalid_query");}
  finally{reader.releaseLock();}
}
export async function POST(request:Request) {
  try{
    await requireRole(["user","editor","admin"],{scope:"account"});
    sameOriginPost(request);
    const status=await createStockRequest(await readQuery(request));
    return privateJson({status},status==="created"?201:status==="limit_reached"?409:200);
  }catch(error){return httpError(error);}
}
export async function DELETE(request:Request) {
  try{
    await requireRole(["user","editor","admin"],{scope:"account"});
    sameOriginPost(request);
    await removeStockRequest(await readQuery(request));
    return privateJson({status:"removed"});
  }catch(error){return httpError(error);}
}
