import { useMemo } from "react";
import { sanitizeHtml } from "../lib/sanitize";

// Use this instead of dangerouslySetInnerHTML anywhere HTML comes from the database.
export default function SafeHtml({ html, as: Tag = "div", ...props }) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  return <Tag {...props} dangerouslySetInnerHTML={{ __html: clean }} />;
}
