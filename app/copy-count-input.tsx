"use client";

import { useState } from "react";
import { MAX_LABEL_COPIES, normalizeLabelCopies } from "@/lib/label-studio-options";

/** Keep keystrokes local: label jobs and PDF generation only see committed counts. */
export function CopyCountInput({ value, disabled, onCommit, onEditingChange }: {
  value: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      enterKeyHint="done"
      aria-label="Copies"
      title={`1–${MAX_LABEL_COPIES} copies; applied when you leave this field`}
      value={editing ? draft : String(value)}
      disabled={disabled}
      onFocus={(event) => {
        setDraft(String(value));
        setEditing(true);
        onEditingChange(true);
        event.currentTarget.select();
      }}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
      onBlur={(event) => {
        onCommit(normalizeLabelCopies(event.currentTarget.value));
        setEditing(false);
        onEditingChange(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
