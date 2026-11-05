import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ENTRANCE_FRAMES,RATIO_FRAMES,STAGGER_MS,PublicMotion,installPublicMotion } from "../src/components/foundation/PublicMotion";
import { THEME_COLORS,THEME_SCRIPT } from "../src/lib/theme-script";
import { syncThemeColor } from "../src/components/foundation/ThemeColor";

beforeEach(()=>vi.stubGlobal("React",React));
afterEach(()=>vi.unstubAllGlobals());
type MotionNode = "heading" | "card" | "nested" | "bar" | "incoming";
type Bounds = Pick<DOMRect, "top" | "bottom" | "left" | "right">;
function harness(reduce=false, bounds: Partial<Record<MotionNode, Partial<Bounds>>> = {}) {
  let emit:(entries:IntersectionObserverEntry[])=>void=()=>{};
  let change:()=>void=()=>{};
  let focus:()=>void=()=>{};
  let refresh:()=>void=()=>{};
  let streamed=false;
  const observed:unknown[]=[];
  const preference={matches:reduce,addEventListener:vi.fn((_name:string,cb:()=>void)=>{change=cb;}),removeEventListener:vi.fn()};
  const animations:{cancel:ReturnType<typeof vi.fn>;onfinish:unknown}[]=[];
  const animate=vi.fn(()=>{const animation={cancel:vi.fn(),onfinish:null};animations.push(animation);return animation;});
  const root={animate,querySelectorAll:(selector:string)=>selector==="[data-ux-ratio]"?[bar]:[heading,card,nested,...(streamed?[incoming]:[])],
    addEventListener:(_name:string,cb:()=>void)=>{focus=cb;},removeEventListener:vi.fn()};
  const node=(parent:unknown,name:MotionNode,ratio=false)=>({parentElement:parent,matches:()=>false,querySelector:()=>null,
    getBoundingClientRect:vi.fn(()=>({top:900,bottom:1000,left:0,right:300,...bounds[name]})),
    hasAttribute:()=>ratio,contains:()=>false,animate});
  const heading=node(root,"heading"),card=node(root,"card"),nested=node(card,"nested"),bar=node(root,"bar",true);
  const incoming=node(root,"incoming");
  class Observer {
    constructor(callback:(entries:IntersectionObserverEntry[])=>void){emit=callback;}
    observe(element:unknown){observed.push(element);}
    unobserve=vi.fn();
    disconnect=vi.fn();
  }
  class Mutations {
    constructor(callback:()=>void){refresh=callback;}
    observe=vi.fn();disconnect=vi.fn();
  }
  vi.stubGlobal("window",{innerHeight:800,innerWidth:375,matchMedia:()=>preference,IntersectionObserver:Observer});
  vi.stubGlobal("document",{activeElement:null,body:{}});
  vi.stubGlobal("IntersectionObserver",Observer);
  vi.stubGlobal("MutationObserver",Mutations);
  const dispose=installPublicMotion(root as unknown as HTMLElement,new WeakSet());
  const enter=(targets:unknown[]=observed,isIntersecting=true)=>emit(targets.map(target=>({target,isIntersecting}) as IntersectionObserverEntry));
  return {observed,animate,animations,preference,enter,dispose,heading,card,bar,incoming,
    setBounds:(name:MotionNode,value:Partial<Bounds>)=>{bounds[name]=value;},
    stream:(value:Partial<Bounds>)=>{bounds.incoming=value;streamed=true;refresh();},
    refresh:()=>refresh(),focus:()=>focus(),change:()=>change()};
}
describe("UX-7 progressively enhanced motion",()=>{
  it("server-renders all content without an opacity/visibility gate",()=>{
    const html=renderToStaticMarkup(<PublicMotion><main><h1>Visible without JavaScript</h1><p>Text</p></main></PublicMotion>);
    expect(html).toContain("Visible without JavaScript");
    expect(html).not.toMatch(/hidden|opacity|style=/);
  });
  it("uses only 20px transform/opacity frames and 80ms staggering",()=>{
    const h=harness();
    expect(h.observed).toHaveLength(3); // heading, whole card, ratio; not nested text twice.
    h.enter();
    expect(h.animate.mock.calls.map(call=>(call as unknown as [unknown,{delay:number}])[1].delay)).toEqual([0,80,160]);
    expect(STAGGER_MS).toBe(80);
    expect(ENTRANCE_FRAMES[0]).toEqual({opacity:0,transform:"translateY(20px)"});
    expect(RATIO_FRAMES).toEqual([{transform:"scaleX(0)"},{transform:"scaleX(1)"}]);
    expect([...ENTRANCE_FRAMES,...RATIO_FRAMES].every(frame=>Object.keys(frame).every(key=>["opacity","transform"].includes(key)))).toBe(true);
    h.enter();
    expect(h.animate).toHaveBeenCalledTimes(3);
    h.dispose();
  });
  it("never rewinds the headline, result card or ratio already visible at hydration",()=>{
    const h=harness(false,{
      heading:{top:20,bottom:80},card:{top:100,bottom:500},bar:{top:300,bottom:310},
    });
    expect(h.observed).toHaveLength(0);
    // Stale observer delivery must not start an animation either.
    h.enter([h.heading,h.card,h.bar]);
    expect(h.animate).not.toHaveBeenCalled();
    h.dispose();
  });
  it.each([
    {top:799,bottom:899}, // Only one pixel visible: less than the IO threshold.
    {top:-99,bottom:1},
    {top:20,bottom:80,left:374,right:474},
    {top:20,bottom:80,left:-99,right:1},
  ])("treats any partial viewport overlap as already visible: %j",bounds=>{
    const h=harness(false,{heading:bounds});
    expect(h.observed).not.toContain(h.heading);
    h.enter([h.heading]);
    expect(h.animate).not.toHaveBeenCalled();
    h.dispose();
  });
  it("keeps below-fold card reveals and ratio growth, without replaying visible text",()=>{
    const h=harness(false,{heading:{top:20,bottom:80}});
    expect(h.observed).toEqual([h.card,h.bar]);
    h.enter([h.card,h.bar],false);
    expect(h.animate).not.toHaveBeenCalled();
    h.enter([h.card,h.bar]);
    expect(h.animate).toHaveBeenNthCalledWith(1,ENTRANCE_FRAMES,expect.objectContaining({delay:0,duration:420}));
    expect(h.animate).toHaveBeenNthCalledWith(2,RATIO_FRAMES,expect.objectContaining({delay:80,duration:420}));
    h.enter([h.heading,h.card,h.bar]);
    expect(h.animate).toHaveBeenCalledTimes(2);
    h.dispose();
  });
  it("keeps registered below-fold content eligible when a refresh races with scrolling",()=>{
    const h=harness();
    h.setBounds("heading",{top:20,bottom:80});
    h.setBounds("bar",{top:300,bottom:310});
    h.refresh();
    h.enter([h.heading,h.bar]);
    expect(h.animate).toHaveBeenCalledTimes(2);
    h.enter([h.card]);
    expect(h.animate).toHaveBeenCalledTimes(3);
    h.dispose();
  });
  it("does not rewind newly streamed content that is already visible",()=>{
    const h=harness();
    h.stream({top:20,bottom:80});
    expect(h.observed).not.toContain(h.incoming);
    h.enter([h.incoming]);
    expect(h.animate).not.toHaveBeenCalled();
    h.dispose();
  });
  it("does not rewind current viewport content when reduced motion is disabled",()=>{
    const h=harness(true);
    h.setBounds("heading",{top:20,bottom:80});
    h.setBounds("card",{top:100,bottom:500});
    h.setBounds("bar",{top:300,bottom:310});
    h.preference.matches=false;
    h.change();
    h.enter([h.heading,h.card,h.bar]);
    expect(h.observed).toHaveLength(0);
    expect(h.animate).not.toHaveBeenCalled();
    h.dispose();
  });
  it("never starts motion for reduced-motion users, and cancels when preference changes",()=>{
    const reduced=harness(true);
    expect(reduced.observed).toHaveLength(0);
    reduced.dispose();
    const normal=harness();
    normal.enter();
    normal.preference.matches=true;normal.change();
    expect(normal.animations.every(animation=>animation.cancel.mock.calls.length===1)).toBe(true);
    normal.dispose();
  });
  it("cancels active reveals immediately on keyboard focus",()=>{
    const h=harness();h.enter();h.focus();
    expect(h.animations.every(animation=>animation.cancel.mock.calls.length===1)).toBe(true);
    h.dispose();
  });
  it("sets explicit logical ratio origins and Brass Soft focus rings",()=>{
    const css=readFileSync("src/components/foundation/PublicMotion.css","utf8");
    expect(css).toContain('transform-origin: right center');
    expect(css).toContain('transform-origin: left center');
    expect(readFileSync("src/components/foundation/PublicInteractions.css","utf8")).toContain("outline: 2px solid var(--brass-soft)");
  });
});
describe("active-theme browser chrome",()=>{
  it.each(["light","dark",null])("synchronises the restored theme-color after hydration for %s",choice=>{
    let dark=true;let color="";
    runInNewContext(THEME_SCRIPT,{localStorage:{getItem:()=>choice},document:{
      documentElement:{classList:{toggle:(_key:string,on:boolean)=>{dark=on;},contains:()=>dark}},
      querySelector:()=>({setAttribute:(_key:string,value:string)=>{color=value;}}),
    }});
    vi.stubGlobal("document",{
      documentElement:{classList:{contains:()=>dark}},
      querySelector:()=>({setAttribute:(_key:string,value:string)=>{color=value;}}),
    });
    syncThemeColor();
    expect(color).toBe(THEME_COLORS[choice==="light"?"light":"dark"]);
  });
  it("uses the existing palette and adds no new inline script",()=>{
    const css=readFileSync("src/app/globals.css","utf8");
    expect(css).toContain(`--night: ${THEME_COLORS.dark}`);
    expect(css).toContain(`--sand: ${THEME_COLORS.light}`);
    const layout=readFileSync("src/components/foundation/LocaleDocument.tsx","utf8");
    expect(layout).toContain('<meta name="theme-color"');
    expect(layout).not.toContain("dangerouslySetInnerHTML");
  });
});
