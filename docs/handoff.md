# Handoff

You are finishing anchorline, a forkable worked example for the Avalanche Summit in New York, Sept 16-17 2026. The recording must exist by the evening of Tuesday Sept 15. Repo: `/Users/sgtpooki/code/work/filoz/sgtpooki/anchorline`, public at `https://github.com/SgtPooki/anchorline`, branch `main`.

Read these first and treat them as settled: `docs/build-plan.md` (deliverables, architecture decisions, identity, writing rules, order of work, what changed since the plan, and a "Where it stands" section), `README.md`, `contracts/README.md`, `mockup/index.html` with its design-notes drawer, and `.research/` for local-only background that must never be quoted in public text.

## What already works, proven live

Do not rebuild any of this. It has run against real testnets, not in theory.

- The CID a browser computes for a file equals the CID filecoin-pin uploads it under, pinned against a CID built from the CID and multihash specs rather than against another library.
- Storing, fetching and proving on Filecoin Calibration. `npm run spike:calibration`.
- Anchoring and reading history on Avalanche Fuji. `npm run spike:fuji`.
- Downloading a record from Calibration inside a browser. `npm run spike:browser`.
- The demo asset is seeded on both chains with two versions. `seed-output.json` is committed and the app reads it.
- End to end verification, read-only and with no key. `npm run verify` prints a per-record table and a verdict.
- The tamper check both ways. `npm run verify -- FAIRVIEW-0031 --file data/deed-tampered.pdf` is refused; the real deed is found on record.
- The app has four screens, Asset, Verify, Check a document and History, all against live chains.
- 148 tests across four vitest projects: `node`, `browser` (playwright chromium), `profile`, `files`.

The demo asset is `FAIRVIEW-0031` under `0x44f08D1beFe61255b3C3A349C392C560FA333759`. The registry is `0x7fdfdb7F166A3dEE947A5533e20B8E5Ce8c80863` on Fuji, deployed at block 58303958. Do not redeploy it and do not change `AssetRecordRegistry.sol`.

## Timings that decide the demo

Measured, not estimated. They are why the demo is shaped the way it is.

- Anchoring on Avalanche: about 4 seconds. Can be live.
- Verifying: 43 to 85 seconds, most of it storage providers answering. Live, with progress on screen.
- Storing one record on Filecoin: about 2 minutes. Never live. Seeding takes about 12 minutes.

## What is done since this was written

Everything the original list asked for is done and pushed. Details live in the files named.

1. README rewritten as the fork guide, with the fork map and `docs/architecture.svg` embedded.
2. Asset and History screens, live and read-only. The issuer upload flow stays in the mockup by decision.
3. `docs/demo-script.md` and `scripts/record-demo.mjs`, which records headlessly with synthesized narration. `npm run share -- recording` wraps the take, reading chapter times from the take's `timeline.json`.
4. The architecture diagram.
5. The timed fresh-clone run, in `docs/fresh-clone-run.md`.

The verifier used to keep running after printing its verdict; `scripts/verify.ts` now exits once the last line has flushed. If a wall-clock timing differs from the printed one by minutes again, that is the place to look.

## Hard rules

- Every piece of prose goes through the writing gate before it is done: `python3 ~/.claude/skills/writing-core/scripts/writingcheck.py <scenario> <file> --overlay my-voice`, with `writing-docs` for docs, `github-writing` for commits, issues and PRs, `writing-marketing` for landing and README copy. Run the `anti-slop` skill on code, and the `unit-test-quality` skill on any unit test.
- No em-dashes, no emoji, sentence case.
- Commit messages are subject and body only. No trailers, no tool or model attribution, no claude.ai URLs.
- Never use the Artifact tool. Never open files, apps or browser windows on this Mac. Headless playwright is fine and is how everything visual has been checked.
- The demo key is `PRIVATE_KEY_MAIN` in `/Users/sgtpooki/code/work/filoz/filecoin-project/filecoin-pin/.env`. It is already copied to a gitignored `.env` here. Never commit it.
- Research before implementing. Every significant decision so far was checked against primary sources or a live run first.
- Verify claims by running them. Several confident-sounding explanations turned out to be wrong on inspection; assume yours might be too, and say which parts are hypotheses.

## Positioning, settled with the team on 2026-09-11

The audience is Avalanche RWA issuers in general, not any one company. Market it as RWAs on Avalanche, and make it legible as how to use IPFS and Filecoin for real-world asset records anywhere. Do not aim copy at any single issuer, do not speak for their architecture, and do not assume what they already store. An issuer who already content-addresses their documents should see the part they are missing, which is proof that the bytes are still there and an audit anyone can run. An issuer pointing at a URL should see the whole pattern. The copy has to work for both.

Credit the May 2025 Avalanche and Filecoin bridge, never claim to be first, never grade the earlier work. "Built on Avalanche" wording, no Avalanche or Filecoin logos. Fuji C-Chain stays the demo network: the contract is plain EVM and runs on an Avalanche L1 unchanged, but a private L1 would break the claim, because nobody watching could check anything on it.

## Gotchas already paid for

Each of these cost real time. Do not rediscover them.

- **CID objects do not cross package boundaries.** `@ipld/car` resolves multiformats 14 while `@helia/unixfs` nests 13, so a CID from one fails the other's `instanceof` check and surfaces as the error "Path must be string or CID." Pass CIDs as strings. `src/lib/car.ts` has a test named after this.
- **viem caches `getBlockNumber`** for its polling interval, and `waitForTransactionReceipt` warms that cache, so a history read straight after an anchor silently misses the newest version. Reads pass `cacheTime: 0`.
- **Several Calibration providers are dead.** Three of eight hostnames do not resolve at all, so the SDK's retrieval race can exhaust on a piece two other providers serve instantly. `fetchRecord` reads proof state first and falls back to the provider `pieceStatus` names.
- **`filecoin-pin add` cannot upload anything right now.** It runs a minimum setup check with a file size of zero and the cost calculation rejects a zero piece size. Filed as `filecoin-project/filecoin-pin#719`. Use `npm run publish -- <dir>`, which goes through the library instead.
- **`pdp.vxb.ai` is stale.** filecoin-pin still prints it; it redirects to `pdp.filecoin.cloud/mainnet` and discards the path, so a piece link through it lands on the wrong network. Use `pdp.filecoin.cloud/calibration/piece/<pieceCid>`.
- **Snowtrace serves a bot challenge** to curl and to headless browsers. A 403 there does not mean a broken link.
- **The registry appends and never overwrites.** Seeding an asset that already has versions adds more, so `npm run seed` refuses a used id unless given `--append` or `--asset-id=`.
- **inbrowser.link needs a real browser**, not curl, which gets 403.

## Known gate exception

`anti-slop` duplication fails and has for most of the project: about 140 clone lines against an 18-line baseline. It was measured rather than assumed. The clones are literal test tables, which the `unit-test-quality` skill requires, plus the hand-written ABI and the synthetic document content. Four real refactors were done for it. Erosion and complexity are at zero and should stay there; if erosion rises, that one is real and worth fixing.

## Loose ends

- `anchorline.goatcounter.com` does not exist yet, so the telemetry wired into the mockup records nothing until someone creates that account.
- A second upstream issue is worth filing for the stale `pdp.vxb.ai` URL.
- Verify time varies between 43 and 85 seconds. A bounded concurrency pool over records would tighten it.
