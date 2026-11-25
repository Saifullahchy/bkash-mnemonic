"use client";

import { useEffect, useRef } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native <dialog> confirmation (focus trap + ESC for free). */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) dialog.showModal();
    if (!props.open && dialog.open) dialog.close();
  }, [props.open]);

  return (
    <dialog
      ref={ref}
      onClose={props.onCancel}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 shadow-xl"
    >
      {props.open && (
        <div className="p-6">
          <h2 id="confirm-title" className="text-ink text-base font-bold">
            {props.title}
          </h2>
          <p className="text-muted mt-1.5 text-sm">{props.description}</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={props.onCancel} disabled={props.busy}>
              Cancel
            </Button>
            <Button
              variant={props.destructive ? "danger" : "primary"}
              onClick={props.onConfirm}
              disabled={props.busy}
            >
              {props.confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
