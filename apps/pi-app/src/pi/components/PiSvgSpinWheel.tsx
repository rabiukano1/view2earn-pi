"use client";

import React from "react";

export interface WheelSectorPrize {
  pts: number;
  label: string;
  sublabel: string;
  type: "pts" | "zero";
  color: string;
  textColor: string;
}

export const TEN_WHEEL_PRIZES: WheelSectorPrize[] = [
  { pts: 10, label: "10", sublabel: "PTS", type: "pts", color: "#8B5CF6", textColor: "#FFF" },
  { pts: 25, label: "25", sublabel: "PTS", type: "pts", color: "#5B21B6", textColor: "#FFF" },
  { pts: 50, label: "50", sublabel: "PTS", type: "pts", color: "#8B5CF6", textColor: "#FFF" },
  { pts: -1, label: "+1", sublabel: "SPIN", type: "pts", color: "#5B21B6", textColor: "#FFF" },
  { pts: 100, label: "100", sublabel: "PTS", type: "pts", color: "#8B5CF6", textColor: "#FFF" },
  { pts: 15, label: "15", sublabel: "PTS", type: "pts", color: "#5B21B6", textColor: "#FFF" },
  { pts: -2, label: "+2", sublabel: "SPINS", type: "pts", color: "#8B5CF6", textColor: "#FFF" },
  { pts: -3, label: "+3", sublabel: "SPINS", type: "pts", color: "#5B21B6", textColor: "#FFF" },
  { pts: 0, label: "NO", sublabel: "BONUS", type: "zero", color: "#8B5CF6", textColor: "#FFF" },
  { pts: 35, label: "35", sublabel: "PTS", type: "pts", color: "#5B21B6", textColor: "#FFF" },
];

interface PiSvgSpinWheelProps {
  size?: number;
  spinning: boolean;
  disabled: boolean;
  rotationDeg: number;
  onSpinPress: () => void;
}

export function PiSvgSpinWheel({
  size = 320,
  spinning,
  disabled,
  rotationDeg,
  onSpinPress,
}: PiSvgSpinWheelProps) {
  const containerSize = size;
  const cx = containerSize / 2;
  const cy = containerSize / 2;
  const r = 0.44 * containerSize;
  const numSectors = 10;
  const sectorAngle = 360 / numSectors;

  const createSectorPath = (index: number) => {
    const startAngle = index * sectorAngle - 90;
    const endAngle = (index + 1) * sectorAngle - 90;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    return `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
  };

  return (
    <div
      style={{
        width: containerSize,
        height: containerSize,
        position: "relative",
        margin: "0 auto",
        userSelect: "none",
      }}
    >
      {/* Pointer at 12 o'Clock */}
      <div
        style={{
          position: "absolute",
          top: cy - r - 16,
          left: cx - 18,
          width: 36,
          height: 36,
          zIndex: 30,
          pointerEvents: "none",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 36 36">
          <path d="M 18 34 L 4 4 L 32 4 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="2.5" />
        </svg>
      </div>

      {/* Rotating Circular SVG Wheel */}
      <div
        style={{
          width: containerSize,
          height: containerSize,
          position: "absolute",
          top: 0,
          left: 0,
          transform: `rotate(${rotationDeg}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.15, 0.85, 0.35, 1)" : "none",
        }}
      >
        <svg width={containerSize} height={containerSize} viewBox={`0 0 ${containerSize} ${containerSize}`}>
          <defs>
            <clipPath id="wheelClipPi">
              <circle cx={cx} cy={cy} r={r} />
            </clipPath>
          </defs>

          {/* Outer Bezel Rim */}
          <circle cx={cx} cy={cy} r={r + 8} fill="#6D28D9" stroke="#8B5CF6" strokeWidth="4" />

          {/* Bezel Stud Dots */}
          {Array.from({ length: 10 }).map((_, idx) => {
            const angle = idx * 36 - 90;
            const rad = (angle * Math.PI) / 180;
            const studR = r + 4;
            const sx = cx + studR * Math.cos(rad);
            const sy = cy + studR * Math.sin(rad);
            return <circle key={idx} cx={sx} cy={sy} r="3.5" fill="#DDD6FE" />;
          })}

          {/* 10 Equal Circular Sectors */}
          <g clipPath="url(#wheelClipPi)">
            {TEN_WHEEL_PRIZES.map((prize, i) => {
              const d = createSectorPath(i);
              const bisectorAngle = i * sectorAngle + sectorAngle / 2 - 90;
              const bisectorRad = (bisectorAngle * Math.PI) / 180;

              const labelR = 0.65 * r;
              const lx = cx + labelR * Math.cos(bisectorRad);
              const ly = cy + labelR * Math.sin(bisectorRad);
              const textRotation = i * sectorAngle + sectorAngle / 2;

              return (
                <g key={i}>
                  <path d={d} fill={prize.color} stroke="#3B0764" strokeWidth="1.5" />
                  <g transform={`translate(${lx}, ${ly}) rotate(${textRotation})`}>
                    <text
                      x="0"
                      y="-3"
                      textAnchor="middle"
                      fill={prize.textColor}
                      fontSize="16"
                      fontWeight="900"
                      fontFamily="sans-serif"
                    >
                      {prize.label}
                    </text>
                    <text
                      x="0"
                      y="10"
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.85)"
                      fontSize="8.5"
                      fontWeight="800"
                      fontFamily="sans-serif"
                    >
                      {prize.sublabel}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Center Circular "SPIN" Button (Stays fixed at exact center cx, cy) */}
      <button
        type="button"
        onClick={onSpinPress}
        disabled={disabled}
        style={{
          position: "absolute",
          left: cx - 44,
          top: cy - 44,
          width: 88,
          height: 88,
          borderRadius: 44,
          zIndex: 40,
          backgroundColor: "#F59E0B",
          border: "4px solid #FDE047",
          boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.75 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          outline: "none",
          padding: 0,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: "#D97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {spinning ? (
            <span className="pi-spinner pi-spinner-inline" style={{ width: 22, height: 22, borderColor: "#FFF transparent transparent" }} />
          ) : (
            <span style={{ color: "#FFF", fontSize: 20, fontWeight: 900, letterSpacing: "1.2px" }}>
              SPIN
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
