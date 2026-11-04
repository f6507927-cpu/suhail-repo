"use client";
import { useEffect } from "react";
import { THEME_COLORS } from "../../lib/theme-script";

export function syncThemeColor() {
  const color=THEME_COLORS[document.documentElement.classList.contains("dark")?"dark":"light"];
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",color);
}
export function ThemeColor() {
  useEffect(()=>{
    // React hydrates hoisted metadata by its content attribute. Updating that
    // attribute in the pre-paint script creates duplicate tags at hydration.
    // Restore the page theme before paint as usual; synchronise browser chrome
    // after hydration and when Next replaces metadata during navigation.
    syncThemeColor();
    const observer=new MutationObserver(syncThemeColor);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
    observer.observe(document.head,{childList:true});
    return ()=>observer.disconnect();
  },[]);
  return null;
}
