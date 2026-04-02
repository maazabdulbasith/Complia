import { Link } from "react-router";

type BrandMarkProps = {
  to?: string;
  className?: string;
  imageClassName?: string;
  showTagline?: boolean;
};

export default function BrandMark({
  to = "/",
  className = "",
  imageClassName = "h-9 w-9",
  showTagline = false,
}: BrandMarkProps) {
  const content = (
    <div className="flex flex-col">
      <div className="inline-flex items-center gap-2">
        <img
          src="/brand/complia-logo-icon.png"
          alt="Complia"
          className={`shrink-0 object-contain ${imageClassName}`}
        />
        <span className="font-display text-[1.5rem] font-bold leading-none tracking-tight text-slate-900">
          Complia
        </span>
      </div>
      {showTagline && (
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
