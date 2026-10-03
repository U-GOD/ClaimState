import type { ReactNode } from "react";
import { Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { headingId, rewriteHref } from "../lib/guides";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return Children.toArray(node).map(textOf).join("");
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => {
            const id = headingId(textOf(children));
            return (
              <h2 id={id}>
                <a className="anchor" href={`#${id}`}>
                  {children}
                </a>
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = headingId(textOf(children));
            return (
              <h3 id={id}>
                <a className="anchor" href={`#${id}`}>
                  {children}
                </a>
              </h3>
            );
          },
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => {
            const next = href === undefined ? undefined : rewriteHref(href);
            const external = next?.startsWith("http") ?? false;
            return (
              <a href={next} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
                {children}
              </a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
