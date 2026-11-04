import "../search-browser/setup";
import { cliConnection } from "../../scripts/db/connection";
// Loopback TEST-only fixture selection, never a live editorial activation.
if(process.env.NODE_ENV!=="test")throw new Error("Homepage fixture setup is test-only");
const db=cliConnection("DATABASE_URL_TEST");
try {
  await db`update app.editorial_setting set featured_security_id=(select id from app.security where slug='demo-fixa') where setting_key='editorial'`;
} finally {await db.end();}
