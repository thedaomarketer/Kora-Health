import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Fieldset, SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { COUNTRIES, LANGUAGES, PAYMENT_OPTIONS } from "@/lib/constants";
import type { ReferenceData } from "@/lib/directory";
import type { OwnProviderProfile, PatientProfile } from "@/lib/profiles";
import { savePatientProfileAction, saveProviderProfileAction } from "@/app/onboarding/actions";

function CheckboxGrid({ name, options, selected }: { name: string; options: [string, string][]; selected: string[] }) {
  return (
    <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {options.map(([value, label]) => (
        <Checkbox key={value} name={name} value={value} label={label} defaultChecked={selected.includes(value)} />
      ))}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line/70 pt-8 first:border-0 first:pt-0 lg:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function PatientProfileForm({
  profile,
  reference,
  mode,
}: {
  profile: PatientProfile;
  reference: ReferenceData;
  mode: "onboarding" | "settings";
}) {
  return (
    <ActionForm action={savePatientProfileAction} className="space-y-8">
      <input type="hidden" name="mode" value={mode} />
      <Section title="About you" description="Providers you contact see your name.">
        <TextField label="Your name" name="displayName" defaultValue={profile.display_name} required autoComplete="name" />
        <TextField label="Pronouns (optional)" name="pronouns" defaultValue={profile.pronouns ?? ""} placeholder="e.g. she/her" />
      </Section>
      <Section title="Location" description="Used to show providers near you. City level is enough.">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="City" name="city" defaultValue={profile.city ?? ""} autoComplete="address-level2" />
          <TextField label="Province / state" name="region" defaultValue={profile.region ?? ""} autoComplete="address-level1" />
          <SelectField label="Country" name="country" defaultValue={profile.country ?? ""}>
            <option value="">Select…</option>
            {Object.entries(COUNTRIES).map(([c, n]) => (
              <option key={c} value={c}>{n}</option>
            ))}
          </SelectField>
        </div>
      </Section>
      <Section title="Care preferences" description="Helps Kora suggest relevant providers. You can change these any time.">
        <Fieldset legend="Languages you'd like care in">
          <CheckboxGrid name="languages" options={Object.entries(LANGUAGES)} selected={profile.preferred_languages} />
        </Fieldset>
        <SelectField label="Type of care you prefer" name="carePreference" defaultValue={profile.care_modality_preference}>
          <option value="both">Virtual or in person</option>
          <option value="virtual">Virtual</option>
          <option value="in_person">In person</option>
        </SelectField>
        <Fieldset legend="Areas of health you're interested in (optional)">
          <CheckboxGrid name="specialties" options={reference.specialties.map((s) => [s.slug, s.name])} selected={profile.specialty_interests} />
        </Fieldset>
      </Section>
      <Section title="Insurance & payment" description="Optional. Used only to filter providers.">
        <Fieldset legend="How you'd like to pay for care">
          <CheckboxGrid name="payment" options={Object.entries(PAYMENT_OPTIONS)} selected={profile.payment_preferences} />
        </Fieldset>
        <TextField label="Insurance notes (optional)" name="insuranceNote" defaultValue={profile.insurance_note ?? ""} hint="Avoid entering policy or member numbers." maxLength={300} />
      </Section>
      {mode === "onboarding" ? (
        <Section title="Privacy choices" description="Each is optional and can be changed later in Settings.">
          <Checkbox
            name="consentAi"
            label="Use Kora AI"
            description="Allow the messages you send to Kora AI to be processed by our AI service provider to generate responses, and stored so you can revisit conversations."
          />
          <Checkbox
            name="consentHealth"
            label="Store my health information"
            description="Allow Kora to store health information you choose to enter (e.g. allergies, medications). Only you can see it."
          />
          <Checkbox
            name="consentMatching"
            label="Personalize provider suggestions"
            description="Use my saved preferences (location, languages, care type, interests) to suggest providers. Kora never uses race or ethnicity for matching."
          />
        </Section>
      ) : null}
      <div className="flex justify-end border-t border-line/70 pt-6">
        <SubmitButton size="lg">{mode === "onboarding" ? "Finish setup" : "Save changes"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ProviderProfileForm({
  profile,
  reference,
  mode,
  defaultName,
}: {
  profile: OwnProviderProfile | null;
  reference: ReferenceData;
  mode: "onboarding" | "settings";
  defaultName: string;
}) {
  const primary = profile?.specialties.find((s) => s.primary)?.slug;
  const location = profile?.location_list[0];
  return (
    <ActionForm action={saveProviderProfileAction} className="space-y-8">
      <input type="hidden" name="mode" value={mode} />
      <Section title="Professional identity" description="This is shown publicly on your profile.">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <SelectField label="Title" name="honorific" defaultValue={profile?.honorific ?? ""}>
            <option value="">None</option>
            <option value="Dr.">Dr.</option>
            <option value="Prof.">Prof.</option>
          </SelectField>
          <TextField label="Name shown to patients" name="displayName" defaultValue={profile?.display_name ?? defaultName} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Credentials after name (optional)" name="postNominals" defaultValue={profile?.post_nominals ?? ""} placeholder="e.g. MD, CCFP" hint="Self-reported. Verification is shown separately." />
          <TextField label="Pronouns (optional)" name="pronouns" defaultValue={profile?.pronouns ?? ""} />
        </div>
        <SelectField label="Profession" name="profession" required defaultValue={reference.professions.find((p) => p.name === profile?.profession)?.slug ?? ""}>
          <option value="" disabled>Choose your profession</option>
          {reference.professions.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </SelectField>
        <TextField label="Headline (optional)" name="headline" defaultValue={profile?.headline ?? ""} maxLength={160} placeholder="e.g. Family physician focused on preventive care" />
        <TextAreaField label="About you (optional)" name="bio" defaultValue={profile?.bio ?? ""} maxLength={3000} rows={6} hint="Describe your approach and experience. Don't make claims about outcomes you can't substantiate." />
      </Section>
      <Section title="Specialties" description="Choose up to 8. The primary specialty appears first.">
        <Fieldset legend="Specialties">
          <CheckboxGrid name="specialties" options={reference.specialties.map((s) => [s.slug, s.name])} selected={profile?.specialties.map((s) => s.slug) ?? []} />
        </Fieldset>
        <SelectField label="Primary specialty" name="primarySpecialty" defaultValue={primary ?? ""}>
          <option value="">First selected</option>
          {reference.specialties.map((s) => (
            <option key={s.slug} value={s.slug}>{s.name}</option>
          ))}
        </SelectField>
      </Section>
      <Section title="Care options" description="Patients filter the directory by these.">
        <Checkbox name="offersInPerson" label="I see patients in person" defaultChecked={profile ? profile.offers_in_person : true} />
        <Checkbox name="offersVirtual" label="I offer virtual appointments" defaultChecked={profile?.offers_virtual ?? false} />
        <Checkbox name="accepting" label="I'm accepting new patients" defaultChecked={profile?.accepting_new_patients ?? true} />
        <Fieldset legend="Languages you provide care in">
          <CheckboxGrid name="languages" options={Object.entries(LANGUAGES)} selected={profile?.languages ?? ["en"]} />
        </Fieldset>
      </Section>
      <Section title="Insurance & payment">
        <Fieldset legend="Payment options you accept">
          <CheckboxGrid name="payment" options={Object.entries(PAYMENT_OPTIONS)} selected={profile?.payment_options ?? []} />
        </Fieldset>
        <TextAreaField label="Insurance & fee notes (optional)" name="insuranceNotes" defaultValue={profile?.insurance_notes ?? ""} maxLength={500} rows={3} />
      </Section>
      {mode === "onboarding" ? (
        <Section title="Practice location" description="Where you see patients in person. You can add more locations later.">
          <TextField label="Street address (optional)" name="address" defaultValue={location?.address_line1 ?? ""} autoComplete="address-line1" hint="Shown on your public profile." />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="City" name="city" defaultValue={location?.city ?? ""} autoComplete="address-level2" />
            <TextField label="Province / state" name="region" defaultValue={location?.region ?? ""} autoComplete="address-level1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Country" name="country" defaultValue={location?.country ?? ""}>
              <option value="">Select…</option>
              {Object.entries(COUNTRIES).map(([c, n]) => (
                <option key={c} value={c}>{n}</option>
              ))}
            </SelectField>
            <TextField label="Postal code (optional)" name="postalCode" defaultValue={location?.postal_code ?? ""} autoComplete="postal-code" />
          </div>
        </Section>
      ) : null}
      <div className="flex justify-end border-t border-line/70 pt-6">
        <SubmitButton size="lg">{mode === "onboarding" ? "Continue to dashboard" : "Save profile"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
