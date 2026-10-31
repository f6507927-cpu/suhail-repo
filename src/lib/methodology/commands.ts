export type MethodologyCommand =
  | {operation:"metadata";id:string|null;data:unknown}
  | {operation:"version";methodologyId:string;id:string|null;cloneId:string|null;data:unknown}
  | {operation:"criterion";versionId:string;id:string|null;data:unknown}
  | {operation:"deleteCriterion";versionId:string;id:string}
  | {operation:"cases";versionId:string;data:unknown}
  | {operation:"source";versionId:string;sourceId:string}
  | {operation:"visibility";versionId:string;isPublic:boolean}
  | {operation:"transition";versionId:string;target:string;note:string}
  | {operation:"production";versionId:string;note:string};
export type MethodologyActionResult = {ok:boolean;error?:string;id?:string;reportId?:string|null};
