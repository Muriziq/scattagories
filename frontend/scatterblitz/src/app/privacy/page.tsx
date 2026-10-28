"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";
import CanvasBackground from "../components/CanvasBackground";
import styles from "../terms/legal.module.css";

export default function PrivacyPage() {
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
          <h1 className={styles.title}>PRIVACY POLICY</h1>
          <p className={styles.heroSubtitle}>
            Comprehensive disclosure of how ScatterBlitz collects, uses, protects, and handles your
            personal data under global privacy frameworks (GDPR, NDPR, CCPA).
          </p>
          <span className={styles.dateBadge}>Effective Date: October 28, 2026</span>
        </div>

        <div className={styles.articlesContainer}>
          {/* 1. Who We Are */}
          <section id="who-we-are" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>WHO WE ARE &amp; DATA CONTROLLER</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                <strong>ScatterBlitz</strong> (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is the data controller responsible for personal information processed through the ScatterBlitz real-time multiplayer word game application and related services.
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Service / Platform:</strong> ScatterBlitz (<Link href="/" style={{ color: "var(--amber)" }}>https://scatterblitz.com</Link>)</li>
                <li><strong>Designated Privacy Email:</strong> <a href="mailto:privacy@scatterblitz.com" style={{ color: "var(--amber)" }}>privacy@scatterblitz.com</a></li>
                <li><strong>Support Contact:</strong> <a href="mailto:support@scatterblitz.com" style={{ color: "var(--amber)" }}>support@scatterblitz.com</a></li>
                <li><strong>Effective Date:</strong> October 28, 2026</li>
              </ul>
            </div>
          </section>

          {/* 2. Data We Collect */}
          <section id="data-we-collect" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>DATA WE COLLECT</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                We collect information directly from you, automatically through your device while you play, and optionally through external integrations:
              </p>
              <ul className={styles.bulletList}>
                <li>
                  <strong>Directly Provided by You:</strong>
                  <ul>
                    <li>Account profile: chosen username, user tag, and email address.</li>
                    <li>Security credentials: cryptographically salted and hashed passwords (via bcrypt). We never see or store plain text passwords.</li>
                    <li>User content &amp; media: uploaded avatar profile images (JPEG, PNG, WebP format, up to 2MB).</li>
                    <li>In-game form inputs: category word submissions, round answers, peer validation votes, and room configuration settings.</li>
                    <li>Support communications: correspondence sent to our support desk.</li>
                  </ul>
                </li>
                <li>
                  <strong>Automatically Collected Data:</strong>
                  <ul>
                    <li>Device &amp; Browser Telemetry: user-agent string, operating system version, browser family, viewport resolution, and language headers.</li>
                    <li>Network &amp; Log Identifiers: IP address, request timestamps, referring URLs, API endpoint response times, and server error logs.</li>
                    <li>Persistent Device Identifier: a client-generated UUID saved in your browser&apos;s <code>localStorage</code> (<code>scatterblitz_device_id</code>) transmitted via the <code>x-device-id</code> header to enforce single-active-match rules and prevent socket flooding.</li>
                    <li>Game Telemetry: round durations, match completion outcomes, category win/loss rates, point totals, and placement history.</li>
                  </ul>
                </li>
                <li>
                  <strong>Third-Party / Authentication Data:</strong>
                  <ul>
                    <li>If you authenticate via third-party OAuth providers (e.g., Google OAuth if enabled), we receive your basic public profile identifier, verified email, and avatar URL provided by that service.</li>
                    <li>We do not collect or process financial credit card numbers directly. Any future paid features or tournament entries are handled by compliant third-party payment gateways (e.g., Stripe) who pass only payment status confirmations to our backend.</li>
                  </ul>
                </li>
              </ul>
            </div>
          </section>

          {/* 3. Why We Collect It */}
          <section id="why-we-collect" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>WHY WE COLLECT IT</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                We process your information strictly for legitimate, transparent purposes:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Service Delivery &amp; Gameplay:</strong> Operating real-time WebSocket rooms, synchronizing round clocks, evaluating category submissions, and determining round winners.</li>
                <li><strong>Account Administration:</strong> Creating your profile, authenticating logins via secure tokens, managing guest-to-permanent account conversions, and sending essential verification links.</li>
                <li><strong>Competitive Integrity &amp; Anti-Cheat:</strong> Monitoring socket event rates (up to 30 events/sec), stopping automated dictionary bot scrapers, and blacklisting fraudulent devices.</li>
                <li><strong>Public Leaderboards:</strong> Aggregating match statistics into global and seasonal leaderboards displaying your username, avatar, matches won, and aggregate points.</li>
                <li><strong>Customer Support &amp; Bug Resolution:</strong> Investigating dropped connections, socket disconnects, or account recovery requests.</li>
                <li><strong>Legal &amp; Regulatory Compliance:</strong> Complying with applicable laws, preventing fraudulent access, and enforcing our Terms of Service.</li>
              </ul>
            </div>
          </section>

          {/* 4. Legal Basis (GDPR / NDPR) */}
          <section id="legal-basis" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>LEGAL BASIS FOR PROCESSING</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                Under the EU General Data Protection Regulation (GDPR), the Nigeria Data Protection Act (NDPR/NDPA), and comparable frameworks, we rely on the following lawful grounds:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Contractual Necessity (Art. 6(1)(b) GDPR):</strong> Processing required to provide you with the ScatterBlitz service in accordance with our Terms of Service (e.g. running matches, scoring words, maintaining account access).</li>
                <li><strong>Legitimate Interests (Art. 6(1)(f) GDPR):</strong> Processing necessary to maintain anti-cheat systems, rate-limiting, server crash diagnostics, infrastructure protection, and caching global leaderboards.</li>
                <li><strong>Consent (Art. 6(1)(a) GDPR):</strong> Processing where you have explicitly opted in, such as optional avatar uploads, email marketing subscriptions (if any), or non-essential cookies. You have the right to withdraw consent at any time.</li>
                <li><strong>Legal Obligation (Art. 6(1)(c) GDPR):</strong> Processing required to satisfy statutory tax, accounting, or security audit requirements under applicable law.</li>
              </ul>
            </div>
          </section>

          {/* 5. Sharing & Third Parties */}
          <section id="sharing-third-parties" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>THIRD-PARTY SHARING &amp; NO-SALE PLEDGE</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <div className={styles.callout}>
                <strong>We Do Not Sell Your Data:</strong> ScatterBlitz does not sell, rent, monetize, or trade your personal data, gameplay logs, or contact information to data brokers, ad networks, or telemarketers under any circumstances.
              </div>
              <p className={styles.paragraph}>
                We share data only with trusted third-party service providers bound by strict confidentiality and data-processing agreements:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Cloud Infrastructure &amp; Hosting:</strong> Cloud server providers (e.g., AWS, DigitalOcean, or Render) that host our PostgreSQL database, Node.js WebSocket engine, and static avatar file stores.</li>
                <li><strong>Transactional Email Services:</strong> Compliant email delivery gateways (e.g., Resend, SendGrid, or AWS SES) used solely to dispatch account verification tokens and password reset instructions.</li>
                <li><strong>Payment Processors:</strong> Tier-1 PCI-DSS certified payment processors (e.g., Stripe) handling payment card authorizations. We never access raw card numbers.</li>
                <li><strong>Legal Authorities:</strong> Law enforcement or judicial bodies only when subpoenaed or legally required under enforceable warrants.</li>
              </ul>
            </div>
          </section>

          {/* 6. Storage & Security */}
          <section id="storage-security" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>STORAGE, LOCATION &amp; DATA SECURITY</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                We employ defense-in-depth safeguards across both browser storage and server-side infrastructure:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Client / Browser Storage:</strong> Secure HTTP-only, SameSite cookies store authentication refresh tokens (`refreshToken`, `guestToken`), isolating credentials from client-side script access (XSS mitigation). Anonymous device IDs are held in <code>localStorage</code>.</li>
                <li><strong>Server-Side Storage:</strong> Account records, game match histories, and dictionary sets reside in encrypted PostgreSQL databases behind private VPC boundaries.</li>
                <li><strong>Avatar Media Storage:</strong> Custom profile pictures are sanitized, validated against malicious payloads, stored in dedicated directories (<code>/uploads/avatars/</code>), and served with static browser cache headers. When you upload a replacement avatar, the former file is purged from disk.</li>
                <li><strong>In-Transit Encryption:</strong> All client-server traffic, including HTTPS REST calls and WSS real-time WebSocket frames, is encrypted using TLS 1.3 / SSL.</li>
                <li><strong>Rate Limiting &amp; Anti-Abuse:</strong> Rate limiters on both HTTP routes and WebSocket connections mitigate brute-force and denial-of-service threats.</li>
              </ul>
            </div>
          </section>

          {/* 7. Retention & Deletion */}
          <section id="retention-deletion" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>RETENTION &amp; ACCOUNT DELETION</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                We retain your information only as long as necessary to fulfill service functions:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Registered Accounts:</strong> Active user profiles are maintained until you initiate an account deletion request.</li>
                <li><strong>Guest Sessions:</strong> Anonymous guest records, guest JWTs, and temporary game room associations expire automatically after 7 days of inactivity.</li>
                <li><strong>Soft Delete &amp; 30-Day Purge:</strong> When you delete your account, your profile is marked as deleted (<code>deleted_at</code> timestamp), your session tokens are revoked, and your email/password hash is scrubbed or permanently erased from active databases within 30 days. Historical match scores are anonymized to protect public match balance.</li>
              </ul>
            </div>
          </section>

          {/* 8. User Rights */}
          <section id="user-rights" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>YOUR STATUTORY RIGHTS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                Depending on your geographic jurisdiction, you have the following enforceable rights under GDPR, NDPR, and CCPA:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Right of Access:</strong> Request a confirmation and readable copy of all personal information we hold about you.</li>
                <li><strong>Right to Rectification:</strong> Update or correct inaccurate or incomplete details (e.g. changing your username or avatar in account settings).</li>
                <li><strong>Right to Erasure (&quot;Right to Be Forgotten&quot;):</strong> Request the permanent deletion of your profile, avatars, and personal records.</li>
                <li><strong>Right to Data Portability:</strong> Request an export of your account and match statistics in a structured, machine-readable format (e.g., JSON).</li>
                <li><strong>Right to Restrict or Object to Processing:</strong> Object to specific automated processing or request suspension of processing under particular circumstances.</li>
                <li><strong>Right to Withdraw Consent:</strong> Revoke consent at any time where processing was grounded on consent, without affecting prior lawful processing.</li>
                <li><strong>Right to Lodge a Complaint:</strong> File a grievance with your local data protection supervisory authority (e.g., your national DPA or the Nigeria Data Protection Commission).</li>
              </ul>
              <div className={styles.callout}>
                <strong>How to Exercise Your Rights:</strong> You can manage profile data directly within your account settings or submit a formal data request by emailing <a href="mailto:privacy@scatterblitz.com" style={{ color: "var(--amber)" }}>privacy@scatterblitz.com</a>. We respond to all verified requests within 30 days without charge.
              </div>
            </div>
          </section>

          {/* 9. Cookies & Tracking */}
          <section id="cookies-tracking" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>COOKIES, LOCAL STORAGE &amp; CONTROLS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                ScatterBlitz uses strictly necessary cookies and local storage tokens to deliver game features:
              </p>
              <ul className={styles.bulletList}>
                <li><strong>Session &amp; Auth Cookies:</strong> <code>refreshToken</code> and <code>guestToken</code> are secure, HTTP-only cookies enabling continuous access across game lobbies.</li>
                <li><strong>Local Storage:</strong> <code>scatterblitz_device_id</code> stores an anonymous client UUID to coordinate browser tabs.</li>
                <li><strong>Opting Out / Disabling:</strong> You can block or delete cookies via your browser settings. However, disabling essential session cookies will prevent you from authenticating, joining rooms, or participating in active gameplay. We do not use third-party advertising cookies, so no tracking opt-out toggles are required.</li>
              </ul>
            </div>
          </section>

          {/* 10. Children's Privacy */}
          <section id="children" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>CHILDREN&apos;S PRIVACY</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                ScatterBlitz is designed for general audiences and is <strong>not directed at children under the age of 13</strong> (or 16 for residents within the European Economic Area).
              </p>
              <p className={styles.paragraph}>
                We do not knowingly collect, solicit, or store personal information from individuals below these minimum statutory ages. If we learn that personal data of a child has been collected without verified parental consent, we will take immediate measures to delete that information from our records. Parents or guardians who believe their child has registered an account may contact us at <a href="mailto:privacy@scatterblitz.com" style={{ color: "var(--amber)" }}>privacy@scatterblitz.com</a>.
              </p>
            </div>
          </section>

          {/* 11. International Transfers */}
          <section id="international-transfers" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>CROSS-BORDER DATA TRANSFERS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                Because ScatterBlitz operates globally with multiplayer lobbies across various regions, your personal data and match logs may be transferred to and stored on servers located outside your country of residence (such as cloud nodes in the United States or the European Union).
              </p>
              <p className={styles.paragraph}>
                Where cross-border transfers occur, we implement recognized transfer mechanisms, including European Commission Standard Contractual Clauses (SCCs), robust encryption, and data-processing agreements to guarantee your personal data receives equivalent protection regardless of destination.
              </p>
            </div>
          </section>

          {/* 12. Policy Changes */}
          <section id="changes-policy" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>CHANGES TO THIS PRIVACY POLICY</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                We may revise this Privacy Policy periodically to reflect technological improvements, gameplay updates, or evolving regulatory standards.
              </p>
              <p className={styles.paragraph}>
                When updates are published, the revised policy will be posted on this page with an updated &quot;Effective Date&quot;. In the event of material modifications that significantly alter how we handle your personal data, we will provide prominent notice via in-game announcements, banner notifications, or direct email to registered users prior to the changes taking effect.
              </p>
            </div>
          </section>

          {/* 13. Contact Information */}
          <section id="contact" className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>CONTACT US &amp; PRIVACY REQUESTS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                If you have questions, feedback, or wish to exercise your data protection rights under GDPR, NDPR, CCPA, or other laws, please contact our designated privacy officer:
              </p>
              <div className={styles.callout}>
                <strong>ScatterBlitz Privacy &amp; Data Protection Office</strong><br />
                Email: <a href="mailto:privacy@scatterblitz.com" style={{ color: "var(--amber)" }}>privacy@scatterblitz.com</a><br />
                General Inquiries: <a href="mailto:support@scatterblitz.com" style={{ color: "var(--amber)" }}>support@scatterblitz.com</a><br />
                Response Commitment: Within 30 days of request receipt
              </div>
            </div>
          </section>
        </div>

        <div className={styles.footerNote}>
          <p>
            By continuing to play ScatterBlitz, you acknowledge that you have reviewed and understood this Privacy Policy.
            Read our accompanying <Link href="/terms">Terms of Service</Link> for community guidelines.
          </p>
        </div>
      </main>
    </div>
  );
}
