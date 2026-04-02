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
  imageClassName = "h-9 w-auto",
  showTagline = false,
}: BrandMarkProps) {
  const content = (
    <>
      <img
        src="/brand/complia-logo.png"
        alt="Complia"
        className={imageClassName}
      />
      {showTagline && (
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
          Notice intelligence
        </p>
      )}
    </>
  );

  return (
    <Link to={to} className={`inline-flex items-center gap-3 ${className}`}>
      {content}
    </Link>
  );
}
