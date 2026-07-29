export default function Cosmos3D() {
  return (
    <div className="cosmos3d pointer-events-none fixed inset-0 -z-10">
      {/* deep star layer (slow) */}
      <div className="layer stars stars-deep" aria-hidden />
      {/* mid star layer (medium) */}
      <div className="layer stars stars-mid" aria-hidden />
      {/* near star layer (faster, brighter twinkle) */}
      <div className="layer stars stars-near" aria-hidden />
      {/* soft nebula/galaxy swirl */}
      <div className="layer nebula" aria-hidden />
      {/* center glow behind the sun (viewport center) */}
      <div className="layer sun-glow" aria-hidden />
      {/* vignette + film grain */}
      <div className="layer vignette" aria-hidden />
      <div className="layer grain" aria-hidden />
    </div>
  );
}
