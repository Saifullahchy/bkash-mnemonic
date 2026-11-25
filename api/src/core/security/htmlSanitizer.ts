import sanitizeHtml from "sanitize-html";

/**
 * Allowlist for admin-authored rich text (Terms & Conditions). Anything else —
 * scripts, styles, event handlers, iframes, javascript: URLs — is stripped,
 * so the offer site can render the stored HTML safely.
 */
const SAFE_HREF = /^(https?:|mailto:|tel:)/i;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: {
    // Safe links open in a new tab without access to this page. Links with any
    // other scheme (javascript:, data:…) keep their tag but lose all attributes
    // (inert) and are unwrapped below: the link goes, the admin's text stays.
    // (The tag name is not changed here: renaming only some <a> tags makes
    // sanitize-html emit mismatched closing tags.)
    a: (_tag, attribs): sanitizeHtml.Tag => {
      const href = attribs.href ?? "";
      return SAFE_HREF.test(href)
        ? { tagName: "a", attribs: { href, target: "_blank", rel: "noopener noreferrer nofollow" } }
        : { tagName: "a", attribs: {} };
    },
    b: "strong",
    i: "em",
  },
};

export function sanitizeRichText(html: string): string {
  // Attribute-less <a> can only come from the unsafe-link rule above; <a> can't nest.
  return sanitizeHtml(html, OPTIONS)
    .replace(/<a>([\s\S]*?)<\/a>/g, "$1")
    .trim();
}

/** Plain text (for word counts, previews and length checks). */
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Legacy structured sections → HTML (content saved before the rich-text editor). */
export function sectionsToHtml(sections: { heading: string; body: string }[]): string {
  return sections
    .map((s, i) => `<h3>${i + 1}. ${escape(s.heading)}</h3><p>${escape(s.body)}</p>`)
    .join("");
}
