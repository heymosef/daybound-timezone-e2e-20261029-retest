import { useId } from "react";
import svgPaths from "./svg-7qxh9mx3rk";
import "./Daybound.css";

export default function Daybound({ className }: { className?: string }) {
  const sunClipId = `daybound-sun-${useId()}`;
  return (
    <div className={`relative ${className || ''}`} data-name="Daybound">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 347.265 68.4717">
        <defs>
          <clipPath id={sunClipId} clipPathUnits="userSpaceOnUse">
            {/* Reuse the sun silhouette so the reveal follows its curved lower edge. */}
            <path d={svgPaths.pa659300} />
          </clipPath>
        </defs>
        <g id="Daybound">
          <g id="Daybound_2">
            <path d={svgPaths.p2a579180} fill="currentColor" />
            <path clipRule="evenodd" d={svgPaths.p19459400} fill="currentColor" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPaths.p3a96b800} fill="currentColor" fillRule="evenodd" />
            <path d={svgPaths.p268ac80} fill="currentColor" />
            <path clipRule="evenodd" d={svgPaths.pc1ff00} fill="currentColor" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPaths.p1c2f42c0} fill="currentColor" fillRule="evenodd" />
            <path d={svgPaths.pbcbf00} fill="currentColor" />
            <g clipPath={`url(#${sunClipId})`}>
              <g className="daybound-sun" data-logo-sun>
                <path d={svgPaths.pa659300} fill="currentColor" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
