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
| `privacy.html`, `terms.html` | Privacy policy and terms of use (Convironment, LLC) |
| `package.json`, `capacitor.config.json`, `scripts/`, `assets/`, `.github/workflows/android.yml` | Phone-app packaging and the automatic Android build |

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

## Phone apps (Android now, iPhone next)

The same app is packaged for the stores with Capacitor (`capacitor.config.json`, app ID `com.convironment.civilquest`). The game files and Firebase SDK are bundled inside the app, so it opens offline. Inside the store apps, the instructor screen tells instructors to use the portal in a web browser but has no sign-up or payment link (store rules), there's no install banner, and the Android back button moves back one screen.

**Automatic Android builds:** every change pushed to `main` runs the **Android app** workflow (GitHub → Actions tab). Each run produces:

- **CivilQuest-test-apk**: download it from the run page, unzip it, and open the `.apk` on an Android phone to install it for testing (allow "install unknown apps" when asked). It uses the same Firebase, so classes and results work.
- **CivilQuest-play-bundle**: the signed `.aab` for Google Play. This appears only once the signing secrets are added: under Settings → Secrets and variables → Actions, add `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Keep the keystore file and passwords safe: every future update must be signed with the same key.

The app targets Android 16 (API 36), as Google Play requires for new apps.

**Store listing basics:** category Education; audience 13+; privacy policy URL `https://ashrafh94.github.io/civilquest/privacy.html`; data collected: name (entered by the user), app activity (level results), device or other IDs (anonymous sign-in ID); no ads; data encrypted in transit; deletion on request.

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
