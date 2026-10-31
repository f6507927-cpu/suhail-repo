export const workflow = ["draft","source_verified","rules_normalized","tests_passed","universe_tested","human_reviewed","approved"] as const;
export function nextStage(status:string) {
  const index=workflow.indexOf(status as typeof workflow[number]);
  return index<0?null:workflow[index+1]??null;
}
export class GovernanceError extends Error {}
export function requireGate(condition:unknown,message:string):asserts condition {
  if(!condition) throw new GovernanceError(message);
}

export function requirePublicProduction(isPublic:boolean) {
  requireGate(isPublic,"Publish the version before enabling production");
}

export function requireVisibilityChange(productionEnabled:boolean,isPublic:boolean,isDefault:boolean) {
  requireGate(isPublic || !productionEnabled,"A production-enabled version cannot be unpublished");
  requireGate(isPublic || !isDefault,"The editorial default methodology version cannot be unpublished; select another default first");
}
