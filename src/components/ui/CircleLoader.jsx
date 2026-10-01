// components/ui/CircleLoader.jsx
import React from 'react';

export default function CircleLoader({
  size = 'medium',
  color = '#059669',
  trackColor = 'rgba(5, 150, 105, 0.15)',
  strokeWidth,
  style = {}
}) {
  let dimension = 40;
  let stroke = 3.5;

  if (typeof size === 'number') {
    dimension = size;
    stroke = strokeWidth || Math.max(2, Math.round(dimension / 11));
  } else if (size === 'large' || size === 'lg') {
    dimension = 48;
    stroke = strokeWidth || 4;
  } else if (size === 'small' || size === 'sm') {
    dimension = 26;
    stroke = strokeWidth || 2.5;
  } else if (size === 'xs') {
    dimension = 18;
    stroke = strokeWidth || 2;
  } else {
    // medium (default)
    dimension = 40;
    stroke = strokeWidth || 3.5;
  }

  const radius = 20;
  const viewBoxSize = 50;
  const center = viewBoxSize / 2;

  return (
    <div
      className="circle-loader-wrapper"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: dimension,
        height: dimension,
        flexShrink: 0,
        ...style
      }}
    >
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        width={dimension}
        height={dimension}
        style={{
          animation: 'professionalCircleRotate 1.4s linear infinite',
          transformOrigin: 'center center'
        }}
      >
        <style>{`
          @keyframes professionalCircleRotate {
            100% {
              transform: rotate(360deg);
            }
          }
          @keyframes professionalCircleDash {
            0% {
              stroke-dasharray: 1, 150;
              stroke-dashoffset: 0;
            }
            50% {
              stroke-dasharray: 90, 150;
              stroke-dashoffset: -35;
            }
            100% {
              stroke-dasharray: 90, 150;
              stroke-dashoffset: -124;
            }
          }
        `}</style>
        {/* Background Track Circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {/* Foreground Rotating Arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{
            animation: 'professionalCircleDash 1.4s ease-in-out infinite',
            strokeDasharray: '90, 150',
            strokeDashoffset: 0
          }}
        />
      </svg>
    </div>
  );
}
