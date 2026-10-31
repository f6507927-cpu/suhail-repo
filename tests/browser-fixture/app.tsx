import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { DISPLAY_TIME_ZONE } from "../../src/lib/format";
import { AccountControl } from "../../src/components/accounts/AccountControl";
import { SignInScreen,ConsentScreen } from "../../src/components/accounts/AuthScreens";
import { MfaClientPanel } from "../../src/components/accounts/MfaScreens";
import { AccountScreen } from "../../src/components/accounts/AccountScreen";
import { fixture } from "./auth";
import { accountFixture } from "./actions";
import { AdminFixture } from "./AdminFixture";
import { MethodologyFixture } from "./MethodologyFixture";
import { FinancialFixture } from "./FinancialFixture";
import { financialFixture } from "./financial-actions";
import { screeningFixture } from "./screening-actions";
import en from "../../src/i18n/messages/en.json";
import ar from "../../src/i18n/messages/ar.json";
import { CURRENT_TERMS_VERSION,CURRENT_PRIVACY_VERSION } from "../../src/lib/auth/policies";
import Forbidden from "../../src/app/[locale]/(private)/forbidden";
import { SiteHeader } from "../../src/components/foundation/SiteHeader";
import { AccountIdentityControl } from "../../src/components/accounts/AccountIdentityControl";
import { AdminShell } from "../../src/components/accounts/AdminScreens";
import { RecoveryScreen } from "../../src/components/foundation/RecoveryScreen";
import { RecoveryDocumentClient } from "../../src/components/foundation/RecoveryDocumentClient";
import { safeNext, localePath } from "../../src/lib/auth/paths";
declare global {interface Window {fixture:typeof fixture}}
window.fixture=fixture;
window.accountFixture=accountFixture;
window.financialFixture=financialFixture;
window.screeningFixture=screeningFixture;
const locale=window.location.pathname.startsWith("/en")?"en":"ar";
const query = new URLSearchParams(window.location.search);
const next = safeNext(query.get("next"));
const mode=new URLSearchParams(window.location.search).get("screen")??
  (window.location.pathname.includes("/admin/runs/")?"financial":
    window.location.pathname.endsWith("/admin/methodologies")?"methodologies":
    window.location.pathname.endsWith("/account")?"account":"header");
const content=mode==="forbidden"?<Forbidden/>:
  mode==="error"||mode==="not-found"||mode==="global-error"?<RecoveryScreen locale={locale} kind={mode==="not-found"?"not-found":"error"}/>:
  mode==="signin"?<SignInScreen locale={locale} next={next} providerError={query.has("error")?"Sign-in was cancelled. You can try again.":null} valueStatement={locale==="en"?en.app.tagline:ar.app.tagline}/>:
  mode==="methodologies"?<AdminShell locale={locale} role="admin" currentPath={window.location.pathname} userLabel="Fixture Admin"><MethodologyFixture locale={locale}/></AdminShell>:
  mode==="financial"?<FinancialFixture locale={locale}/>:
  ["users","audit","settings","deferred"].includes(mode)?<AdminFixture locale={locale} mode={mode}/>:
  mode==="consent"?<ConsentScreen locale={locale} next={next??localePath(locale,"/account")} backTo={next??localePath(locale,"/")}/>:
  mode==="enroll"||mode==="verify"?<MfaClientPanel locale={locale} mode={mode} next={query.has("next")?next??undefined:"/done"} backTo={next??localePath(locale,"/")}/>:
  mode==="account"?<AccountScreen locale={locale} profile={{id:"fixture",full_name:"Fixture",email:null,role:new URLSearchParams(window.location.search).get("role")==="admin"?"admin":new URLSearchParams(window.location.search).get("role")==="editor"?"editor":"user",locale_pref:new URLSearchParams(window.location.search).get("pref")==="en"?"en":"ar",terms_version:CURRENT_TERMS_VERSION,privacy_version:CURRENT_PRIVACY_VERSION,accepted_at:"2026-10-11T00:00:00Z"}} updateLocale={(...args)=>accountFixture.action("updateLocale",...args)} deleteAccount={(...args)=>accountFixture.action("deleteAccount",...args)}/>:
  <main><h1>Suhail home</h1></main>;
const messages=locale==="en"?en:ar;
 const hasAdminShell=["methodologies","users","audit","settings","deferred","financial"].includes(mode);
const header=hasAdminShell||mode==="not-found"||mode==="global-error"?null:
  <SiteHeader locale={locale} labels={{appName:messages.app.name,menu:messages.nav.menu,picks:messages.nav.picks,methodologies:messages.nav.methodologies}}
    accountControl={mode==="enroll"||mode==="verify"?null:query.has("identity")?<AccountIdentityControl locale={locale} identity={query.get("identity")==="anonymous"?null:{fullName:"Fixture Admin",role:"admin"}}/>:<AccountControl locale={locale}/>}/>;
if (mode==="global-error") {
  // Exercise the real provider-independent root recovery document, not a
  // localized page that would silently rely on a surviving layout/provider.
  createRoot(document).render(<RecoveryDocumentClient kind="error"/>);
} else {
  const root = createRoot(document.getElementById("root")!);
  accountFixture.unmount = () => root.unmount();
  root.render(<NextIntlClientProvider locale={locale} messages={messages} timeZone={DISPLAY_TIME_ZONE}>{header}{content}</NextIntlClientProvider>);
}
