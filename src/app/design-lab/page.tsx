import Link from "next/link";

const directions = [
  {
    id: "monolith",
    number: "01",
    name: "Monolith",
    thesis: "One decision, given the weight of an event.",
    shape: "Spatial briefing · architectural stage · directed attention",
  },
  {
    id: "instrument",
    number: "02",
    name: "Instrument",
    thesis: "Patterns made measurable and inspectable.",
    shape: "Calibrated channels · linked evidence · live inspection",
  },
  {
    id: "editorial",
    number: "03",
    name: "Editorial intelligence",
    thesis: "A chess development story worth reading.",
    shape: "Narrative spread · position dossier · considered pacing",
  },
] as const;

export default function DesignLabIndex() {
  return (
    <main className="axis-lab lab-index">
      <div className="lab-index-top">
        <span>AXIS / CREATIVE RESET</span>
        <span>THREE WORKING PROTOTYPES</span>
      </div>
      <div className="lab-index-heading">
        <p>Exploration 01—03</p>
        <h1>
          Three ways to
          <br />
          understand a move.
        </h1>
        <p>
          Each direction includes a landing page, a development fixture
          dashboard, and an interactive replay of the Immortal Game. All sample
          signals are labeled.
        </p>
      </div>
      <div className="lab-index-list">
        {directions.map((item) => (
          <Link href={`/design-lab/${item.id}/landing`} key={item.id}>
            <span>{item.number}</span>
            <div>
              <h2>{item.name}</h2>
              <p>{item.thesis}</p>
              <small>{item.shape}</small>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
      <div className="lab-index-foot">
        Independent design lab · production application unchanged
      </div>
    </main>
  );
}
