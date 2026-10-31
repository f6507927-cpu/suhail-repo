// D-22/D-40: fixed source mirrored in public/theme-restore.js; the foundation
// regression checks byte equality. Root-owned async resource blocks rendering,
// independently of the Next bootstrap. Only private documents supply a nonce.
// No request nonce, cookie, system-theme detection or server personalization.
export const THEME_SCRIPT =
  'try{var t=localStorage.getItem("suhail-theme");if(t==="light"||t==="dark"){document.documentElement.classList.toggle("dark",t==="dark")}}catch{}';
