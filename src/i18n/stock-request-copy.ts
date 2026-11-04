import { reviewText } from "../components/accounts/types";
const messages={
  request:"Request this stock",
  signIn:"Sign in to request this stock",
  priority:"We add new stocks in order of how often they're requested.",
  requested:"Requested",
  saved:"Request saved. We'll take it into account when we add new stocks.",
  duplicate:"You've already requested this stock.",
  limit:"You've reached the request limit (20).",
  error:"We couldn't send the request. Try again.",
  yourRequests:"Your requests",
  remove:"Remove",
  empty:"You haven't requested any stocks yet.",
} as const;
export function stockRequestText(locale:"ar"|"en",key:keyof typeof messages) {
  return reviewText(locale,messages[key]);
}
