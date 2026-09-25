"use client";

import { useEffect, useRef } from "react";

interface VoiceWaveformCanvasProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  className?: string;
}

export function VoiceWaveformCanvas({
  analyserNode,
  isRecording,
  className = "w-full h-8",
}: VoiceWaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode || !isRecording) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    const barCount = 20;
    const barSpacing = 3;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      analyserNode.getByteFrequencyData(dataArray);

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // Compute bar geometry
      const totalSpacing = (barCount - 1) * barSpacing;
      const availableWidth = width - totalSpacing;
      const barWidth = Math.max(2.5, availableWidth / barCount);
      const minBarHeight = 4;
      const maxBarHeight = height - 6;

      // Draw mirrored or centered frequency bars
      for (let i = 0; i < barCount; i++) {
        // Sample frequency buckets non-linearly to favor human voice frequencies (lower-mid)
        const bucketIndex = Math.min(
          Math.floor((i / barCount) * (bufferLength / 2)),
          bufferLength - 1
        );
        const rawValue = dataArray[bucketIndex] || 0;
        const normalized = rawValue / 255;

        // Apply slight curve for smoother dynamics
        const barHeight = Math.max(
          minBarHeight,
          normalized * maxBarHeight + (normalized > 0.1 ? 2 : 0)
        );

        const x = i * (barWidth + barSpacing);
        const y = (height - barHeight) / 2;
        const radius = barWidth / 2;

        ctx.fillStyle = normalized > 0.4 ? "#d97706" : "#f59e0b";

        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, barWidth, barHeight, radius);
        } else {
          // Fallback for older browsers
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateCanvasSize);
      if (canvas) {
        const context = canvas.getContext("2d");
        context?.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [analyserNode, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      className={`block select-none pointer-events-none ${className}`}
      aria-label="Audio waveform recording visualizer"
    />
  );
}
