"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useAppDispatch } from "@/store/hooks";
import { modalOpened } from "@/store/slices/uiSlice";
import { useAuth } from "../hooks/useAuth";
import { logout } from "../thunks";

/** Header pill, Figma "Frame 54" (node 480:584): 12×8 padding, 7px gap, 16px semibold, 24px icon. */
const pill =
  "flex h-10 items-center gap-[7px] rounded-[50px] px-3 text-base leading-5 font-semibold transition-colors disabled:opacity-60";

export function AuthButton() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Reserve the space while the session loads so the header doesn't jump.
  if (isLoading) {
    return <span aria-hidden className="h-10 w-[98px] animate-pulse rounded-[50px] bg-[#fce7f1]" />;
  }

  if (isAuthenticated) {
    return (
      <button
        type="button"
        disabled={isLoggingOut}
        className={cn(pill, "bg-[#fce7f1] text-[#e2136e] hover:bg-[#f9d3e4]")}
        onClick={async () => {
          setIsLoggingOut(true);
          try {
            await dispatch(logout());
          } finally {
            setIsLoggingOut(false);
          }
        }}
      >
        Logout
        <LogOut className="size-5" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(pill, "bg-[#e2136e] text-white hover:bg-[#c70f60]")}
      onClick={() => dispatch(modalOpened({ type: "login" }))}
    >
      Login
      <span className="grid size-6 place-items-center">
        <Image
          src="/images/icons/user-circle.svg"
          alt=""
          aria-hidden
          width={21.5}
          height={21.5}
          unoptimized
        />
      </span>
    </button>
  );
}
