"use client";

import { LabelStudio } from "@/app/label-studio";
import type { CollectingEvent, SpecimenRecord } from "@/lib/types";

export function TripCollectionLabelModal({
  tripId,
  tripName,
  events,
  records,
  onClose,
  onNotice,
}: {
  tripId: string;
  tripName: string;
  events: CollectingEvent[];
  records: SpecimenRecord[];
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  return (
    <LabelStudio
      initialMode="both"
      scopeId={tripId}
      scopeName={tripName}
      events={events}
      records={records}
      isTrip
      onClose={onClose}
      onNotice={onNotice}
    />
  );
}
