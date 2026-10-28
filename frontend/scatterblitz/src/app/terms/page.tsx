"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";
import CanvasBackground from "../components/CanvasBackground";
import styles from "./legal.module.css";

export default function TermsPage() {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className={styles.legalWrapper}>
      <CanvasBackground />

      <header className={styles.header}>
        <div className={styles.navContainer}>
          <button type="button" onClick={handleBack} className={styles.backButton}>
            <FaArrowLeft /> Back
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>TERMS OF SERVICE</h1>
          <p className={styles.heroSubtitle}>
            Legally binding rules governing real-time multiplayer gameplay, account standards,
            intellectual property, disclaimers, liability limits, and dispute resolution on ScatterBlitz.
          </p>
          <span className={styles.dateBadge}>Effective Date: October 28, 2026</span>
        </div>

        <div className={styles.articlesContainer}>
          {/* 1. Acceptance */}
          <section id="acceptance" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>ACCEPTANCE OF TERMS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                By accessing, browsing, registering an account, playing matches, or using any services provided through ScatterBlitz (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you confirm that you have read, understood, and agreed to be bound by these Terms of Service.
              </p>
              <p className={styles.paragraph}>
                If you do not agree to these Terms in their entirety, you must discontinue using ScatterBlitz immediately. These Terms took effect on <strong>October 28, 2026</strong>.
              </p>
            </div>
          </section>

          {/* 2. What the Service Is */}
          <section id="service-description" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>WHAT THE SERVICE IS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                ScatterBlitz is a fast-paced, real-time multiplayer word game and category sprint platform. Players compete in timed rounds to submit valid words matching randomly rolled letters across distinct categories, scored through automated dictionary validation and peer reviews.
              </p>
              <p className={styles.paragraph}>
                The Service is built for casual and competitive players worldwide who wish to test their vocabulary, speed, and creative thinking against friends or public lobbies.
              </p>
            </div>
          </section>

          {/* 3. Eligibility */}
          <section id="eligibility" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>ELIGIBILITY &amp; LEGAL CAPACITY</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                To access or use ScatterBlitz, you represent and warrant that:
              </p>
              <ul className={styles.bulletList}>
                <li>You are at least <strong>13 years old</strong> (or at least <strong>16 years old</strong> if you reside within the European Economic Area or UK).</li>
                <li>You possess the legal capacity to enter into a binding agreement under the laws of your jurisdiction.</li>
                <li>If you are between the minimum statutory age and the age of legal majority in your country, your parent or legal guardian has reviewed and agreed to these Terms on your behalf.</li>
                <li>You have not been previously banned, suspended, or barred from using ScatterBlitz.</li>
              </ul>
            </div>
          </section>

          {/* 4. Accounts & Responsibilities */}
          <section id="accounts" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>ACCOUNTS &amp; CREDENTIALS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                ScatterBlitz offers both Guest sessions and Registered permanent accounts:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Credential Security:</strong> You are solely responsible for preserving the confidentiality of your login credentials and for all activities that take place under your account.</li>
                <li><strong>Information Accuracy:</strong> You agree to provide true, accurate, and up-to-date registration details (including a valid email address for account recovery).</li>
                <li><strong>Guest Sessions:</strong> Anonymous guest accounts are tied to temporary browser tokens. Inactive guest sessions expire after 7 days unless converted into permanent accounts.</li>
                <li><strong>Right to Suspend or Terminate:</strong> We reserve the right to suspend, lock, or delete accounts that provide fraudulent information or breach our rules.</li>
              </ul>
            </div>
          </section>

          {/* 5. Acceptable Use */}
          <section id="acceptable-use" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>ACCEPTABLE USE &amp; FAIR PLAY</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                You agree to use ScatterBlitz only for lawful, intended gameplay. The following actions are strictly prohibited:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Cheating &amp; Bots:</strong> Using optical character recognition (OCR), automated dictionary scraper scripts, browser bot extensions, or socket script injections to submit answers.</li>
                <li><strong>Service Abuse &amp; Overloading:</strong> Exceeding socket event limits (maximum 30 socket actions per second), launching denial-of-service attempts, or bypassing rate limiters.</li>
                <li><strong>Reverse Engineering:</strong> Decompiling, reverse engineering, disassembling, or extracting the source code, game engine logic, or dictionary scoring algorithms.</li>
                <li><strong>Multi-Client Ringing:</strong> Operating multiple guest sessions in a single room to rig peer vote tallies or manipulate leaderboard standings.</li>
                <li><strong>Unlawful Content &amp; Privacy Violations:</strong> Uploading or transmitting defamatory, hateful, abusive, obscene, or infringing material, or sharing personal data belonging to others without their express consent.</li>
              </ul>
              <div className={styles.callout}>
                <strong>Anti-Cheat Enforcement:</strong> Any confirmed attempt to cheat, scrape, or exploit socket connections results in immediate disqualification, leaderboard score forfeiture, and permanent blacklisting of associated accounts and device IDs.
              </div>
            </div>
          </section>

          {/* 6. User Content & Ownership */}
          <section id="user-content" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>USER CONTENT &amp; LICENSE</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                You retain ownership of any content you create, enter, or upload to ScatterBlitz (including your submitted words, usernames, custom room categories, and avatar pictures):
              </p>
              <ul className={styles.bulletList}>
                <li><strong>License Granted to Us:</strong> By uploading or submitting content, you grant ScatterBlitz a non-exclusive, worldwide, royalty-free, transferable license solely to host, store, cache, reproduce, process, validate, and display that content as needed to operate and promote the game service.</li>
                <li><strong>Your Representations:</strong> You warrant that you have all necessary rights, licenses, and permissions to upload your avatars and submit content, and that your uploads do not violate third-party trademarks, copyrights, or privacy rights.</li>
                <li><strong>Content Removal:</strong> We reserve the right, without obligation, to remove or replace non-compliant avatars, offensive display names, or abusive category submissions without prior notice.</li>
              </ul>
            </div>
          </section>

          {/* 7. Our Intellectual Property */}
          <section id="intellectual-property" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>OUR INTELLECTUAL PROPERTY</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                All rights, title, and interest in and to ScatterBlitz—including the website design, UI layout, animations, game mechanics, software code, databases, dictionary scoring algorithms, audio/visual elements, logos, and &quot;ScatterBlitz&quot; trademarks—are and remain the exclusive intellectual property of ScatterBlitz and its licensors.
              </p>
              <p className={styles.paragraph}>
                Subject to your compliance with these Terms, we grant you a personal, limited, non-exclusive, non-transferable, and revocable license to access and play ScatterBlitz for personal, non-commercial entertainment.
              </p>
            </div>
          </section>

          {/* 8. Payments, Billing & Taxes */}
          <section id="payments" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>PAYMENTS, BILLING &amp; REFUNDS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                ScatterBlitz core gameplay is currently free to play. In the event we offer optional premium cosmetic items, custom avatar packs, tournaments, or subscription tiers:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Pricing &amp; Taxes:</strong> Prices will be clearly displayed before purchase. You are responsible for all applicable sales, consumption, or value-added taxes (VAT).</li>
                <li><strong>Billing &amp; Payment Processors:</strong> Purchases are processed securely through certified third-party payment gateways (such as Stripe). We do not store raw credit card details on our servers.</li>
                <li><strong>Cancellations &amp; Failed Payments:</strong> Subscriptions (if applicable) can be cancelled at any time before the renewal cycle. If a recurring payment fails, premium features or cosmetic benefits may be suspended until settled.</li>
                <li><strong>Refund Policy:</strong> Because digital cosmetic items and in-game consumable perks are activated immediately upon purchase, all sales are generally final and non-refundable, except where mandatory consumer protection laws in your jurisdiction require otherwise.</li>
              </ul>
            </div>
          </section>

          {/* 9. Third-Party Services */}
          <section id="third-party" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>THIRD-PARTY INTEGRATIONS &amp; LINKS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                ScatterBlitz may integrate third-party services (such as Google OAuth for authentication, Stripe for payments, or cloud infrastructure providers) or contain external links.
              </p>
              <p className={styles.paragraph}>
                We do not endorse, control, or assume responsibility for the content, privacy practices, or availability of third-party platforms. Your interactions with third-party providers are governed exclusively by their respective terms and privacy policies.
              </p>
            </div>
          </section>

          {/* 10. Termination & Data Handling */}
          <section id="termination" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>TERMINATION &amp; DATA DISPOSITION</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                Either you or ScatterBlitz may terminate this service relationship at any time:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Voluntary Termination by You:</strong> You may close your account at any time through account settings or by requesting deletion from our privacy team.</li>
                <li><strong>Termination by Us:</strong> We may terminate, block, or suspend your account immediately, without prior notice, if you breach these Terms, cheat, spam, or engage in abusive behavior.</li>
                <li><strong>Effect of Termination:</strong> Upon termination, your active sessions and tokens are immediately invalidated. Your personal credentials and avatar files are permanently expunged within 30 days as detailed in our <Link href="/privacy" style={{ color: "var(--amber)" }}>Privacy Policy</Link>, while aggregated, anonymized match totals remain for historical leaderboard integrity.</li>
              </ul>
            </div>
          </section>

          {/* 11. Disclaimers */}
          <section id="disclaimers" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>DISCLAIMERS (&quot;AS IS&quot;)</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                SCATTERBLITZ IS PROVIDED STRICTLY ON AN <strong>&quot;AS IS&quot;</strong> AND <strong>&quot;AS AVAILABLE&quot;</strong> BASIS. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE EXPRESSLY DISCLAIM ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p className={styles.paragraph}>
                WE DO NOT WARRANT THAT (A) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; (B) ROUND TIMERS WILL BE IMMUNE TO INTERNET LATENCY OR CLIENT-SIDE PACKET DROPS; OR (C) AUTOMATED DICTIONARY VALIDATION WILL COVER EVERY COLLOQUIAL SLANG WORD OR REGIONAL VARIANT.
              </p>
            </div>
          </section>

          {/* 12. Limitation of Liability */}
          <section id="limitation-liability" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>LIMITATION OF LIABILITY</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL SCATTERBLITZ, ITS OPERATORS, AFFILIATES, OFFICERS, OR EMPLOYEES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES (INCLUDING LOSS OF PROFITS, DATA, USE, OR GOODWILL) ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE.
              </p>
              <p className={styles.paragraph}>
                IN ALL CASES, OUR TOTAL AGGREGATE LIABILITY ARISING FROM ALL CLAIMS RELATING TO THE SERVICE SHALL BE CAPPED AT AND NOT EXCEED THE GREATER OF: (A) THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRIOR TO THE CLAIM, OR (B) FIFTY US DOLLARS ($50.00 USD).
              </p>
              <p className={styles.paragraph} style={{ fontSize: "0.88rem", color: "var(--text-subtle)" }}>
                <em>Note: Some jurisdictions do not allow the exclusion of certain warranties or limitations on statutory consumer rights, so some portions of this limitation may not apply to you.</em>
              </p>
            </div>
          </section>

          {/* 13. Indemnification */}
          <section id="indemnification" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>INDEMNIFICATION</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                You agree to defend, indemnify, and hold harmless ScatterBlitz, its creators, operators, and affiliates against any and all claims, demands, liabilities, damages, losses, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or in any way connected with:
              </p>
              <ul className={styles.bulletList}>
                <li>Your access to, gameplay on, or misuse of the Service.</li>
                <li>Your uploaded avatar images, submitted words, or user content that infringes any third party&apos;s rights.</li>
                <li>Your violation of these Terms or any applicable laws and regulations.</li>
              </ul>
            </div>
          </section>

          {/* 14. Governing Law & Disputes */}
          <section id="governing-law" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>GOVERNING LAW &amp; DISPUTES</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                These Terms and any dispute arising out of or related to ScatterBlitz shall be governed by and construed in accordance with the laws of the jurisdiction in which the service operates, without regard to conflict of law principles.
              </p>
              <p className={styles.paragraph}>
                <strong>Informal Dispute Resolution:</strong> Before filing formal legal proceedings, you and ScatterBlitz agree to attempt to resolve any dispute, claim, or controversy informally by sending an email notice to <a href="mailto:support@scatterblitz.com" style={{ color: "var(--amber)" }}>support@scatterblitz.com</a>.
              </p>
              <p className={styles.paragraph}>
                If a resolution is not achieved within thirty (30) days of notice, the parties agree that any legal action or arbitration proceeding shall be brought exclusively in the competent courts having jurisdiction over our primary place of business, unless mandatory local consumer protection rules provide otherwise.
              </p>
            </div>
          </section>

          {/* 15. Changes to Terms */}
          <section id="changes-terms" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>CHANGES TO THESE TERMS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                We reserve the right to modify or replace these Terms of Service at our sole discretion.
              </p>
              <p className={styles.paragraph}>
                When revisions are made, we will update the &quot;Effective Date&quot; at the top of this document. In the case of material revisions, we will provide reasonable advance notice through in-game announcements, top banners, or email notifications to registered users. Your continued use of ScatterBlitz after revised Terms take effect constitutes binding acceptance of those changes.
              </p>
            </div>
          </section>

          {/* 16. Contact */}
          <section id="contact" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>CONTACT &amp; LEGAL NOTICES</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                For inquiries regarding these Terms of Service, reporting rule violations, or submitting legal notices, please contact us at:
              </p>
              <div className={styles.callout}>
                <strong>ScatterBlitz Legal Operations Desk</strong><br />
                General Legal Inquiries: <a href="mailto:support@scatterblitz.com" style={{ color: "var(--amber)" }}>support@scatterblitz.com</a><br />
                Privacy &amp; Data Rights: <a href="mailto:privacy@scatterblitz.com" style={{ color: "var(--amber)" }}>privacy@scatterblitz.com</a><br />
                Response Time: Inquiries are addressed within 3 to 5 business days.
              </div>
            </div>
          </section>
        </div>

        <div className={styles.footerNote}>
          <p>
            Have questions about our Terms? Contact our team at{" "}
            <a href="mailto:support@scatterblitz.com">support@scatterblitz.com</a>.
            Please also review our <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
