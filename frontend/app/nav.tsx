"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { chapters } from "../lib/guides";

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <aside className="sidebar" data-open={open}>
      <button type="button" className="sidebar-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Close menu" : "Menu"}
      </button>
      <nav aria-label="Guides" className="sidebar-nav">
        <a className="sidebar-link" href="/" aria-current={pathname === "/" ? "page" : undefined}>
          Overview
        </a>
        {chapters.map((chapter) => (
          <div className="chapter" key={chapter.title}>
            <p className="chapter-title">{chapter.title}</p>
            {chapter.guides.map((guide) => {
              const href = `/docs/${guide.slug}`;
              return (
                <a
                  key={guide.slug}
                  className="sidebar-link"
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                >
                  {guide.title}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
