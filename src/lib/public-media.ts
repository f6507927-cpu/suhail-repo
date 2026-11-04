import "server-only";
import { getPublicMediaEnv } from "../env/storage";

export function publicPortraitUrl(key:string|null):string|null {
  if(!key)return null;
  // An object key is not an arbitrary URL or a path relative to the website.
  const segments=key.split("/");
  if(segments.some(part=>!part || part==="." || part===".." || /[\\\u0000-\u001f]/u.test(part)))
    throw new Error("Invalid public portrait object key");
  const base=new URL(getPublicMediaEnv().PUBLIC_MEDIA_BASE_URL);
  if(!["https:","http:"].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new Error("Invalid public media base URL");
  base.pathname=`${base.pathname.replace(/\/$/,"")}/${segments.map(encodeURIComponent).join("/")}`;
  return base.href;
}
