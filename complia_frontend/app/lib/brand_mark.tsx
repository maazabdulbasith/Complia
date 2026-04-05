import { Link } from "react-router";

type BrandMarkProps = {
  to?: string;
  className?: string;
  imageClassName?: string;
  variant?: "full" | "icon";
  showTagline?: boolean;
};

export default function BrandMark({
  to = "/",
  className = "",
  imageClassName,
  variant = "full",
  showTagline = false,
}: BrandMarkProps) {
  const logoSrc = variant === "icon" ? "/brand/complia-logo-icon.png" : "/brand/complia-logo-wordmark.png";
  const computedImageClassName = imageClassName ?? (variant === "icon" ? "h-9 w-9" : "h-8 w-auto sm:h-9");

  const content = (
    <div className="flex flex-col">
      <img
        src={logoSrc}
        alt="Complia"
        className={`shrink-0 object-contain ${computedImageClassName}`}
      />
      {showTagline && variant === "icon" && (
        <p className="pl-0.5 pt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
          Notice intelligence
        </p>
      )}
    </div>
  );

  return (
    <Link to={to} className={`inline-flex items-center ${className}`}>
      {content}
    </Link>
  );
}
