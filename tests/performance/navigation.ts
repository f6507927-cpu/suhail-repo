export function redirect(path: string): never { throw new Error(`REDIRECT:${path}`); }
export function forbidden(): never { throw new Error("FORBIDDEN:403"); }
export function notFound(): never { throw new Error("NOT_FOUND"); }
