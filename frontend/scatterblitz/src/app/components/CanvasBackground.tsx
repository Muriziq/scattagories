"use client";

import { useEffect, useRef } from "react";

interface CanvasBackgroundProps {
  className?: string;
}

export default function CanvasBackground({ className }: CanvasBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawGrid = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(242, 204, 136, 0.1)"; // Theme-matching warm sunset/amber grid line color

      const iterationWidth = height / 100;
      for (let i = 0; i <= iterationWidth; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 100);
        ctx.lineTo(width, i * 100 + 50);
        ctx.stroke();
      }

      const iterationHeight = width / 100;
      for (let i = 0; i <= iterationHeight; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 100, 0);
        ctx.lineTo(i * 100 + 50, height);
        ctx.stroke();
      }
    };

    drawGrid();
    window.addEventListener("resize", drawGrid);
    return () => window.removeEventListener("resize", drawGrid);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={
        className ? `canvasBackground ${className}` : "canvasBackground"
      }
    />
  );
}
