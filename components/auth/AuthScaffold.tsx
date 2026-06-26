import Link from "next/link";
import type { ReactNode } from "react";

const toneClass = {
  lime: "auth-aside-lime",
  lilac: "auth-aside-lilac",
} as const;

const blocks = [
  { label: "when green flag clicked", cls: "lp-block-hat" },
  { label: "ask AI for a script", cls: "lp-block-lime" },
  { label: "move 10 steps", cls: "lp-block-coral" },
];

export function AuthScaffold({
  tone,
  eyebrow,
  heading,
  lede,
  children,
}: {
  tone: keyof typeof toneClass;
  eyebrow: string;
  heading: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-shell">
      <aside className={`auth-aside ${toneClass[tone]}`}>
        <Link href="/" className="auth-aside-brand">
          <span>Neurix</span>
        </Link>
        <div className="auth-aside-body">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{heading}</h2>
          <p className="auth-aside-lede">{lede}</p>
        </div>
        <div className="auth-snippet" aria-hidden="true">
          <span className="auth-snippet-tape" />
          <div className="auth-snippet-bar">
            <span />
            <span />
            <span />
          </div>
          <div className="auth-snippet-blocks">
            {blocks.map((block) => (
              <span key={block.label} className={`lp-block ${block.cls}`}>
                {block.label}
              </span>
            ))}
          </div>
        </div>
      </aside>
      <section className="auth-main">{children}</section>
    </main>
  );
}
