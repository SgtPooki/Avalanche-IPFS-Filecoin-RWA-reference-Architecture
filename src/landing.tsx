// Static sections of the reference-architecture page. app.tsx renders the
// live demo between `Above` and `Below`. No network reads in this file.

import type { ReactNode } from 'react'

export const REPO = 'https://github.com/SgtPooki/Avalanche-IPFS-Filecoin-RWA-reference-Architecture'
const CONTACT = 'https://filecoin.cloud/contact'

export function Above() {
  return (
    <>
      <section className="hero" id="top">
        <div>
          <div className="eyebrow">Filecoin × Avalanche · RWA reference architecture</div>
          <h1>Verifiable offchain data for tokenized real-world assets</h1>
          <p className="sub">
            Tokenized assets depend on deeds, certifications, appraisals, disclosures and other records that don't
            belong onchain. This reference architecture shows how Avalanche, IPFS and Filecoin can connect onchain
            assets to durable, content-addressed source records.
          </p>
          <div className="ctas">
            <a className="btn primary" href="#demo">Explore the demo</a>
            <a className="btn" href="#architecture">View the architecture</a>
          </div>
          <p className="fine">Working example, running live on Avalanche Fuji and Filecoin Calibration. No wallet needed to verify.</p>
        </div>
        <Flow />
      </section>

      <Section id="problem" title="The asset is onchain. Its source records usually aren't.">
        <p className="lede">
          Tokenizing an asset creates an onchain representation of ownership and transactions. But the information that
          establishes what that asset represents, such as deeds, title records, certifications and valuations, often
          remains in conventional databases and cloud storage.
        </p>
        <p className="lede">
          That leaves a simple infrastructure question: how can an application reference offchain records while allowing
          anyone to verify that the underlying data hasn't changed and remains available?
        </p>
      </Section>

      <Section id="architecture" title="A hybrid architecture for real-world assets" lede="Three networks, one job each. The result is a durable link between an onchain asset and the exact offchain data it represents.">
        <img
          className="diagram"
          src={`${import.meta.env.BASE_URL}rwa-architecture.svg`}
          alt="A source record such as a deed goes to IPFS, which outputs a CID; the bytes are persisted on Filecoin with storage proofs; an Avalanche application references the CID; anyone reads the CID from Avalanche, fetches the bytes from Filecoin and re-hashes them."
        />
        <div className="three">
          <Pillar tone="ipfs" name="IPFS" ask="Content-address the record" ans="A CID is derived from the bytes themselves. Change one byte and the CID changes. Output: a CID, a content identifier." />
          <Pillar tone="fil" name="Filecoin" ask="Persist the underlying data" ans="Storage providers hold the bytes and post cryptographic proofs that they still do. Output: verifiable storage." />
          <Pillar tone="ava" name="Avalanche" ask="Reference the CID from the asset" ans="The application records the CID alongside the asset or transaction. Output: onchain state anyone can read." />
        </div>
      </Section>

      <Section id="how" title="How it works" lede="Store → CID → persist → reference → verify.">
        <div className="steps">
          <Step n={1} title="Store the source record">An issuer adds an offchain asset record such as a deed, appraisal or certification.</Step>
          <Step n={2} title="Create a content-addressed reference">IPFS generates a CID derived from the content itself. If the record changes, its CID changes too.</Step>
          <Step n={3} title="Persist it on Filecoin">The referenced data is stored on Filecoin, giving durable storage backed by cryptographic proofs.</Step>
          <Step n={4} title="Reference it from Avalanche">The application records the CID alongside the relevant asset or transaction on Avalanche.</Step>
          <Step n={5} title="Verify independently">A third party retrieves the record and checks that it matches the CID the application referenced.</Step>
        </div>
      </Section>
    </>
  )
}

