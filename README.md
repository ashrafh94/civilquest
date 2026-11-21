# CivilQuest

A gamified learning platform for civil engineering.

- **Student app** (free): choose "I'm a student", join a class with a code and your name, pick a course, open a chapter and play its levels. Results go to the instructor's class automatically. Works in any phone browser, installs to the home screen, and is ready to wrap as an Android/iPhone app.
- **Instructor portal** (`portal.html`): create an account, start a free trial with an invite code, create classes, share the class code or QR code, and watch live results. Paid subscriptions plug in later (see the end).
- **Courses**: one file per course in `courses/`. The first is **Air Quality Engineering**, with 6 chapters and 18 levels: adsorption warm-up, oxidation, condensation, biological treatment, choosing a technology, and a review. The content is generic: no institution, slide or syllabus references.

"CivilQuest" is a working name. To rename, change `appName` in `config.js`, the names in `manifest.webmanifest`, and the `<title>` in `index.html` and `portal.html`.

## Files

| File | What it is |
|---|---|
| `index.html`, `app.js`, `styles.css` | Student app |
| `portal.html`, `portal.js` | Instructor portal |
| `courses/air-quality.js` | Air Quality course content |
| `config.js` | Settings: app name, addresses, admin account, Firebase |
| `firestore.rules` | Security rules (also keeps the original Condenser Lab working) |
| `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png` | Install-to-home-screen and offline support |

## Setup

It uses the same Firebase project as Condenser Lab, in separate collections, so nothing new needs creating in Firebase.

1. **Publish the new security rules.** Firebase console → Firestore Database → Rules → replace everything with `firestore.rules` → Publish. These rules include the Condenser Lab rules, so the original game keeps working.
2. **Create the GitHub repository.** github.com → New repository → name `civilquest` → Public → Create. Click **uploading an existing file**, drag in **everything from this folder, including the `courses` folder**, and click Commit. Then go to Settings → Pages → Deploy from a branch → `main` / root → Save.
3. **Open the portal** at `https://ashrafh94.github.io/civilquest/portal.html`. Sign in with your existing lecturer email and password, and complete your profile. Your account is the administrator.
4. **Invite colleagues.** Portal → Manage invite codes → create a code per colleague, with a trial length and a note. Send them the portal link and their code. Each code works once.
5. **Create a class.** Portal → New class. Students join with the class code, or by scanning the QR code on the class page, which opens the app with the code already filled in.

## How access works

| Who | Access |
|---|---|
| Students | Free. No account. Class code plus name. Without a code they can still practise; results then stay on the phone. |
| Instructors with an invite code | Free trial for the number of days on the code |
| Instructors without a code | Account is created, but they can't create classes until they subscribe |
| You (admin, set in `config.js` and `firestore.rules`) | Full access, plus invite codes |

## Adding paid subscriptions later

1. Upgrade the Firebase project to the **Blaze** (pay-as-you-go) plan. Small usage typically stays within the free allowance, but Google requires a billing account for extensions.
2. Install the **Run Payments with Stripe** Firebase extension and connect your Stripe account.
3. In Stripe, create an "Instructor" subscription product and add the metadata `firebaseRole: instructor`. The extension then marks subscribed accounts, and the security rules already accept that mark.
4. Put the checkout link in `subscribeUrl` in `config.js`.

Instructors pay on the website, not inside the app, which avoids app-store purchase rules and commissions.

## Adding a new course

Copy `courses/air-quality.js`, give it a new `id`, title, chapters and levels, and add a `<script>` line for it in `index.html` and `portal.html`. Level types available: calculation (`num`), multiple choice (`choice`), select all that apply (`multi`), and matching (`match`). Each wrong answer can carry a `lab`, the description instructors see.

## Notes

- Student names are typed by the students, so check them against your roster. Results with the same name (ignoring capitals) are combined.
- Results recorded offline are kept on the phone and sent when it reconnects.
- Plant cases are hypothetical teaching exercises. Property data and equipment limits are simplified for learning, not design.
