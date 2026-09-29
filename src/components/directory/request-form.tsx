"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, SelectField, TextAreaField } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/errors";
import { dayKey, formatDate, formatTime, MODALITY_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";

type Modality = "virtual" | "in_person" | "both";
interface Slot { starts_at: string; modality: Modality }
interface Service { id: string; name: string; modality: Modality; duration_minutes: number }

export function RequestForm({
  action,
  providerId,
  services,
  slotsByDuration,
  offersVirtual,
  offersInPerson,
  timeZone,
  rescheduleOf,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  providerId: string;
  services: Service[];
  slotsByDuration: Record<number, Slot[]>;
  offersVirtual: boolean;
  offersInPerson: boolean;
  timeZone: string;
  rescheduleOf?: string;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((s) => s.id === serviceId);
  const allowed: ("virtual" | "in_person")[] = [
    ...(offersVirtual && (!service || service.modality !== "in_person") ? (["virtual"] as const) : []),
    ...(offersInPerson && (!service || service.modality !== "virtual") ? (["in_person"] as const) : []),
  ];
  const [modality, setModality] = useState<"virtual" | "in_person">(allowed[0] ?? "virtual");
  const effectiveModality = allowed.includes(modality) ? modality : allowed[0];
  const [slot, setSlot] = useState("");

  const days = useMemo(() => {
    const duration = service?.duration_minutes ?? 30;
    const list = (slotsByDuration[duration] ?? []).filter((s) => s.modality === "both" || s.modality === effectiveModality);
    const grouped = new Map<string, Slot[]>();
    for (const s of list) {
      const key = dayKey(s.starts_at, timeZone);
      grouped.set(key, [...(grouped.get(key) ?? []), s]);
    }
    return [...grouped.entries()].slice(0, 10);
  }, [service, slotsByDuration, effectiveModality, timeZone]);

  return (
    <ActionForm action={action} className="space-y-6">
      {(state) => {
        const errors = state && !state.ok ? state.fieldErrors : undefined;
        return (
          <>
            <input type="hidden" name="providerId" value={providerId} />
            {rescheduleOf ? <input type="hidden" name="rescheduleOf" value={rescheduleOf} /> : null}
            {services.length ? (
              <SelectField
                label="Type of appointment"
                name="serviceId"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setSlot("");
                }}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.duration_minutes} min
                  </option>
                ))}
              </SelectField>
            ) : (
              <input type="hidden" name="serviceId" value="" />
            )}

            <fieldset>
              <legend className="text-sm font-semibold text-ink">Visit type</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {allowed.map((m) => (
                  <label
                    key={m}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-line has-[:checked]:bg-brand-700 has-[:checked]:text-white has-[:checked]:ring-brand-700 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500"
                  >
                    <input
                      type="radio"
                      name="modality"
                      value={m}
                      checked={effectiveModality === m}
                      onChange={() => {
                        setModality(m);
                        setSlot("");
                      }}
                      className="sr-only"
                    />
                    {MODALITY_LABEL[m]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-ink">Choose a time</legend>
              <p className="mt-0.5 text-sm text-muted">Times are shown in the provider&apos;s time zone ({timeZone.replace("_", " ")}).</p>
              {errors?.slot ? <p className="mt-1 text-sm font-medium text-red-700">{errors.slot[0]}</p> : null}
              {days.length ? (
                <div className="mt-3 space-y-4">
                  {days.map(([key, slots]) => (
                    <div key={key}>
                      <p className="text-sm font-semibold text-ink">{formatDate(slots[0].starts_at, timeZone)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {slots.map((s) => (
                          <label
                            key={s.starts_at}
                            className={cn(
                              "flex min-h-10 cursor-pointer items-center rounded-xl px-3 text-sm font-medium ring-1 ring-line hover:ring-brand-400",
                              "has-[:checked]:bg-brand-700 has-[:checked]:text-white has-[:checked]:ring-brand-700 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500",
                            )}
                          >
                            <input
                              type="radio"
                              name="slot"
                              value={new Date(s.starts_at).toISOString()}
                              checked={slot === s.starts_at}
                              onChange={() => setSlot(s.starts_at)}
                              className="sr-only"
                            />
                            {formatTime(s.starts_at, timeZone)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <EmptyState title="No open times in the next two weeks" description="Try another visit type or check back later." />
                </div>
              )}
            </fieldset>

            <TextAreaField
              label="Note for the provider (optional)"
              name="note"
              maxLength={1000}
              rows={4}
              hint="Briefly share why you're booking. Only share what you're comfortable with — you can discuss details at your appointment."
              error={errors?.note}
            />

            <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <Checkbox
                name="ack"
                required
                label="I understand this is a request, not a confirmed appointment, and that Kora is not for emergencies."
              />
              {errors?.ack ? <p className="mt-1 text-sm font-medium text-red-700">{errors.ack[0]}</p> : null}
            </div>

            <SubmitButton size="lg" pendingLabel="Sending request…" disabled={!slot}>
              Send request
            </SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
