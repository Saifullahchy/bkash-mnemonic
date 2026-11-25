import { CampaignModel } from "../../modules/campaign/campaign.model.js";
import { ParticipantModel } from "../../modules/participant/participant.model.js";
import { ShareEventModel } from "../../modules/shareLink/shareEvent.model.js";
import { ShareLinkModel } from "../../modules/shareLink/shareLink.model.js";
import { LinkOpenModel } from "../../modules/tracking/linkOpen.model.js";

/**
 * Recomputes every denormalised counter from the source-of-truth records:
 *   link.opens  = counted LinkOpens      link.shares = max(counter, ShareEvents)
 *   participant = sums over their links  campaign    = sums over its links
 * Safe to run any time (e.g. after manual data fixes or a migration).
 */
export async function rebuildCounters(): Promise<{
  links: number;
  participants: number;
  campaigns: number;
}> {
  const [openCounts, shareCounts] = await Promise.all([
    LinkOpenModel.aggregate<{ _id: unknown; n: number }>([
      { $match: { counted: true } },
      { $group: { _id: "$shareLinkId", n: { $sum: 1 } } },
    ]),
    ShareEventModel.aggregate<{ _id: unknown; n: number }>([
      { $group: { _id: "$shareLinkId", n: { $sum: 1 } } },
    ]),
  ]);
  const opens = new Map(openCounts.map((r) => [String(r._id), r.n]));
  const shares = new Map(shareCounts.map((r) => [String(r._id), r.n]));

  const links = await ShareLinkModel.find({}, { shares: 1 }).lean().exec();
  if (links.length) {
    await ShareLinkModel.bulkWrite(
      links.map((l) => ({
        updateOne: {
          filter: { _id: l._id },
          update: {
            $set: {
              opens: opens.get(l._id.toString()) ?? 0,
              shares: Math.max(l.shares, shares.get(l._id.toString()) ?? 0),
            },
          },
        },
      })),
    );
  }

  const byParticipant = await ShareLinkModel.aggregate<{
    _id: unknown;
    opens: number;
    shares: number;
    campaignIds: unknown[];
  }>([
    {
      $group: {
        _id: "$participantId",
        opens: { $sum: "$opens" },
        shares: { $sum: "$shares" },
        campaignIds: { $addToSet: "$campaignId" },
      },
    },
  ]);
  await ParticipantModel.updateMany(
    {},
    { $set: { stats: { opens: 0, shares: 0, campaigns: 0 }, campaignIds: [] } },
  );
  if (byParticipant.length) {
    await ParticipantModel.bulkWrite(
      byParticipant.map((p) => ({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: {
              stats: { opens: p.opens, shares: p.shares, campaigns: p.campaignIds.length },
              campaignIds: p.campaignIds,
            },
          },
        },
      })),
    );
  }

  const byCampaign = await ShareLinkModel.aggregate<{
    _id: unknown;
    participants: number;
    opens: number;
    shares: number;
  }>([
    {
      $group: {
        _id: "$campaignId",
        participants: { $sum: 1 },
        opens: { $sum: "$opens" },
        shares: { $sum: "$shares" },
      },
    },
  ]);
  await CampaignModel.updateMany({}, { $set: { stats: { participants: 0, opens: 0, shares: 0 } } });
  if (byCampaign.length) {
    await CampaignModel.bulkWrite(
      byCampaign.map((c) => ({
        updateOne: {
          filter: { _id: c._id },
          update: {
            $set: { stats: { participants: c.participants, opens: c.opens, shares: c.shares } },
          },
        },
      })),
    );
  }

  return { links: links.length, participants: byParticipant.length, campaigns: byCampaign.length };
}
