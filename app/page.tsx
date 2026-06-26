import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  Code2,
  FileDown,
  GripVertical,
  Sparkles,
  Volume2,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import HeroBlocks from "@/components/landing/HeroBlocks";

const inventory = [
  {
    icon: Blocks,
    tone: "card-cream",
    title: "Sprites & costumes",
    body: "Draw, import, and animate sprites with costumes on a stage that runs your scripts.",
  },
  {
    icon: Volume2,
    tone: "card-mint",
    title: "Sound studio",
    body: "Record, trim, and trigger sounds. Each sprite carries its own audio for events and loops.",
  },
  {
    icon: FileDown,
    tone: "card-pink",
    title: "Import & export",
    body: "Open .sb3 projects and export them back out, in a format you already use.",
  },
];

const steps = [
  {
    n: "01",
    title: "Drag blocks together",
    body: "Start from a block palette. Snap events, motion, looks, and logic into working scripts.",
  },
  {
    n: "02",
    title: "Ask the assistant",
    body: "Describe what a sprite should do. Neurix generates the blocks and explains each step.",
  },
  {
    n: "03",
    title: "Run it",
    body: "Press play. A tested compiler and runtime execute your program in the browser.",
  },
];

const faqs: AccordionItem[] = [
  {
    question: "Do I need to know how to code?",
    answer:
      "No. You build with blocks, the same way you would in Scratch. The real-code engine runs underneath, so you grow into it instead of starting from a blank file.",
  },
  {
    question: "Is Neurix free to use?",
    answer:
      "Yes. Create an account and start building for free. Projects save to your account as you work.",
  },
  {
    question: "Can I import my existing Scratch projects?",
    answer:
      "Yes. Import .sb3 files directly. Sprites, costumes, sounds, variables, and scripts come across so you keep the work you have already done.",
  },
  {
    question: "What does the AI assistant do?",
    answer:
      "You describe a behavior and Neurix generates the matching block script, checks it against your project, and can explain each block. It teaches rather than just answering.",
  },
  {
    question: "Where are my projects saved?",
    answer:
      "Projects save to your account automatically, and you can export any project to a standard .sb3 file for a local copy.",
  },
];

export default function Home() {
  return (
    <main className="lp">
      <nav className="lp-nav">
        <Link href="/" className="lp-brand">
          <span>Neurix</span>
        </Link>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="lp-nav-actions">
          <ButtonLink href="/sign-in" variant="tertiary" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/sign-up" size="sm">
            Start building
          </ButtonLink>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>
            Block coding that grows into <span className="lp-hi">real code</span>.
          </h1>
          <p className="lp-hero-lede">
            A block editor for sprites, sounds, and scripts, running on a real
            compiler and runtime. Start the way you would in Scratch, then keep
            going past where the blocks usually stop.
          </p>
          <div className="lp-hero-actions">
            <ButtonLink href="/sign-up" size="lg">
              Start building <ArrowRight size={18} strokeWidth={2.2} />
            </ButtonLink>
            <ButtonLink href="#how" variant="secondary" size="lg">
              How it works
            </ButtonLink>
          </div>
        </div>

        <div className="lp-hero-stage" aria-hidden="true">
          <div className="lp-stage-bar">
            <span />
            <span />
            <span />
          </div>
          <HeroBlocks />
        </div>
      </section>

      <section className="lp-feature" id="features">
        <div className="lp-poster lp-poster-lime">
          <div className="lp-poster-copy">
            <p className="eyebrow">01 / The core</p>
            <h2>A Scratch-compatible core, without the beginner ceiling.</h2>
            <p>
              Sprites, costumes, sounds, variables, lists, watchers, events, and
              full .sb3 import. Start simple, then move toward library-backed
              systems and real runtime behavior.
            </p>
            <ButtonLink href="/sign-up" variant="tertiary" size="md">
              Explore the editor <ArrowRight size={16} strokeWidth={2.2} />
            </ButtonLink>
          </div>
          <div className="lp-poster-art" aria-hidden="true">
            <div className="lp-palette-head">
              <span className="lp-palette-dots">
                <span />
                <span />
                <span />
              </span>
              <span className="lp-palette-label">Palette</span>
            </div>
            <div className="lp-chip lp-chip-1">
              <GripVertical size={16} strokeWidth={2.2} className="lp-chip-grip" />
              <Blocks size={18} strokeWidth={2.2} /> Motion
            </div>
            <div className="lp-chip lp-chip-2">
              <GripVertical size={16} strokeWidth={2.2} className="lp-chip-grip" />
              <Volume2 size={18} strokeWidth={2.2} /> Sound
            </div>
            <div className="lp-chip lp-chip-3">
              <GripVertical size={16} strokeWidth={2.2} className="lp-chip-grip" />
              <Code2 size={18} strokeWidth={2.2} /> Logic
            </div>
            <div className="lp-chip lp-chip-4">
              <GripVertical size={16} strokeWidth={2.2} className="lp-chip-grip" />
              <Sparkles size={18} strokeWidth={2.2} /> Events
            </div>
          </div>
        </div>

      </section>

      <section className="lp-inventory">
        <div className="lp-section-head">
          <p className="eyebrow">02 / What&apos;s inside</p>
          <h2>
            One editor for the whole <span className="lp-hi">creative loop</span>.
          </h2>
        </div>
        <div className="lp-inventory-grid">
          {inventory.map(({ icon: Icon, tone, title, body }) => (
            <article key={title} className={`lp-card ${tone}`}>
              <span className="lp-card-icon">
                <Icon size={22} strokeWidth={2.1} />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-how" id="how">
        <div className="lp-section-head">
          <p className="eyebrow">03 / How it works</p>
          <h2>
            From idea to running program in <span className="lp-hi">three moves</span>.
          </h2>
        </div>
        <ol className="lp-flow">
          {steps.map((step) => (
            <li key={step.n} className="lp-flow-step">
              <span className="lp-flow-n">{step.n}</span>
              <div className="lp-flow-body">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-faq" id="faq">
        <div className="lp-faq-panel">
          <div className="lp-faq-head">
            <p className="eyebrow">04 / FAQ</p>
            <h2>Questions, answered plainly.</h2>
            <p className="lp-faq-sub">
              Anything else? Create an account and the editor walks you through
              it.
            </p>
          </div>
          <Accordion items={faqs} />
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-cta-inner">
          <h2>Build something that actually runs.</h2>
          <p>Open the editor and make your first project.</p>
          <div className="lp-cta-actions">
            <ButtonLink href="/sign-up" size="lg">
              Start building <ArrowRight size={18} strokeWidth={2.2} />
            </ButtonLink>
          </div>
          <p className="lp-cta-note">
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </p>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <span className="lp-wordmark">Neurix</span>
            <p>Block coding that grows into real code.</p>
          </div>
          <div className="lp-footer-cols">
            <div className="lp-footer-col">
              <p className="caption">Product</p>
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="lp-footer-col">
              <p className="caption">Start</p>
              <Link href="/sign-up">Create account</Link>
              <Link href="/sign-in">Sign in</Link>
              <Link href="/dashboard">Open app</Link>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span className="caption">© {new Date().getFullYear()} Neurix</span>
          <span className="caption">A block editor with a real runtime</span>
        </div>
      </footer>
    </main>
  );
}
