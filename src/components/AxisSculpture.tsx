import Image from "next/image";

/** A purpose-made industrial render anchors the AXIS identity in a physical material. */
export default function AxisSculpture() {
  return <figure className="axis-sculpture" aria-hidden="true">
    <Image src="/media/axis-orbital-titanium.png" alt="" width={1254} height={1254} priority />
  </figure>;
}
