// components/ui/SpeedingCarLoader.jsx
import React from 'react';

export default function SpeedingCarLoader({ size = 'medium', style = {} }) {
  let width = 180;
  let height = 55;

  if (typeof size === 'number') {
    width = size;
    height = Math.round((size / 520) * 160);
  } else if (size === 'large') {
    width = 260;
    height = 80;
  } else if (size === 'small' || size === 'sm') {
    width = 110;
    height = 34;
  } else if (size === 'xs') {
    width = 80;
    height = 25;
  } else {
    // medium (default)
    width = 180;
    height = 55;
  }

  return (
    <div className="supercar-loader-wrapper" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      width: '100%',
      maxWidth: width,
      overflow: 'visible',
      userSelect: 'none',
      pointerEvents: 'none',
      ...style
    }}>
      <svg
        viewBox="0 0 520 160"
        width="100%"
        height={height}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Supercar Paint Gradients */}
          <linearGradient id="hypercarBodyLeft" x1="100%" y1="0%" x2="0%" y2="20%">
            <stop offset="0%" stopColor="#022c22" />
            <stop offset="25%" stopColor="#065f46" />
            <stop offset="60%" stopColor="#059669" />
            <stop offset="85%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>

          <linearGradient id="cockpitGlassLeft" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#064e3b" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.7" />
          </linearGradient>

          <linearGradient id="nitroFlameRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="40%" stopColor="#10b981" stopOpacity="0.85" />
            <stop offset="75%" stopColor="#059669" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="headlightLaserLeft" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.9" />
            <stop offset="30%" stopColor="#34d399" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="groundNeonLeft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="speedWindFastRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>

          <filter id="superGlowLeft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <style>{`
          /* Continuous uninterrupted high-speed engine vibration & aerodynamic lift */
          @keyframes continuousEngineVibe {
            0% { transform: translateY(0px) rotate(0deg); }
            25% { transform: translateY(-0.8px) rotate(-0.15deg); }
            50% { transform: translateY(0.4px) rotate(0.1deg); }
            75% { transform: translateY(-0.5px) rotate(-0.1deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }

          /* Continuous forward speed thrust without any pauses or jerks */
          @keyframes continuousForwardThrust {
            0% { transform: translateX(0px); }
            50% { transform: translateX(-8px); }
            100% { transform: translateX(0px); }
          }

          /* Rapid seamless road speed stripes flowing backwards (to the right) */
          @keyframes continuousRoadFlow {
            0% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: 240; }
          }

          /* Continuous seamless wind trails shooting to the right */
          @keyframes continuousWindRush {
            0% { transform: translateX(-80px); opacity: 0; }
            15% { opacity: 0.95; }
            85% { opacity: 0.9; }
            100% { transform: translateX(180px); opacity: 0; }
          }

          /* High-velocity continuous counter-clockwise wheel rotation */
          @keyframes continuousWheelSpinLeft {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(-360deg); }
          }

          /* Continuous blazing nitro fire pulse */
          @keyframes continuousNitroPulse {
            0%, 100% { transform: scaleX(0.9) scaleY(0.95); opacity: 0.75; }
            50% { transform: scaleX(1.35) scaleY(1.1); opacity: 1; filter: drop-shadow(0 0 10px #34d399); }
          }

          /* Laser headlight beam intensity */
          @keyframes continuousLaserBeam {
            0%, 100% { opacity: 0.55; }
            50% { opacity: 0.9; }
          }

          .continuous-car-group {
            animation: continuousForwardThrust 0.8s ease-in-out infinite;
          }

          .continuous-vibe-group {
            animation: continuousEngineVibe 0.12s linear infinite;
          }

          .road-continuous-main {
            stroke-dasharray: 24, 18;
            animation: continuousRoadFlow 0.18s linear infinite;
          }

          .road-continuous-glow {
            stroke-dasharray: 45, 30;
            animation: continuousRoadFlow 0.12s linear infinite;
          }

          .wind-continuous-1 { animation: continuousWindRush 0.28s linear infinite; }
          .wind-continuous-2 { animation: continuousWindRush 0.22s linear infinite 0.06s; }
          .wind-continuous-3 { animation: continuousWindRush 0.32s linear infinite 0.12s; }
          .wind-continuous-4 { animation: continuousWindRush 0.25s linear infinite 0.03s; }
          .wind-continuous-5 { animation: continuousWindRush 0.19s linear infinite 0.09s; }

          .wheel-left-front {
            animation: continuousWheelSpinLeft 0.14s linear infinite;
            transform-origin: 145px 108px;
          }

          .wheel-left-back {
            animation: continuousWheelSpinLeft 0.14s linear infinite;
            transform-origin: 355px 108px;
          }

          .continuous-nitro {
            animation: continuousNitroPulse 0.18s ease-in-out infinite;
            transform-origin: 412px 98px;
          }

          .continuous-laser-headlight {
            animation: continuousLaserBeam 0.35s ease-in-out infinite;
            transform-origin: 80px 88px;
          }
        `}</style>

        {/* ── 1. GROUND TRACK & NEON UNDERGLOW ── */}
        <g>
          {/* Glowing Green Under-Chassis Neon Reflection on Asphalt */}
          <ellipse cx="250" cy="126" rx="170" ry="12" fill="url(#groundNeonLeft)" opacity="0.9" filter="url(#superGlowLeft)" />

          {/* Road Speed Lines (Rapidly flying to the right) */}
          <line x1="10" y1="124" x2="510" y2="124" stroke="rgba(16, 185, 129, 0.25)" strokeWidth="1.5" />
          <line x1="0" y1="124" x2="520" y2="124" stroke="#10b981" strokeWidth="3" strokeLinecap="round" className="road-continuous-main" />
          <line x1="20" y1="130" x2="500" y2="130" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" className="road-continuous-glow" opacity="0.9" />
          <line x1="50" y1="136" x2="470" y2="136" stroke="#059669" strokeWidth="1" strokeLinecap="round" className="road-continuous-main" opacity="0.5" />
        </g>

        {/* ── 2. SPEED WIND STREAKS STREAMING CONTINUOUSLY TO THE RIGHT ── */}
        <g>
          {/* Upper Aerodynamic Wind Trails */}
          <path d="M 340 32 L 500 32" stroke="url(#speedWindFastRight)" strokeWidth="2.5" strokeLinecap="round" className="wind-continuous-1" />
          <path d="M 290 22 L 480 22" stroke="url(#speedWindFastRight)" strokeWidth="1.5" strokeLinecap="round" className="wind-continuous-3" />
          <path d="M 360 44 L 520 44" stroke="url(#speedWindFastRight)" strokeWidth="2" strokeLinecap="round" className="wind-continuous-2" />

          {/* Middle Body Wind Lines */}
          <path d="M 390 68 L 550 68" stroke="url(#speedWindFastRight)" strokeWidth="3.5" strokeLinecap="round" className="wind-continuous-5" />
          <path d="M 410 82 L 560 82" stroke="url(#speedWindFastRight)" strokeWidth="4" strokeLinecap="round" className="wind-continuous-1" />

          {/* Lower Speed Streaks */}
          <path d="M 400 98 L 570 98" stroke="url(#speedWindFastRight)" strokeWidth="4.5" strokeLinecap="round" className="wind-continuous-4" />
          <path d="M 380 114 L 490 114" stroke="url(#speedWindFastRight)" strokeWidth="2.5" strokeLinecap="round" className="wind-continuous-2" />
        </g>

        {/* ── 3. SUPERCAR BODY & CHASSIS (FACING LEFT, CONTINUOUS HIGH SPEED) ── */}
        <g className="continuous-car-group">
          <g className="continuous-vibe-group">

            {/* Laser Headlight Forward Beam (Illuminating LEFT side road) */}
            <polygon points="85,84 0,72 0,102 85,92" fill="url(#headlightLaserLeft)" className="continuous-laser-headlight" />
            <ellipse cx="80" cy="88" rx="8" ry="4" fill="#a7f3d0" filter="url(#superGlowLeft)" />

            {/* Dual Turbo Nitro Flames Blasting to the RIGHT from Rear Exhaust */}
            <path
              d="M 412 96 L 500 92 L 460 98 L 510 102 L 455 104 L 412 100 Z"
              fill="url(#nitroFlameRight)"
              className="continuous-nitro"
              filter="url(#superGlowLeft)"
            />

            {/* Underbody Shadow */}
            <ellipse cx="250" cy="120" rx="150" ry="7" fill="#022c22" opacity="0.65" />

            {/* Giant GT Carbon Fiber Rear Spoiler Wing (on the right) */}
            <path d="M 416 62 L 398 62 L 405 76 L 412 76 Z" fill="#090d16" />
            <path d="M 392 62 L 376 62 L 382 76 L 390 76 Z" fill="#090d16" />
            {/* Spoiler Main Wing Blade */}
            <path d="M 428 56 L 362 54 L 366 60 L 432 62 Z" fill="#0f172a" stroke="#10b981" strokeWidth="1" />
            {/* Spoiler Endplate */}
            <polygon points="434,50 424,52 428,68 436,66" fill="#064e3b" stroke="#34d399" strokeWidth="1" />

            {/* ── SUPERCAR MAIN BODYWORK (Aggressive Hypercar Silhouette Facing Left) ── */}
            <path
              d="M 412 102 
                 L 385 102 
                 A 30 30 0 0 0 325 102 
                 L 175 102 
                 A 30 30 0 0 0 115 102 
                 L 78 100 
                 C 65 98, 60 92, 65 86 
                 C 72 78, 90 74, 120 70 
                 C 155 65, 185 44, 240 44 
                 C 300 44, 340 54, 380 68 
                 C 400 75, 412 88, 412 102 Z"
              fill="url(#hypercarBodyLeft)"
              stroke="#047857"
              strokeWidth="1.5"
            />

            {/* Aerodynamic Cockpit Glass / Canopy (Facing Left) */}
            <path
              d="M 330 66 
                 C 300 50, 265 46, 215 46 
                 C 180 46, 155 58, 135 68 
                 L 210 68 
                 L 325 68 Z"
              fill="url(#cockpitGlassLeft)"
              stroke="#090d16"
              strokeWidth="1.5"
            />

            {/* Windshield Reflection Highlights */}
            <path
              d="M 210 49 
                 C 185 50, 165 58, 150 65 
                 L 170 65 
                 C 185 58, 202 52, 225 50 Z"
              fill="#a7f3d0"
              opacity="0.8"
            />

            {/* Hypercar Side Aerodynamic Blade & Air Scoop */}
            <path
              d="M 380 92 
                 C 340 90, 310 76, 260 74 
                 C 200 72, 140 82, 90 88 
                 L 105 94 
                 C 155 88, 205 82, 265 84 
                 C 325 86, 360 98, 382 98 Z"
              fill="#ffffff"
              opacity="0.95"
            />

            {/* Emerald Racing Stripe Accent */}
            <path
              d="M 365 88 
                 C 320 85, 280 73, 225 73 
                 C 175 73, 135 82, 105 86 
                 L 120 90 
                 C 160 84, 195 78, 235 78 
                 C 290 78, 335 90, 365 88 Z"
              fill="#34d399"
            />

            {/* Carbon Fiber Side Air Intake Vent */}
            <polygon points="290,76 255,68 235,86 275,92" fill="#090d16" stroke="#064e3b" strokeWidth="1" />
            <polygon points="282,78 260,72 244,86 270,90" fill="#022c22" />

            {/* Carbon Front Splitter / Canards (Low front lip on left) */}
            <path d="M 85 98 L 60 97 L 68 104 L 92 104 Z" fill="#090d16" stroke="#10b981" strokeWidth="1" />

            {/* Razor Sharp Laser Headlight (on left) */}
            <polygon points="100,82 78,86 90,90 105,86" fill="#6ee7b7" filter="url(#superGlowLeft)" />
            <polygon points="96,83 82,86 92,89 101,86" fill="#ffffff" />

            {/* Tail Light Strip (on right) */}
            <path d="M 412 82 L 402 80 L 404 86 L 413 88 Z" fill="#ef4444" filter="url(#superGlowLeft)" />

            {/* ── 4. HIGH PERFORMANCE RACING WHEELS (CONTINUOUS VELOCITY ROTATION) ── */}

            {/* FRONT WHEEL (Left Side) */}
            <g className="wheel-left-front">
              {/* Low-profile slick tire */}
              <circle cx="145" cy="108" r="22" fill="#090d16" stroke="#1e293b" strokeWidth="2.5" />
              <circle cx="145" cy="108" r="16" fill="#0f172a" />

              {/* Emerald Caliper Brake Disc */}
              <circle cx="145" cy="108" r="13" fill="#1e293b" stroke="#34d399" strokeWidth="1.5" />
              <path d="M 138 98 A 12 12 0 0 1 152 98 L 150 102 A 8 8 0 0 0 140 102 Z" fill="#10b981" filter="url(#superGlowLeft)" />

              {/* Hypercar 5-Spoke Alloy Rims */}
              <circle cx="145" cy="108" r="12" stroke="#6ee7b7" strokeWidth="1.5" fill="none" />
              <line x1="145" y1="96" x2="145" y2="120" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <line x1="133" y1="108" x2="157" y2="108" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <line x1="136" y1="99" x2="154" y2="117" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
              <line x1="136" y1="117" x2="154" y2="99" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />

              {/* Center Lock Sport Hub */}
              <circle cx="145" cy="108" r="5" fill="#059669" stroke="#34d399" strokeWidth="1" />
            </g>

            {/* REAR WHEEL (Right Side) */}
            <g className="wheel-left-back">
              {/* Low-profile slick tire */}
              <circle cx="355" cy="108" r="22" fill="#090d16" stroke="#1e293b" strokeWidth="2.5" />
              <circle cx="355" cy="108" r="16" fill="#0f172a" />

              {/* Emerald Caliper Brake Disc */}
              <circle cx="355" cy="108" r="13" fill="#1e293b" stroke="#34d399" strokeWidth="1.5" />
              <path d="M 348 98 A 12 12 0 0 1 362 98 L 360 102 A 8 8 0 0 0 350 102 Z" fill="#10b981" filter="url(#superGlowLeft)" />

              {/* Hypercar 5-Spoke Alloy Rims */}
              <circle cx="355" cy="108" r="12" stroke="#6ee7b7" strokeWidth="1.5" fill="none" />
              <line x1="355" y1="96" x2="355" y2="120" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <line x1="343" y1="108" x2="367" y2="108" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <line x1="346" y1="99" x2="364" y2="117" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
              <line x1="346" y1="117" x2="364" y2="99" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />

              {/* Center Lock Sport Hub */}
              <circle cx="355" cy="108" r="5" fill="#059669" stroke="#34d399" strokeWidth="1" />
            </g>

          </g>
        </g>
      </svg>
    </div>
  );
}
