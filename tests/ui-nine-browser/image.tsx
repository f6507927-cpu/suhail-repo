import type { ComponentProps } from "react";
export default function Image({priority,...props}:ComponentProps<"img">&{priority?:boolean}) {
  // The real app uses next/image; this isolated fixture mirrors its priority
  // handling without forwarding a non-HTML boolean attribute.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} fetchPriority={priority?"high":props.fetchPriority} alt={props.alt??""}/>;
}
