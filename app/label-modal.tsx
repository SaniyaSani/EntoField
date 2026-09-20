"use client";

import { LabelStudio, type LabelMode } from "@/app/label-studio";
import type { CollectingEvent, SpecimenRecord } from "@/lib/types";

export type { LabelMode } from "@/app/label-studio";

export function LabelModal({
  mode,
  event,
  records,
  onClose,
  onNotice,
}: {
  mode: LabelMode;
  event: CollectingEvent;
  records: SpecimenRecord[];
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  return (
    <LabelStudio
      initialMode={mode}
      scopeId={event.id}
      scopeName={event.name || event.locality || event.id}
      events={[event]}
      records={records}
      onClose={onClose}
      onNotice={onNotice}
    />
  );
}
