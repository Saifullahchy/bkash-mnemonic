import type { ShareLinkRecord } from "./shareLink.model.js";

export interface ShareLinkDto {
  campaignId: string;
  code: string;
  /** Full URL to share, e.g. https://offer-finder.com/s/Ab3xK9pQ */
  url: string;
  opens: number;
  shares: number;
}

export interface ActivityItemDto {
  campaignId: string;
  /** e.g. "Foodi offer" */
  label: string;
  opens: number;
  shares: number;
  link: { code: string; url: string } | null;
}

export function shareUrl(siteUrl: string, code: string): string {
  return new URL(`/s/${code}`, siteUrl).toString();
}

export function toShareLinkDto(link: ShareLinkRecord, siteUrl: string): ShareLinkDto {
  return {
    campaignId: link.campaignId.toString(),
    code: link.code,
    url: shareUrl(siteUrl, link.code),
    opens: link.opens,
    shares: link.shares,
  };
}
