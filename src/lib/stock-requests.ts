import "server-only";
import { and,eq,sql } from "drizzle-orm";
import { dbApp } from "../db/app";
import { stockRequest } from "../db/schema/search";
import { requireRole } from "./auth/guards";
import { AuthError } from "./auth/errors";
import { normalizedStockRequest,type StockRequestRow } from "./stock-request-input";

export type StockRequestStatus="created"|"already_requested"|"limit_reached";
function queryValue(input:unknown) {
  const query=normalizedStockRequest(input);
  if(!query)throw new AuthError(400,"invalid_query");
  return query;
}
function limitError(error:unknown):boolean {
  // Inspect only the static PG diagnostic, never copy SQL/parameters into logs.
  let current=error;
  for(let depth=0;depth<4 && typeof current==="object" && current!==null;depth++){
    const diagnostic=current as {code?:string;message?:string;cause?:unknown};
    if(diagnostic.code==="P0001" && diagnostic.message==="stock_request_limit_reached")return true;
    current=diagnostic.cause;
  }
  return false;
}
export async function createStockRequest(input:unknown):Promise<StockRequestStatus> {
  const {user}=await requireRole(["user","editor","admin"],{scope:"account"});
  const query=queryValue(input);
  try{
    // The migration's per-user lock/cap also protects concurrent callers and
    // preserves duplicate semantics when the user already has twenty rows.
    const inserted=await dbApp.insert(stockRequest).values({user_id:user.id,normalized_query:query})
      .onConflictDoNothing().returning({created_at:stockRequest.created_at});
    return inserted.length ? "created" : "already_requested";
  }catch(error){
    if(limitError(error))return "limit_reached";
    // Do not propagate Drizzle's parameter-bearing error to Next's logger.
    throw new Error("stock_requests_unavailable");
  }
}
export async function removeStockRequest(input:unknown) {
  const {user}=await requireRole(["user","editor","admin"],{scope:"account"});
  const query=queryValue(input);
  try{
    await dbApp.delete(stockRequest).where(and(eq(stockRequest.user_id,user.id),eq(stockRequest.normalized_query,query)));
  }catch{throw new Error("stock_requests_unavailable");}
}
export async function getOwnStockRequests():Promise<StockRequestRow[]> {
  const {user}=await requireRole(["user","editor","admin"],{scope:"account"});
  try{
    const rows=await dbApp.execute<StockRequestRow>(sql`
      select normalized_query,created_at::text as created_at from app.stock_request
      where user_id=${user.id} order by created_at desc,normalized_query collate "C" asc limit 20
    `);
    return Array.from(rows,row=>({...row,created_at:new Date(row.created_at).toISOString()}));
  }catch{throw new Error("stock_requests_unavailable");}
}
