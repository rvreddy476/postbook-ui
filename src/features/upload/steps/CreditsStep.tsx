"use client";

import { Clapperboard } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { creditsProblems, type CreditsProblem } from "@/features/posttube/credits/creditsModel";
import { CreditsEditor } from "@/features/posttube/credits/components/CreditsEditor";
import { useGenres } from "@/features/posttube/credits/useCredits";
import { Section } from "../primitives";
import type { StudioFormState } from "../types";

interface CreditsStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  showErrors?: boolean;
  /** The last publish's credits refusal (creditsErrorProblem), drawn under its field. */
  serverProblem?: CreditsProblem | null;
}

/*
  Credits (long videos in a film, entertainment, comedy, music,
  documentary or podcast topic): cast & crew, genres, release year and
  production house. Sent with the create request or the draft; a linked
  VChat account is asked to accept before the video shows on its profile.
*/
export function CreditsStep({ form, patch, showErrors, serverProblem = null }: CreditsStepProps) {
  const genres = useGenres();
  const me = useAuthUser();
  const problems = creditsProblems(form.credits);
  return (
    <div className="upload-stack">
      <Section title="Cast & crew" subtitle="Up to 30 people, in the order viewers should see them" icon={Clapperboard}>
        <CreditsEditor
          value={form.credits}
          onChange={(credits) => patch({ credits })}
          genres={genres.data ?? []}
          genresLoading={genres.isPending}
          variant="upload"
          selfId={me?.id ?? null}
          problems={serverProblem ? [...problems, serverProblem] : problems}
          showErrors={showErrors || !!serverProblem}
          idPrefix="upload"
        />
      </Section>
    </div>
  );
}
