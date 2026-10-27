/** Original AXIS orbital geometry. Static SVG keeps the hero light and crisp. */
export default function AxisSculpture() {
  return <div className="axis-sculpture" aria-hidden="true">
    <svg viewBox="0 0 800 680" fill="none">
      <defs>
        <linearGradient id="axis-metal" x1="160" y1="120" x2="610" y2="540" gradientUnits="userSpaceOnUse">
          <stop stopColor="#394042"/><stop offset=".17" stopColor="#ecf0e9"/><stop offset=".25" stopColor="#626b6a"/><stop offset=".35" stopColor="#111516"/><stop offset=".51" stopColor="#c4cbc5"/><stop offset=".57" stopColor="#f3f4ed"/><stop offset=".62" stopColor="#53605c"/><stop offset=".8" stopColor="#141a1a"/><stop offset=".94" stopColor="#9ca9a1"/>
        </linearGradient>
        <linearGradient id="axis-edge" x1="200" y1="120" x2="560" y2="580" gradientUnits="userSpaceOnUse"><stop stopColor="#f1f2e9"/><stop offset=".32" stopColor="#4a5652"/><stop offset=".68" stopColor="#111615"/><stop offset="1" stopColor="#c2cec2"/></linearGradient>
        <linearGradient id="axis-core" x1="350" y1="200" x2="450" y2="440" gradientUnits="userSpaceOnUse"><stop stopColor="#d9e2d5"/><stop offset=".42" stopColor="#748b65"/><stop offset=".6" stopColor="#26372c"/><stop offset="1" stopColor="#b3ca8e"/></linearGradient>
      </defs>
      <g className="axis-sculpture-orbit">
        <ellipse cx="400" cy="345" rx="305" ry="220" stroke="currentColor" strokeOpacity=".12" strokeDasharray="2 9" transform="rotate(-26 400 345)"/>
        <path d="M72 345h656M400 38v606" stroke="currentColor" strokeOpacity=".08"/>
        <ellipse cx="400" cy="345" rx="230" ry="91" transform="rotate(-35 400 345)" stroke="#090e0d" strokeWidth="36"/>
        <ellipse cx="400" cy="345" rx="230" ry="91" transform="rotate(-35 400 345)" stroke="url(#axis-metal)" strokeWidth="29"/>
        <ellipse cx="400" cy="345" rx="230" ry="91" transform="rotate(-35 400 345)" stroke="url(#axis-edge)" strokeWidth="1.2"/>
        <ellipse cx="400" cy="345" rx="230" ry="91" transform="rotate(80 400 345)" stroke="#090e0d" strokeWidth="36"/>
        <ellipse cx="400" cy="345" rx="230" ry="91" transform="rotate(80 400 345)" stroke="url(#axis-metal)" strokeWidth="29"/>
        <ellipse cx="400" cy="345" rx="230" ry="91" transform="rotate(80 400 345)" stroke="url(#axis-edge)" strokeWidth="1.2"/>
        <ellipse cx="400" cy="345" rx="230" ry="91" transform="rotate(24 400 345)" stroke="#090e0d" strokeWidth="36"/>
        <ellipse cx="400" cy="345" rx="230" ry="91" transform="rotate(24 400 345)" stroke="url(#axis-metal)" strokeWidth="29"/>
        <ellipse cx="400" cy="345" rx="230" ry="91" transform="rotate(24 400 345)" stroke="url(#axis-edge)" strokeWidth="1.2"/>
        <path d="M267 492C169 489 167 409 267 326" stroke="url(#axis-metal)" strokeWidth="29"/>
        <path d="M389 116C422 108 459 160 474 232" stroke="url(#axis-metal)" strokeWidth="29"/>
        <path d="m400 299 41 24v47l-41 24-41-24v-47l41-24Z" fill="url(#axis-core)" stroke="#a6b29e" strokeWidth=".7"/>
        <path d="m359 323 41 24 41-24M400 347v47" stroke="#d5dfc9" strokeOpacity=".5"/>
        <circle cx="165" cy="515" r="4" fill="currentColor"/><path d="m165 515 75-51" stroke="currentColor" strokeOpacity=".4"/>
        <path d="M627 151h30m-15-15v30M143 285h22m-11-11v22" stroke="currentColor" strokeOpacity=".5"/>
      </g>
    </svg>
  </div>;
}
