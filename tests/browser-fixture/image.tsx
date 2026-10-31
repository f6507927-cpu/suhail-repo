import type { ComponentProps } from "react";
// Same accessible img semantics; Next image optimization is not part of these mocked UI tests.
export default function Image(props:ComponentProps<"img">) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt??""}/>;
}
