"use client";

import { useCallback, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { PhoneLoginModal } from "@/features/auth/components/PhoneLoginModal";
import { OfferDetailsModal } from "@/features/offers/components/OfferDetailsModal";
import type { Offer } from "@/features/offers/types";
import { ShareLinkModal } from "@/features/share/components/ShareLinkModal";
import { TermsModal } from "@/features/terms/components/TermsModal";
import type { Terms } from "@/features/terms/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { modalClosed } from "@/store/slices/uiSlice";

const TITLE_ID = "active-modal-title";

interface ModalRootProps {
  offers: Offer[];
  terms: Terms | null;
}

/**
 * Renders whichever modal is active in the UI slice. Centralising this keeps
 * feature components free of modal plumbing and guarantees one modal at a time.
 */
export function ModalRoot({ offers, terms }: ModalRootProps) {
  const dispatch = useAppDispatch();
  const modal = useAppSelector((state) => state.ui.modal);
  const close = useCallback(() => dispatch(modalClosed()), [dispatch]);

  const findOffer = (id: string) => offers.find((offer) => offer.id === id);

  let content: ReactNode = null;
  switch (modal?.type) {
    case "login":
      content = <PhoneLoginModal titleId={TITLE_ID} onClose={close} />;
      break;
    case "share": {
      const offer = findOffer(modal.campaignId);
      if (offer) content = <ShareLinkModal titleId={TITLE_ID} offer={offer} onClose={close} />;
      break;
    }
    case "offerDetails": {
      const offer = findOffer(modal.campaignId);
      if (offer) content = <OfferDetailsModal titleId={TITLE_ID} offer={offer} onClose={close} />;
      break;
    }
    case "terms":
      content = <TermsModal titleId={TITLE_ID} terms={terms} onClose={close} />;
      break;
  }

  return (
    <Modal
      // key remounts content when switching modals (e.g. login -> share)
      key={modal?.type ?? "none"}
      open={content !== null}
      onClose={close}
      labelledBy={TITLE_ID}
      // Figma's share-link card is 358px wide (8.5px sides); the other popups are 343px.
      className={modal?.type === "share" ? "w-[calc(100%-17px)] max-w-[358px]" : undefined}
    >
      {content}
    </Modal>
  );
}
