export const CHECKS: readonly (readonly [string,string])[];
export interface LiveOptions {base:string;stock:string;output:string}
export interface LiveRow {id:string;check:string;status:"PASS"|"FAIL";detail:string}
export function parseLiveArguments(args:string[]):LiveOptions;
export function previewPosture(responses:{headers:Headers}[],robots:string,sitemapStatus:number):boolean;
export function runLiveCheck(options:LiveOptions):Promise<{base:string;stock:string;indexing:string;checkedAt:string;rows:LiveRow[]}>;
