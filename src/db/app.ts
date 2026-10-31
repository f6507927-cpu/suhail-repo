import "server-only";
import { lazyRuntimeClient } from "./runtime-client";
export const dbApp = lazyRuntimeClient("DATABASE_URL_APP");
