"use client";

import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { MaskIcon } from "./MaskIcon";

/**
 * Admin form controls — Figma "Input" (Admin Panel, e.g. node 235:525):
 * 48px tall, #f7f5f6 fill, 1px #eae3e6 border, 12px radius, 14px horizontal
 * padding, 10px gap, 14px medium #21181c text, 18px #8e8589 icons.
 * The box is a wrapper so icons sit inside it; focus is shown on the wrapper.
 */
export const fieldBox =
  "relative flex w-full items-center gap-2.5 rounded-xl border border-[#eae3e6] bg-[#f7f5f6] px-3.5 text-sm font-medium text-[#21181c] transition-[border-color,box-shadow,background-color] focus-within:border-[#e2136e] focus-within:bg-white focus-within:shadow-[0_0_0_3px_#fce7f0] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[[aria-invalid=true]]:border-red-400";

const control =
  "min-w-0 flex-1 bg-transparent leading-[normal] outline-none placeholder:font-normal placeholder:text-[#8e8589] disabled:cursor-not-allowed";

/** Icons inside the box: 18px, #8e8589, 1.5 stroke (Figma icon set). */
const iconSlot = "flex shrink-0 text-[#8e8589] [&>svg]:size-[18px] [&>svg]:stroke-[1.5]";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Classes for the outer box (width, height overrides…). */
  boxClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leading, trailing, className, boxClassName, ...props },
  ref,
) {
  return (
    <div className={cn(fieldBox, "h-12", boxClassName)}>
      {leading && (
        <span aria-hidden className={cn(iconSlot, "pointer-events-none")}>
          {leading}
        </span>
      )}
      <input ref={ref} className={cn(control, "h-full", className)} {...props} />
      {trailing && <span className={iconSlot}>{trailing}</span>}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  boxClassName?: string;
}

/** Figma "Offer description": 96px tall, 14px padding all round, 22px line height. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, boxClassName, ...props },
  ref,
) {
  return (
    <div className={cn(fieldBox, "items-start p-3.5", boxClassName)}>
      <textarea
        ref={ref}
        className={cn(control, "min-h-[66px] resize-y leading-[22px]", className)}
        {...props}
      />
    </div>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  leading?: ReactNode;
  boxClassName?: string;
}

interface Choice {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Plain text of an <option>'s children ("{name} offer" → "Bkash offer"). */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function choicesFrom(children: ReactNode): Choice[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) return [];
    if (child.type !== "option") return [];
    const label = textOf(child.props.children);
    return [
      {
        value: String(child.props.value ?? label),
        label,
        disabled: child.props.disabled,
      },
    ];
  });
}

/**
 * Custom dropdown in the Figma field box: a button showing the choice and a
 * styled list (pink highlight + check on the chosen one) instead of the OS menu.
 * A hidden native <select> keeps forms, refs and `onChange(e.target.value)`
 * working exactly as before; children are still plain <option> elements.
 * Keyboard: ↑/↓, Home/End, Enter/Space to choose, Esc/Tab to close.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, boxClassName, leading, children, id, disabled, value, defaultValue, ...props },
  ref,
) {
  const choices = choicesFrom(children);
  const nativeRef = useRef<HTMLSelectElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Uncontrolled selects (react-hook-form register) keep their value in the DOM.
  const [domValue, setDomValue] = useState<string>(
    defaultValue === undefined ? (choices[0]?.value ?? "") : String(defaultValue),
  );
  const current = value === undefined ? domValue : String(value);
  const selected = choices.find((c) => c.value === current) ?? choices[0];

  const setRefs = useCallback(
    (el: HTMLSelectElement | null) => {
      nativeRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  useEffect(() => {
    if (nativeRef.current) setDomValue(nativeRef.current.value);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    if (disabled) return;
    setActive(Math.max(0, choices.indexOf(selected!)));
    setOpen(true);
  };

  const choose = (choice: Choice) => {
    setOpen(false);
    const el = nativeRef.current;
    if (!el || choice.disabled || choice.value === current) return;
    el.value = choice.value;
    setDomValue(choice.value);
    // Fires the caller's onChange (and react-hook-form's) like a real pick.
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const move = (from: number, step: 1 | -1) => {
    let i = from;
    for (let n = 0; n < choices.length; n++) {
      i = (i + step + choices.length) % choices.length;
      if (!choices[i]!.disabled) return i;
    }
    return from;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => move(i, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => move(i, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(move(choices.length - 1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(move(0, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (choices[active]) choose(choices[active]);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn(fieldBox, "h-12", open && "border-[#e2136e] bg-white", boxClassName)}
    >
      <button
        type="button"
        id={id}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={props["aria-invalid"]}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-[inherit] text-left outline-none disabled:cursor-not-allowed"
      >
        {leading && (
          <span aria-hidden className={iconSlot}>
            {leading}
          </span>
        )}
        <span className={cn("min-w-0 flex-1 truncate leading-[normal]", className)}>
          {selected?.label}
        </span>
        <MaskIcon
          src="/images/icons/chevron-down.svg"
          size={18}
          className={cn(
            "shrink-0 text-[#8e8589] transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      <select
        ref={setRefs}
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={value}
        defaultValue={defaultValue}
        className="sr-only"
        {...props}
      >
        {children}
      </select>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="scrollbar-pink border-line shadow-card absolute top-full left-0 z-40 mt-1.5 max-h-72 w-max min-w-full overflow-y-auto rounded-xl border bg-white p-1 shadow-[0_12px_24px_rgb(74_25_48/0.12)]"
        >
          {choices.map((c, i) => {
            const isSelected = c.value === selected?.value;
            return (
              <li
                key={c.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={c.disabled}
                onPointerEnter={() => !c.disabled && setActive(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  // Stops a wrapping <label> from re-clicking the trigger.
                  e.preventDefault();
                  choose(c);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm leading-[normal] whitespace-nowrap",
                  isSelected ? "font-semibold text-[#b70d57]" : "font-medium text-[#21181c]",
                  i === active && (isSelected ? "bg-[#fce7f0]" : "bg-[#f7f5f6]"),
                  isSelected && i !== active && "bg-[#fce7f0]/60",
                  c.disabled && "cursor-not-allowed opacity-40",
                )}
              >
                {c.label}
                {isSelected && (
                  <MaskIcon src="/images/icons/check-16.svg" size={16} className="text-[#e2136e]" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
