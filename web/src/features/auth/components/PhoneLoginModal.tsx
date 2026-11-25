"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ModalCloseButton } from "@/components/ui/Modal";
import { getApiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { PHONE_COUNTRY_CODE } from "@/lib/constants";
import { useAppDispatch } from "@/store/hooks";
import { modalOpened } from "@/store/slices/uiSlice";
import { useLoginWithPhoneMutation } from "../api/authApi";
import { phoneLoginSchema, type PhoneLoginInput, type PhoneLoginValues } from "../schemas";
import { completeLogin } from "../thunks";

interface PhoneLoginModalProps {
  titleId: string;
  onClose: () => void;
}

export function PhoneLoginModal({ titleId, onClose }: PhoneLoginModalProps) {
  const dispatch = useAppDispatch();
  const phoneId = useId();
  const termsId = useId();

  const [loginWithPhone] = useLoginWithPhoneMutation();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PhoneLoginInput, unknown, PhoneLoginValues>({
    resolver: zodResolver(phoneLoginSchema),
    defaultValues: { phone: "", acceptedTerms: false },
  });

  const accepted = useWatch({ control, name: "acceptedTerms" });

  const onSubmit = async ({ phone }: PhoneLoginValues) => {
    const result = await loginWithPhone({ phone });
    if ("error" in result) {
      setError("root.server", { message: getApiErrorMessage(result.error) });
      return;
    }
    if (result.data.participant) dispatch(completeLogin(result.data.participant));
  };

  return (
    // Figma "Bottom sheet" (node 233:661)
    <div className="flex flex-col gap-4 rounded-[20px] bg-white px-4 pt-8 pb-6 shadow-[0_6px_18px_-6px_rgb(74_25_48/0.08)]">
      <ModalCloseButton onClick={onClose} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
        <div className="flex flex-col gap-5">
          {/* Verification heading */}
          <div className="flex items-center gap-2.5">
            <span className="grid size-[55px] shrink-0 place-items-center rounded-lg bg-[#fce7f1]">
              <Image
                src="/images/icons/smartphone.svg"
                alt=""
                aria-hidden
                width={37}
                height={37}
                unoptimized
              />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <h2 id={titleId} className="text-[17px] leading-[21px] font-semibold text-[#21181c]">
                Get your offer link
              </h2>
              <p className="text-xs leading-[1.4] text-[#5d5358]">
                Enter your mobile number to generate your personal offer link.
              </p>
            </div>
          </div>

          {/* Mobile input */}
          <div>
            <label htmlFor={phoneId} className="sr-only">
              Mobile number
            </label>
            <div
              className={cn(
                "flex h-12 items-center gap-[9px] overflow-hidden rounded-xl border border-[#eae3e6] bg-[#f7f5f6] px-[13px] transition-colors focus-within:border-[#e2136e]",
                errors.phone && "border-red-500 focus-within:border-red-500",
              )}
            >
              <span className="text-sm leading-[normal] font-extrabold text-[#21181c]">
                {PHONE_COUNTRY_CODE}
              </span>
              <span aria-hidden className="h-[22px] w-px shrink-0 bg-[#eae3e6]" />
              <input
                id={phoneId}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="01XXXXXXXXX"
                maxLength={14}
                autoFocus
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
                className="h-full min-w-0 flex-1 bg-transparent text-sm leading-[normal] text-[#21181c] outline-none placeholder:text-[#8e8589]"
                {...register("phone")}
              />
            </div>
            {errors.phone && (
              <p id={`${phoneId}-error`} role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.phone.message}
              </p>
            )}
          </div>
        </div>

        {errors.root?.server && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {errors.root.server.message}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {/* Primary CTA */}
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#e2136e] px-4 text-sm leading-[normal] font-bold text-white shadow-[0_6px_18px_-6px_rgb(74_25_48/0.08)] transition-colors hover:bg-[#c70f60] disabled:opacity-70"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isSubmitting ? "Getting your link…" : "Continue"}
          </button>

          {/* Agreement */}
          <div>
            <label
              htmlFor={termsId}
              className="flex cursor-pointer items-center gap-1 text-[10px] leading-[normal] text-[#333]"
            >
              <input
                id={termsId}
                type="checkbox"
                // The label also contains a button, so name the checkbox explicitly.
                aria-label="I agree to the Terms & Conditions and Privacy Policy"
                className="peer sr-only"
                {...register("acceptedTerms")}
              />
              <CheckCircle checked={accepted} />
              <span>
                I agree to the{" "}
                <button
                  type="button"
                  className="font-semibold text-[#e2136e] underline"
                  onClick={() =>
                    dispatch(modalOpened({ type: "terms", returnTo: { type: "login" } }))
                  }
                >
                  Terms &amp; Conditions
                </button>{" "}
                and <span className="font-semibold text-[#e2136e] underline">Privacy Policy.</span>
              </span>
            </label>
            {errors.acceptedTerms && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.acceptedTerms.message}
              </p>
            )}
          </div>
        </div>

        {/* Verification copy */}
        <p className="text-[10px] leading-[1.4] font-medium text-[#5d5358] italic">
          Your number is only used to generate your personal sharing link.
        </p>
      </form>
    </div>
  );
}

/** Figma agreement icon (node 233:678): circle with a tick; the tick shows once agreed. */
function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 rounded-full text-black peer-focus-visible:ring-2 peer-focus-visible:ring-[#e2136e]"
      stroke="currentColor"
      strokeMiterlimit={10}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15.375 8C15.375 12.073 12.073 15.375 8 15.375C3.927 15.375.625 12.073.625 8C.625 3.927 3.927.625 8 .625C12.073.625 15.375 3.927 15.375 8Z" />
      {checked && <path d="M11.0945 5.90357L6.90154 10.0965L4.90552 8.1005" />}
    </svg>
  );
}
