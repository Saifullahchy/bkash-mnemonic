/** "https://offer-finder.com/s/Ab3xK9pQ" -> "offer-finder.com/s/Ab3xK9pQ" for compact display. */
export function toDisplayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
