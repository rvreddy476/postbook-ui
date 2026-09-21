import type { Metadata } from 'next'
import LegalPage, { LegalSection } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms you agree to when you use VChat.',
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms cover your use of VChat. By creating an account you agree to them, so please read them before you do."
    >
      <LegalSection heading="1. Who can use VChat">
        <p>
          You must be at least 18 years old to create an account. We ask for
          your date of birth at registration and refuse accounts below that
          age.
        </p>
        <p>
          You are responsible for what happens under your account. Keep your
          password to yourself, and tell us if you think someone else has it.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your content">
        <p>
          What you post stays yours. By posting it you give us permission to
          store it and show it to the people you have shared it with, which
          is what makes the service work.
        </p>
        <p>
          You are responsible for having the right to post what you post. If
          you delete something, we remove it from the service; copies other
          people already saved or forwarded are outside our control.
        </p>
      </LegalSection>

      <LegalSection heading="3. What you may not do">
        <p>
          Do not post content that is illegal, that harasses or threatens
          someone, that impersonates another person, or that sexualises
          minors. Do not use the service to send bulk unsolicited messages,
          to break into accounts, or to scrape data at scale.
        </p>
        <p>
          We may remove content and suspend or close accounts that break
          these rules. Where we can, we tell you why.
        </p>
      </LegalSection>

      <LegalSection heading="4. Groups and channels">
        <p>
          A group is private and invite-only unless its owner opens it. A
          channel is public unless its owner makes it private. Owners are
          responsible for moderating what is posted in the spaces they run.
        </p>
      </LegalSection>

      <LegalSection heading="5. Ending your account">
        <p>
          You can close your account at any time from settings. We may close
          an account that repeatedly breaks these terms, or where we are
          required to by law.
        </p>
        <p>
          Some records are kept after closure where the law requires it, or
          where they are evidence in a safety report. Everything else is
          deleted.
        </p>
      </LegalSection>

      <LegalSection heading="6. Changes to these terms">
        <p>
          When these terms change we publish a new version with a new
          version number and date. The version recorded against your account
          is the one you accepted. We will tell you about material changes
          before they take effect.
        </p>
      </LegalSection>

      <LegalSection heading="7. No warranty, and our liability">
        <p>
          The service is provided as it is. We do not promise it will always
          be available or free of faults.
        </p>
        <p>
          Nothing here limits liability that cannot be limited by law.
          Subject to that, we are not liable for indirect or consequential
          loss arising from your use of the service.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
