// Route segment config must be declared literally in each route file; Next.js
// cannot read re-exported `revalidate`/`dynamic`. Keep in step with opengraph-image.tsx.
export const revalidate = 900;
export const dynamic = "force-static";
export { default, size, contentType, alt, generateStaticParams } from "./opengraph-image";
