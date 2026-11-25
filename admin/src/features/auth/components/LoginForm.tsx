"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { TextField } from "@/components/ui/TextField";
import { getApiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { useLoginMutation } from "../api/authApi";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your admin email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
});
type LoginValues = z.infer<typeof loginSchema>;

/** Only allow same-site relative redirects after login (no open redirects). */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login] = useLoginMutation();
  const [showForgot, setShowForgot] = useState(false);
  const rememberId = useId();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const remember = useWatch({ control, name: "remember" });

  const onSubmit = async (values: LoginValues) => {
    const result = await login(values);
    if ("error" in result) {
      setError("root.server", { message: getApiErrorMessage(result.error) });
      return;
    }
    router.replace(safeNext(searchParams.get("next")));
  };

  const icon = (name: string, size: number) => (
    <Image
      src={`/images/icons/${name}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      unoptimized
    />
  );

  // Figma "Login form" (node 235:514): 420px column, 24px between blocks.
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-6">
      <span className="grid size-14 place-items-center rounded-2xl bg-[#fce7f0]">
        {icon("lock-26", 26)}
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl leading-[normal] font-extrabold text-[#21181c]">Admin sign in</h2>
        <p className="text-sm leading-[21px] text-[#5d5358]">
          Enter your credentials to access the campaign dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <TextField
            label="Username or email"
            type="email"
            autoComplete="username"
            placeholder="admin@mnemonic.com"
            leading={icon("user", 18)}
            error={errors.email?.message}
            {...register("email")}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            leading={icon("lock", 18)}
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor={rememberId}
              className="flex cursor-pointer items-center gap-2 text-[13px] leading-[normal] font-medium text-[#5d5358]"
            >
              <input
                id={rememberId}
                type="checkbox"
                className="peer sr-only"
                {...register("remember")}
              />
              <span
                aria-hidden
                className={cn(
                  "grid size-[18px] place-items-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#e2136e] peer-focus-visible:ring-offset-2",
                  remember ? "border-[#e2136e] bg-[#e2136e]" : "border-[#d7cfd3] bg-white",
                )}
              >
                {remember && icon("check-12", 12)}
              </span>
              Keep me signed in
            </label>
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              className="text-[13px] leading-[normal] font-semibold text-[#e2136e] hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {showForgot && (
            <p className="rounded-lg bg-[#f7f5f6] px-3 py-2 text-xs text-[#5d5358]">
              Ask a super admin to reset your password.
            </p>
          )}
          {errors.root?.server && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {errors.root.server.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[#e2136e] text-[15px] leading-[normal] font-bold text-white drop-shadow-[0_4px_6px_rgb(74_25_48/0.18)] transition-colors hover:bg-[#c70f60] disabled:opacity-70"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="flex items-center justify-center gap-2 text-xs leading-[normal] text-[#8e8589]">
        {icon("shield", 14)}
        Authorized personnel only. All activity is logged.
      </p>
    </div>
  );
}
