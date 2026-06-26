"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";

export type AccordionItem = {
  question: string;
  answer: string;
};

function AccordionRow({
  item,
  open,
  onToggle,
}: {
  item: AccordionItem;
  open: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;

  return (
    <div className={`faq-row${open ? " faq-row-open" : ""}`}>
      <h3 className="faq-row-heading">
        <button
          id={buttonId}
          type="button"
          className="faq-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{item.question}</span>
          <span className="faq-icon" aria-hidden="true">
            <Plus size={20} strokeWidth={2} />
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="faq-panel"
        hidden={!open}
      >
        <p>{item.answer}</p>
      </div>
    </div>
  );
}

export function Accordion({
  items,
  defaultOpen = 0,
}: {
  items: AccordionItem[];
  defaultOpen?: number | null;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpen);

  return (
    <div className="faq-list">
      {items.map((item, index) => (
        <AccordionRow
          key={item.question}
          item={item}
          open={openIndex === index}
          onToggle={() => setOpenIndex(openIndex === index ? null : index)}
        />
      ))}
    </div>
  );
}
