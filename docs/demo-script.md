# Demo script

A 2-3 minute recording of Anchorline verifying a real-world asset record set on Avalanche Fuji and Filecoin Calibration. Everything on screen is live except one labelled publishing segment, which walks the click-through mockup because storing a record on Filecoin takes about two minutes.

`node scripts/record-demo.mjs` produces the recording from this script with headless Chromium and synthesized narration (macOS `say`, Samantha voice). The narration lines in that script are the ones below; change both together. Every chain read runs at real length while its narration plays. Where a read outlasts its narration, the silent remainder plays at double speed under a caption saying so. Total running time still moves with provider response times: uncut takes on 2026-09-11 ran from 3:06 to 4:23.

## Disclosures

State these on screen, not only here.

- The title card says the narration is synthesized speech reading a written script.
- A label in the top right reads "Live: Avalanche Fuji and Filecoin Calibration" for the app segments and switches to "Mockup footage: design click-through, not the app" for the publishing segment.
- Any wait that outlasts its narration plays at 2x under the caption "Still waiting on the networks. Shown at 2x until they answer; times printed on screen are real." The verdict's `checked in Ns` is the unedited figure. `timeline.json` records how many windows were sped up and how many seconds that removed.
- All documents are synthetic. There is no 123 Main Street in Fairview County.

## Shot list

Viewport 1280 by 720, light theme, app served by `npm run dev`. Captions show the current narration line at the bottom of the frame.

### 1. Title card

Static card with the anchor line mark, repository address and the disclosures.

> Anchorline. Verifiable offchain records for a real-world asset on Avalanche. Everything here runs live on Avalanche Fuji and Filecoin Calibration, except one labelled segment. The narration is synthesized.

### 2. Asset

Open the app, click Asset. The record set loads from both chains while the line plays.

> This is FAIRVIEW-0031, a synthetic property record set. Avalanche holds one pointer per version: the manifest content identifier, its Filecoin piece, and a data set id. The manifest lists five records. Filecoin providers hold the bytes; Avalanche never stores a document.

### 3. Verify, live

Click Verify, then Verify now. Progress stays on screen for the whole read, 42 to 81 seconds in the takes so far. The three lines play at the start of the wait; any remainder shows the progress counter at 2x with the disclosure caption.

> Verify needs no wallet, no account, and no key. It reads the pointer from Avalanche, fetches the manifest and every record from Filecoin, re-hashes each one, and reads the storage proof state for the data set.

> Most of this wait is storage providers answering. Anchoring on Avalanche takes about four seconds. Storing a record takes about two minutes, which is why publishing is never live.

> The proof time you will see describes the data set a piece sits in, not each file.

When the verdict lands, scroll so the per-record table is in frame.

> Verified. Every record hashes to the content identifier the manifest lists, is retrievable, and sits in a data set with a current storage proof.

### 4. Check a document, both deeds

Click Check a document and choose `data/deed.pdf`. The lookup fetches each anchored version's manifest, newest first, and stops at the first match: 12 to 18 seconds in the takes so far. The doctored deed matches nothing, so it reads every version: 20 to 35 seconds.

> Now someone hands you a deed. Drop it in. It is hashed in the browser and never uploaded, then looked for in every version anchored on Avalanche.

> On record. This is deed.pdf, exactly as published.

Choose `data/deed-tampered.pdf`, the same deed with the owner line changed.

> The same deed with one name changed. Different fingerprint. Every version is searched again.

> Failed. No version anchored on Avalanche points at these bytes. This is tampering, not an update.

### 5. History

Click History. Version 2 is current, with its pointer and transaction. Open Inspect records on version 1 so the 2025 assessment is on screen.

> A legitimate change publishes a new version. Version 2 replaced the 2025 tax assessment with the 2026 one and kept the other four records. Version 1 is still there, with its own manifest and its own transaction. Nothing is overwritten.

### 6. Publishing, mockup footage

Open `mockup/index.html` at the Upload records screen. The label switches to mockup footage. Advance to Anchor the manifest and click Anchor to Avalanche during the second line, so the signing overlay lands with the words.

> This last part is the design mockup, not the app. Publishing is never live in a demo, because each record takes about two minutes to store. Every file is fingerprinted in the browser and stored on Filecoin as its own piece.

> The manifest is stored last. One Avalanche transaction anchors its content identifier, its piece, and the data set id, in about four seconds. The registry appends a version and never overwrites.

### 7. Closing card

Clone and verify commands, the no-key statement, and the bridge credit.

> Fork it. Clone the repository and run npm run verify to check the same asset yourself, with no key. It builds on the Avalanche and Filecoin data bridge from May 2025.

## Output

The recorder writes `anchorline-demo.mp4`, `poster.png`, `captions.vtt` and `timeline.json` to the output directory, `recording/` by default. `timeline.json` records when each line started in the finished picture, how long the live verification took, and the windows played at 2x; `npm run share -- recording` builds the share page from it and from `seed-output.json`, so the chapter times and identifiers on the page come from the take rather than from hand-typed values.
