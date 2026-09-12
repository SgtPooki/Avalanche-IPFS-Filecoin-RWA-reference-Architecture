# Demo script

A 2-3 minute captioned recording of Anchorline verifying a real-world asset record set on Avalanche Fuji and Filecoin Calibration. There is no narration: each caption is held for its reading time. Everything on screen is live except one labelled publishing segment, which walks the click-through mockup because storing a record on Filecoin takes about two minutes.

`node scripts/record-demo.mjs` produces the recording from this script with headless Chromium. The caption lines in that script are the ones below; change both together. Every chain read runs at real length while its captions show. Where a read outlasts its captions, the silent remainder plays at double speed under a caption saying so. Total running time still moves with provider response times: takes on 2026-09-12 ran from 2:48 to 3:17 with that edit, and uncut takes on 2026-09-11 ran from 3:06 to 4:23.

## Disclosures

State these on screen, not only here.

- The title card says there is no narration and that one segment is mockup footage.
- A label in the top right reads "Live: Avalanche Fuji and Filecoin Calibration" for the app segments and switches to "Mockup footage: design click-through, not the app" for the publishing segment.
- Any wait that outlasts its captions plays at 2x under the caption "Still waiting on the networks. Shown at 2x until they answer; times printed on screen are real." The verdict's `checked in Ns` is the unedited figure. `timeline.json` records how many windows were sped up and how many seconds that removed.
- The two-deeds card shows excerpts of the two PDFs' text, not the rendered pages.
- All documents are synthetic. There is no 123 Main Street in Fairview County.

## Shot list

Viewport 1280 by 720, light theme, app served by `npm run dev`. The page renders in the top 624 pixels; captions sit in a 96 pixel band below it and never cover evidence.

### 1. Title card

Static card with the anchor line mark, repository address and the disclosures.

> Anchorline: verifiable offchain records for a real-world asset on Avalanche. Everything here runs live on Avalanche Fuji and Filecoin Calibration, except one labelled segment.

### 2. Asset

Open the app, click Asset. The record set loads from both chains while the caption shows.

> This is FAIRVIEW-0031, a synthetic property record set. Avalanche holds one pointer per version: the manifest content identifier, its Filecoin piece, and a data set id. The manifest lists five records. Filecoin providers hold the bytes; Avalanche never stores a document.

### 3. Verify, live

Click Verify, then Verify now. Progress stays on screen for the whole read, 42 to 81 seconds in the takes so far. The three captions show at the start of the wait; any remainder shows the progress counter at 2x with the disclosure caption.

> Verify needs no wallet, no account, and no key. It reads the pointer from Avalanche, fetches the manifest and every record from Filecoin, re-hashes each one, and reads the storage proof state for the data set.

> Most of this wait is storage providers answering. Anchoring on Avalanche takes about four seconds. Storing a record takes about two minutes, which is why publishing is never live.

> The proof time you will see belongs to the data set a piece sits in, not to each file.

When the verdict lands, scroll so the manifest storage row and the per-record table are in frame.

> Verified. The manifest and every record hash to the identifiers Avalanche points at, they are retrievable, and their data set has a current storage proof.

### 4. Two deeds

A card with excerpts from `data/deed.pdf` and `data/deed-tampered.pdf` side by side, the changed owner name highlighted. The viewer sees the change before the check refuses it.

> Now someone hands you a deed. Two copies exist on disk: the one that was published, and one with a single name changed. Every other byte is the same.

### 5. Check a document, both deeds

Click Check a document and choose `data/deed.pdf`. The lookup fetches each anchored version's manifest, newest first, and stops at the first match: 12 to 18 seconds in the takes so far. The doctored deed matches nothing, so it reads every version: 11 to 35 seconds.

> The published copy first. It is hashed in the browser and never uploaded, then looked for in every version anchored on Avalanche.

> On record. This is deed.pdf, exactly as published.

Choose `data/deed-tampered.pdf`.

> Now the altered copy. Different fingerprint. Every version is searched again.

> Failed. No version anchored on Avalanche points at these bytes. This is tampering, not an update.

### 6. History

Click History. Open Inspect records on version 2, then on version 1. The tax assessment row is highlighted in both tables, and the recorder scrolls from the version 2 row to the version 1 row.

> A legitimate change publishes a new version. Version 2 replaced the 2025 tax assessment with the 2026 one and kept the other four records. Version 1 is still there, with its own manifest and its own transaction. Nothing is overwritten.

> The highlighted rows are the only difference between the two versions. The other four content identifiers are identical.

### 7. Publishing, mockup footage

Open `mockup/index.html` at the Upload records screen. The label switches to mockup footage. Advance to Anchor the manifest and click Anchor to Avalanche during the second caption, so the signing overlay lands with the words.

> This last part is the design mockup, not the app. Publishing is never live in a demo, because each record takes about two minutes to store. Every file is fingerprinted in the browser and stored on Filecoin as its own piece.

> The manifest is stored last. One Avalanche transaction anchors its content identifier, its piece, and the data set id, in about four seconds. The registry appends a version and never overwrites.

### 8. Closing card

A QR code for the hosted read-only app at sgtpooki.github.io/anchorline, the clone and verify commands, the no-key statement, and the bridge credit.

> Verify it yourself from a phone: scan the code, or clone the repository and run npm run verify. No key needed. Anchorline builds on the Avalanche and Filecoin data bridge from May 2025.

## Output

The recorder writes `anchorline-demo.mp4` (no audio track), `poster.png`, `captions.vtt` and `timeline.json` to the output directory, `recording/` by default. `timeline.json` records when each caption started in the finished picture, how long the live verification took, and the windows played at 2x; `npm run share -- recording` builds the share page from it and from `seed-output.json`, so the chapter times and identifiers on the page come from the take rather than from hand-typed values. `npm run publish -- DIRECTORY` uploads a bundle of those files to Calibration for sharing.