export function Below() {
  return (
    <>
      <Section id="tamper" title="What happens if the record changes?" lede="Because the CID is derived from the content, changing the underlying record produces a different identifier. Applications can verify that the retrieved document is the exact record originally referenced.">
        <div className="teaser">
          <div className="box">
            <div className="lab">Original document</div>
            <div>deed.pdf</div>
            <div className="line">bafkreidh5qsi5z6uo2thzvynr27ioajoviafqiveunrielhugyj65l6rzu</div>
          </div>
          <div className="neq">≠</div>
          <div className="box bad">
            <div className="lab">Owner line edited</div>
            <div>deed-tampered.pdf</div>
            <div className="line">bafkreiausintabvl4n4hvgv2jdmazvy35bg26gku2ufu2bosxhrd7dzxqi</div>
          </div>
        </div>
        <p className="where-note">
          Try it: open <a href="#demo">Check a document</a> and drop in <a href={`${REPO}/raw/main/data/deed.pdf`}>deed.pdf</a> or the{' '}
          <a href={`${REPO}/raw/main/data/deed-tampered.pdf`}>edited copy</a>. The file is hashed in your browser and never uploaded.
        </p>
      </Section>

      <Section id="layers" title="What each layer provides" lede="Verification here means the content matches its CID and was persisted. None of these layers judges whether a deed is legitimate.">
        <div className="ledger">
          <Row what="Avalanche">Asset state, transactions and the onchain reference</Row>
          <Row what="IPFS">Content addressing and integrity verification</Row>
          <Row what="Filecoin">Durable storage backed by cryptographic proofs</Row>
          <Row what="Application">Connects the onchain asset to its underlying records</Row>
        </div>
      </Section>

      <Section id="why" title="Built for assets that depend on offchain truth" lede="Real-world assets often depend on supporting data that cannot or should not be stored directly onchain. A content-addressed storage layer links the asset to those records without asking the blockchain to hold them.">
        <div className="three">
          <Pillar name="Integrity" ask="Know whether the record changed" ans="The CID is the fingerprint. Any edit, however small, produces a different one." />
          <Pillar name="Persistence" ask="Outlive any one database" ans="Storage is proven on Filecoin rather than trusted to a single application or cloud account." />
          <Pillar name="Portability" ask="Reference it anywhere" ans="The same CID works across applications, chains and infrastructure." />
        </div>
      </Section>

      <Section id="example" title="Example: tokenized real estate">
        <p className="lede">
          A tokenized property references many offchain records over its lifetime: deeds, parcel data, appraisals,
          inspections, certifications and disclosures. Rather than placing those documents onchain, an RWA platform can
          content-address them with IPFS, persist them on Filecoin, and reference their CIDs from its Avalanche application.
        </p>
        <p className="where-note">This reference implementation was developed to explore architectures for real-world asset platforms building on Avalanche.</p>
      </Section>

      <Section id="build" title="Build this pattern" lede="Explore the implementation, run the demo, or adapt the architecture for your own RWA application.">
        <div className="actions" style={{ marginTop: 0 }}>
          <a className="btn primary" href={REPO}>View on GitHub</a>
          <a className="btn" href={`${REPO}#what-the-issuer-publishes`}>Architecture</a>
          <a className="btn" href={`${REPO}#verify-the-example`}>Run the demo</a>
          <a className="btn" href={`${REPO}#fork-map`}>Implementation guide</a>
        </div>
        <p className="where-note">
          Verify from a terminal with no key: <code>git clone {REPO}.git && cd Avalanche-IPFS-Filecoin-RWA-reference-Architecture && npm ci && npm run verify</code>
        </p>
      </Section>

      <Section id="cta" title="Building real-world assets on Avalanche?" lede="We're looking for RWA teams interested in applying this architecture to production data and helping shape the next generation of Filecoin + IPFS tooling.">
        <div className="actions" style={{ marginTop: 0 }}>
          <a className="btn primary" href={CONTACT}>Talk to the Filecoin team</a>
          <a className="btn" href={REPO}>View the implementation</a>
        </div>
      </Section>

      <Section id="about" title="About this demo">
        <p className="where-note">
          This open-source demo application was created to illustrate the reference architecture. It builds on the{' '}
          <a href="https://www.avalanche.com/about/blog/avalanche-and-filecoin-launch-cross-chain-data-bridge-for-scalable-web3">
            Avalanche and Filecoin data bridge
          </a>{' '}
          announced in May 2025. The property in the example is synthetic.
        </p>
      </Section>
    </>
  )
}

/** The four-box diagram from the campaign brief, as HTML until a designed graphic replaces it. */
function Flow() {
  return (
    <div className="ledger" aria-label="Architecture: source record to IPFS to Filecoin, referenced from Avalanche">
      <Row what="RWA source record">Deed · title · appraisal · certification · disclosure</Row>
      <Row what="↓ IPFS">Content-address the record → CID</Row>
      <Row what="↓ Filecoin">Persist the bytes → verifiable storage</Row>
      <Row what="↕ Avalanche">Reference the CID from the asset → onchain state</Row>
    </div>
  )
}

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section className="land-sec" id={id}>
      <h2>{title}</h2>
      {lede != null && <p className="lede">{lede}</p>}
      {children}
    </section>
  )
}

function Pillar({ tone, name, ask, ans }: { tone?: 'ava' | 'fil' | 'ipfs'; name: string; ask: string; ans: string }) {
  return (
    <div className={tone == null ? 'pillar' : `pillar ${tone}`}>
      <div className="eyebrow">{name}</div>
      <div className="ask">{ask}</div>
      <div className="ans">{ans}</div>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="step">
      <div className="mono dim">{n}</div>
      <div>
        <h3>{title}</h3>
        <p className="sub">{children}</p>
      </div>
    </div>
  )
}

function Row({ what, children }: { what: string; children: ReactNode }) {
  return (
    <div className="row">
      <div className="what">{what}</div>
      <div className="gap">{children}</div>
    </div>
  )
}
