import type { Metadata } from 'next'
import LegalPage, { LegalSection } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What VChat collects, why, and what you can do about it.',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This explains what we collect, why we collect it, and what you can do about it. It is written to be read, not to be skipped."
    >
      <LegalSection heading="1. What we collect">
        <p>
          <strong className="font-semibold text-brand-text">
            What you give us.
          </strong>{' '}
          Your name, date of birth, and either an email address or a phone
          number, because an account needs an identity and an age check. Your
          password is stored only as a hash, never as text we can read.
        </p>
        <p>
          <strong className="font-semibold text-brand-text">
            What you post.
          </strong>{' '}
          Messages, posts, comments, reactions and the media you upload.
        </p>
        <p>
          <strong className="font-semibold text-brand-text">
            What using the service produces.
          </strong>{' '}
          Sign-in times, device and browser information, and IP address. We
          use these to keep accounts secure and to find abuse.
        </p>
      </LegalSection>

      <LegalSection heading="2. Why we collect it">
        <p>
          To run the service: to deliver your messages, show your posts to
          the people you shared them with, and keep your session signed in.
        </p>
        <p>
          To keep it safe: to detect abuse, enforce the rules, and respond to
          reports.
        </p>
        <p>
          To meet legal obligations, including retaining certain records when
          the law requires it.
        </p>
      </LegalSection>

      <LegalSection heading="3. Who can see what">
        <p>
          A direct message is visible to you and the person you sent it to. A
          private group is visible to its members. A public channel is
          visible to anyone.
        </p>
        <p>
          We do not sell your personal information. We share it only with
          service providers who help us run the service under contract, and
          with authorities where we are legally required to.
        </p>
      </LegalSection>

      <LegalSection heading="4. How long we keep it">
        <p>
          Your content stays until you delete it or close your account.
          Security logs are kept for a limited period. Where a record is
          evidence in a safety report, it is retained for a defined
          retention window even after an account closes.
        </p>
      </LegalSection>

      <LegalSection heading="5. Your choices">
        <p>
          You can view and edit your profile, control who can contact you,
          export your data, and delete your account from settings.
        </p>
        <p>
          Deleting your account removes your content from the service. Copies
          other people already saved are outside our control.
        </p>
      </LegalSection>

      <LegalSection heading="6. Security">
        <p>
          Traffic is encrypted in transit. Sensitive fields are encrypted at
          rest. Access to production data is restricted and audited. No
          system is perfectly secure, so we also give you tools —
          two-factor authentication, and a list of your active sessions.
        </p>
      </LegalSection>

      <LegalSection heading="7. Changes to this policy">
        <p>
          When this policy changes we publish a new version with a new
          version number and date. The version recorded against your account
          is the one you accepted.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
