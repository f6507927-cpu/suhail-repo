import "server-only";
import { lazyRuntimeClient } from "./runtime-client";
export const dbPublic = lazyRuntimeClient("DATABASE_URL_PUBLIC");
