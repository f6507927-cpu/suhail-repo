import Image from "next/image";
import type { Surface } from "./shared";

type ScreeningStatus =
  | "passes_selected_methodology"
  | "requires_review"
  | "fails_selected_methodology"
  | "insufficient_data";

const sealPoints =
  "50.000,2.000 59.184,27.827 75.456,24.544 72.173,40.816 98.000,50.000 72.173,59.184 75.456,75.456 59.184,72.173 50.000,98.000 40.816,72.173 24.544,75.456 27.827,59.184 2.000,50.000 27.827,40.816 24.544,24.544 40.816,27.827";

export function CoverageSeal({
  covered,
  status,
  surface,
  className,
}: {
  covered: boolean;
  status: ScreeningStatus;
  surface: Surface;
  className?: string;
}) {
  // D-37: coverage is not implied by a passing screen; require both facts.
  if (!covered || status !== "passes_selected_methodology") return null;

  return surface === "dark" ? (
    <Image
      src="/brand/mark-seal-small.svg"
      width={24}
      height={24}
      alt=""
      aria-hidden="true"
      className={className}
    />
  ) : (
    <svg
      viewBox="0 0 100 100"
      width="24"
      height="24"
      aria-hidden="true"
      className={className}
    >
      <polygon points={sealPoints} fill="#88632C" />
    </svg>
  );
}
