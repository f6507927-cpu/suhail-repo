/** D-153: default-off rollout gate, independent of key presence. Enable only
 * after separately authorized application and verification of migration 0013.
 * No schema probing, database access or provider activation is done here.
 */
export function apiNinjasStorageReady() {
  return process.env.API_NINJAS_STORAGE_READY === "1";
}
