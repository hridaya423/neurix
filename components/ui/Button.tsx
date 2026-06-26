import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "magenta";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  tertiary: "btn-ghost",
  magenta: "btn-magenta",
};

const sizeClass: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

function composeClass(
  variant: Variant,
  size: Size,
  block: boolean,
  loading: boolean,
  className?: string,
) {
  return [
    "btn",
    variantClass[variant],
    sizeClass[size],
    block ? "btn-block" : "",
    loading ? "btn-loading" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function Spinner() {
  return (
    <span className="btn-spinner" aria-hidden="true">
      <span />
    </span>
  );
}

type CommonProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
  className?: string;
};

type LinkButtonProps = CommonProps & {
  href: string;
  external?: boolean;
};

type NativeButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;

export function ButtonLink({
  href,
  external,
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  children,
  className,
}: LinkButtonProps) {
  const cls = composeClass(variant, size, block, loading, className);
  const content = (
    <>
      {loading && <Spinner />}
      <span className="btn-label">{children}</span>
    </>
  );

  if (external) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer noopener">
        {content}
      </a>
    );
  }

  return (
    <Link className={cls} href={href}>
      {content}
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: NativeButtonProps) {
  const cls = composeClass(variant, size, block, loading, className);
  return (
    <button
      className={cls}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      <span className="btn-label">{children}</span>
    </button>
  );
}
