import { isbot } from "isbot";

/**
 * Link-preview fetchers that unfurl shared URLs. Most are already covered by
 * `isbot`; listed explicitly because a preview must NEVER count as a friend's open.
 */
const PREVIEW_CRAWLERS =
  /facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|skypeuripreview|viber|line\/|kakaotalk|snapchat|pinterest|embedly|googlebot|bingbot|applebot|yandex|baiduspider|duckduckbot/i;

/** Headless browsers and HTTP libraries commonly used by scripts. */
const AUTOMATION =
  /headlesschrome|phantomjs|puppeteer|playwright|selenium|curl\/|wget\/|python-requests|axios\/|node-fetch|go-http-client|okhttp|java\//i;

export function isBotUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 10) return true;
  return isbot(userAgent) || PREVIEW_CRAWLERS.test(userAgent) || AUTOMATION.test(userAgent);
}
