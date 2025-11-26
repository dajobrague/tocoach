import type { SVGProps } from "react";

export interface IconSvgProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export const TopCoachLogo: React.FC<IconSvgProps> = ({
  size = 32,
  width,
  height,
  ...props
}) => (
  <svg
    fill="none"
    height={size || height}
    viewBox="0 0 32 32"
    width={size || width}
    {...props}
  >
    <defs>
      <linearGradient
        id="topcoach-gradient"
        x1="0%"
        x2="100%"
        y1="0%"
        y2="100%"
      >
        <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.7" />
      </linearGradient>
    </defs>
    {/* TC monogram with coaching whistle design */}
    <path
      d="M8 6h6c3.314 0 6 2.686 6 6v0c0 1.657-.672 3.157-1.757 4.243L16 18.485l-2.243-2.242C12.672 15.157 12 13.657 12 12v0c0-1.105.895-2 2-2h2c1.105 0 2 .895 2 2v2h-2v-2h-2v0c0 1.105.895 2 2 2h0c1.657 0 3.157.672 4.243 1.757L20.485 16l2.242 2.243C23.813 19.328 24.485 20.828 24.485 22.485v0c0 3.314-2.686 6-6 6h-6"
      fill="none"
      stroke="url(#topcoach-gradient)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    {/* Whistle hole */}
    <circle cx="16" cy="12" fill="currentColor" opacity="0.6" r="1.5" />
    {/* Coach emphasis lines */}
    <path
      d="M6 8h2M6 12h2M6 16h2"
      opacity="0.4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
  </svg>
);
