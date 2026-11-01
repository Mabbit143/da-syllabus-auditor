"use client";

export default function PrivacyDisclosure({ disclosure, signedIn }: { disclosure: string; signedIn: boolean }) {
  return (
    <div className="privacy-notice" aria-label="Privacy and data use">
      <p>
        Your file&apos;s text is sent to an AI service for this check. Scanned PDFs also send page images for text reading.
        Results are saved in this browser.
      </p>
      <details className="privacy-details">
        <summary>Privacy and how this works</summary>
        <div className="privacy-details__body">
          <p>{disclosure}</p>
          <p>PDF text is extracted in your browser. For scans, page images are sent to Modal for OCR only when you choose Read scanned pages; they are not stored.</p>
          <p>{signedIn ? "Completed reports autosave to your private account. Saving status appears with the report." : "Reports are saved in this browser when storage is available. Sign in to autosave new reports to your private account."} Printing is your choice, not public sharing.</p>
          <p>If you are signed in, quotes where a syllabus differs from your school&apos;s published policy, the instructor&apos;s name and school are also recorded in the owner-only policy-gap list, not linked to your account. Student reports and this list are not public.</p>
        </div>
      </details>
    </div>
  );
}
