import Image from "next/image";
import type { Surface } from "./shared";

export function BrandMark({
  surface,
  className,
}: {
  surface: Surface;
  className?: string;
}) {
  return (
    <Image
      src={
        surface === "dark"
          ? "/brand/mark-seal-small.svg"
          : "/brand/app-icon.svg"
      }
      width={surface === "dark" ? 24 : 28}
      height={surface === "dark" ? 24 : 28}
      alt=""
      aria-hidden="true"
      className={className}
      priority
    />
  );
}
