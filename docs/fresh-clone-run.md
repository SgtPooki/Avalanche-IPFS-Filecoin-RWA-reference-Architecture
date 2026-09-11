# Fresh-clone run, 2026-09-11

A forker can verify the demo asset in under a minute from a fresh clone and publish their own two-version asset in about 14 minutes on top of that, given an already funded account. Faucet time is not in these numbers. Both halves were run once, from a clone in a temporary directory, on the evening of 2026-09-11 UTC.

## Environment

- macOS 26.6.2, Apple silicon (arm64)
- Node.js v26.2.0, npm 11.13.0
- npm cache warm from earlier installs on the same machine, so `npm ci` is not a cold-download number
- Clone at `67b1667` for the no-key half; pulled to `d8d747f` before the funded half. The difference is the verifier exit fix described under Limitations.

## No-key verification

| Step | Command | Wall time |
| --- | --- | --- |
| Clone | `git clone https://github.com/SgtPooki/anchorline.git` | 1.3 s |
| Install | `npm ci` | 6.1 s |
| Verify the demo asset | `npm run verify` | 44 s (printed `VERIFIED in 42.7s`) |
| Verify again after the exit fix | `npm run verify` | 45 s (printed `VERIFIED in 43.3s`, on the published asset below) |
| Refuse the doctored deed | `npm run verify -- CLONE-0911 --file data/deed-tampered.pdf` | 21 s, exit status 1 |
| Find the real deed | `npm run verify -- CLONE-0911 --file data/deed.pdf` | 20 s, `on record as deed.pdf, version 2` |

Clone to verdict: about 52 seconds. No `.env`, no key, no funds.

## Funded publishing

The funded demo account's key was copied into the clone's gitignored `.env`. The asset id was set so the run would neither append to the shared demo asset nor touch this checkout's `seed-output.json`.

| Step | Command | Wall time |
| --- | --- | --- |
| Publish two versions | `npm run seed -- --asset-id=CLONE-0911` | 742 s (printed `Seeded in 12.3 min`) |
| Verify the new asset | `npm run verify -- CLONE-0911` | 45 s |

Inside the seed run, per the script's own output:

- Version 1, five records stored one after another: 105 s, 92 s, 90 s, 88 s, 91 s. Then the manifest, then the anchor transaction, confirmed at 561 s.
- Version 2 reused the four unchanged pieces from version 1 without uploading them, stored `tax-assessment-2026.pdf` and a new manifest, and anchored at 742 s.
- Both versions landed in Calibration data set 54, the same data set as the demo asset, because it is the same account. That is why the new records reported a last proof about an hour old the moment they were verified: proof state belongs to the data set.

Anchoring transactions, on Fuji: [version 1](https://testnet.snowtrace.io/tx/0xce6867ceb09089b00e52b9f6046507a3b476a163ccb476020f1d9e045c0003d7) at block 58324944 and [version 2](https://testnet.snowtrace.io/tx/0x68ab0302ba946dc7c12e08f0da433a122d33270784bca2f934d5622429cc56ef) at block 58324972.

## Against the 30-minute target

Clone, install, publish two versions and verify them: about 14 minutes, of which 12.4 minutes is storage providers accepting uploads. The no-key path alone is under a minute.

What the target does not include, and this run did not measure: getting test AVAX on Fuji and tFIL plus USDFC on Calibration into a new account. Reusing the funded demo account is not a first-time faucet experience. Faucets sit outside this repository and their rate limits, captchas and availability change. A first-time forker should plan the funding step before the 30 minutes start, using the links in the README.

## Limitations

- One run each. Provider response times move: earlier verifications ranged from 43 to 85 seconds, and the storage per record from 88 to 128 seconds.
- The first no-key verification printed its verdict at 44 seconds and then kept running; the process was killed after ten minutes. The cause was open sockets left behind by retrieval, and `scripts/verify.ts` now exits once the verdict has flushed (`d8d747f`). The 45 second figure is from after that fix.
- The clone's `npm ci` hit a warm local cache. A cold install downloads 542 packages and depends on the connection.
- The clone verified the demo asset under the default publisher, then its own asset by passing the id explicitly. The CLI defaults to the shared demo publisher; a forker with their own account passes both the asset id and the address.
