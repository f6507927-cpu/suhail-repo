export const palette = {
  night: "#0B2E33",
  "ink-mid": "#14595E",
  brass: "#C08B3E",
  "brass-soft": "#E0BC85",
  canopus: "#E6EFEE",
  sand: "#F5F1E9",
  "sand-deep": "#E3DBCC",
  compliance: "#2E7D5B",
  alert: "#B3462F",
  text: "#14181A",
  muted: "#5C6467",
  line: "#D9D1C2",
  "compliance-dark": "#3FAB7C",
  "alert-dark": "#D9816E",
  "teal-mid-dark": "#26A8B1",
  "muted-dark": "#919A9D",
  "brass-deep": "#88632C",
  "sand-deep-strong": "#998154",
  "header-text": "#9FBAB9",
  "story-text": "#DCE8E7",
  "deep-night": "#061E21",
  "inner-rule": "#EFEAE0",
  white: "#FFFFFF",
} as const;
export function contrast(foreground: string, background: string) {
  function luminance(hex: string) {
    const rgb = hex
      .slice(1)
      .match(/../g)!
      .map((v) => {
        const n = parseInt(v, 16) / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export type ContrastPair = {
  mapping: string;
  foreground: string;
  background: string;
  kind: "text" | "outline" | "divider";
  proposal: boolean;
};
// Each semantic assignment absent from §4.2/4.2a is explicitly a PROPOSAL.
// Surfaces aren't meaningful boundaries by themselves; required outlines are
// separate rows, tested at >=3:1 against BOTH adjacent surfaces.
export const semanticPairs: ContrastPair[] = [
  {
    mapping: "dark background / foreground",
    foreground: palette.canopus,
    background: palette.night,
    kind: "text",
    proposal: false,
  },
  {
    mapping: "light background / foreground",
    foreground: palette.text,
    background: palette.sand,
    kind: "text",
    proposal: false,
  },
  ...["card", "popover", "secondary", "muted-surface"].map((mapping) => ({
    mapping: `dark ${mapping} #061E21 / foreground #E6EFEE`,
    foreground: palette.canopus,
    background: palette["deep-night"],
    kind: "text" as const,
    proposal: true,
  })),
  ...["card", "popover"].map((mapping) => ({
    mapping: `light ${mapping} #FFFFFF / foreground #14181A`,
    foreground: palette.text,
    background: palette.white,
    kind: "text" as const,
    proposal: mapping === "popover",
  })),
  ...["secondary", "muted-surface"].map((mapping) => ({
    mapping: `light ${mapping} #EFEAE0 / foreground #14181A`,
    foreground: palette.text,
    background: palette["inner-rule"],
    kind: "text" as const,
    proposal: true,
  })),
  ...[palette.night, palette["deep-night"]].map((background) => ({
    mapping: "dark muted-foreground #919A9D",
    foreground: palette["muted-dark"],
    background,
    kind: "text" as const,
    proposal: background !== palette.night,
  })),
  ...[palette.sand, palette.white, palette["inner-rule"]].map((background) => ({
    mapping: "light muted-foreground #5C6467",
    foreground: palette.muted,
    background,
    kind: "text" as const,
    proposal: background === palette["inner-rule"],
  })),
  {
    mapping: "dark primary #C08B3E / primary-foreground #0B2E33",
    foreground: palette.night,
    background: palette.brass,
    kind: "text",
    proposal: true,
  },
  {
    mapping: "light primary #0B2E33 / primary-foreground #E6EFEE",
    foreground: palette.canopus,
    background: palette.night,
    kind: "text",
    proposal: true,
  },
  {
    mapping: "dark accent #E0BC85 / accent-foreground #0B2E33",
    foreground: palette.night,
    background: palette["brass-soft"],
    kind: "text",
    proposal: true,
  },
  {
    mapping: "light accent #88632C / accent-foreground #FFFFFF",
    foreground: palette.white,
    background: palette["brass-deep"],
    kind: "text",
    proposal: true,
  },
  ...[palette.night, palette["deep-night"]].map((background) => ({
    mapping: "dark border / input / ring #919A9D",
    foreground: palette["muted-dark"],
    background,
    kind: "outline" as const,
    proposal: true,
  })),
  ...[palette.sand, palette.white, palette["inner-rule"]].map((background) => ({
    mapping: "light border / input #998154",
    foreground: palette["sand-deep-strong"],
    background,
    kind: "outline" as const,
    proposal: background === palette["inner-rule"],
  })),
  ...[palette.sand, palette.white, palette["sand-deep"]].map((background) => ({
    mapping: "light ring #88632C",
    foreground: palette["brass-deep"],
    background,
    kind: "outline" as const,
    proposal: true,
  })),
  {
    mapping: "dark destructive #E6EFEE / destructive-foreground #0B2E33",
    foreground: palette.night,
    background: palette.canopus,
    kind: "text",
    proposal: true,
  },
  {
    mapping: "light destructive #14181A / destructive-foreground #FFFFFF",
    foreground: palette.white,
    background: palette.text,
    kind: "text",
    proposal: true,
  },
  {
    mapping: "dark decorative divider #14595E",
    foreground: palette["ink-mid"],
    background: palette.night,
    kind: "divider",
    proposal: true,
  },
  {
    mapping: "light decorative divider #D9D1C2",
    foreground: palette.line,
    background: palette.sand,
    kind: "divider",
    proposal: false,
  },
  {
    mapping: "dark card adjacent to page (outline required)",
    foreground: palette["deep-night"],
    background: palette.night,
    kind: "divider",
    proposal: true,
  },
  {
    mapping: "light card adjacent to page (outline required)",
    foreground: palette.white,
    background: palette.sand,
    kind: "divider",
    proposal: false,
  },
  ...[palette.night, palette["deep-night"]].flatMap((background) => [
    {
      mapping: "dark brass byline / emphasis / seal #C08B3E",
      foreground: palette.brass,
      background,
      kind: "text" as const,
      proposal: background !== palette.night,
    },
    {
      mapping: "dark price up #26A8B1",
      foreground: palette["teal-mid-dark"],
      background,
      kind: "text" as const,
      proposal: background !== palette.night,
    },
    {
      mapping: "dark price down / system error #E6EFEE",
      foreground: palette.canopus,
      background,
      kind: "text" as const,
      proposal: background !== palette.night,
    },
  ]),
  ...[palette.sand, palette.white].flatMap((background) => [
    {
      mapping: "light brass byline / emphasis / seal #88632C",
      foreground: palette["brass-deep"],
      background,
      kind: "text" as const,
      proposal: false,
    },
    {
      mapping: "light price up #14595E",
      foreground: palette["ink-mid"],
      background,
      kind: "text" as const,
      proposal: false,
    },
    {
      mapping: "light price down #0B2E33",
      foreground: palette.night,
      background,
      kind: "text" as const,
      proposal: false,
    },
    {
      mapping: "light system error #14181A",
      foreground: palette.text,
      background,
      kind: "text" as const,
      proposal: false,
    },
  ]),
  ...[
    ["light pass", palette.white, palette.compliance],
    ["light fail", palette.white, palette.alert],
    ["light review on Sand", palette.alert, palette.sand],
    ["light review on white", palette.alert, palette.white],
    ["light insufficient on Sand", palette.muted, palette.sand],
    ["light insufficient on white", palette.muted, palette.white],
    ["dark pass", palette.night, palette["compliance-dark"]],
    ["dark fail", palette.night, palette["alert-dark"]],
    ["dark review", palette["alert-dark"], palette.night],
    ["dark insufficient", palette["muted-dark"], palette.night],
    ["header Arabic name", palette["brass-soft"], palette.night],
    ["header secondary text", palette["header-text"], palette.night],
  ].map(([mapping, foreground, background]) => ({
    mapping,
    foreground,
    background,
    kind: "text" as const,
    proposal: false,
  })),
];
