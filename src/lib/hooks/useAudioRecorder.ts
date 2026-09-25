"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseAudioRecorderOptions {
  onTranscript: (text: string) => void;
  maxDurationSeconds?: number;
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  duration: number;
  maxDuration: number;
  error: string | null;
  analyserNode: AnalyserNode | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  clearError: () => void;
}

export function useAudioRecorder({
  onTranscript,
  maxDurationSeconds = 30,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  const cleanupAudio = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setAnalyserNode(null);
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setDuration(0);
  }, []);

  const sendAudioForTranscription = useCallback(
    async (blob: Blob, mimeType: string) => {
      setIsTranscribing(true);
      setError(null);

      try {
        const formData = new FormData();
        const extension = mimeType.includes("mp4")
          ? "m4a"
          : mimeType.includes("wav")
          ? "wav"
          : "webm";
        formData.append("file", blob, `speech-input.${extension}`);

        const response = await fetch("/api/chat/transcribe", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to transcribe audio.");
        }

        if (data.text && typeof data.text === "string" && data.text.trim()) {
          onTranscript(data.text.trim());
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "An error occurred during transcription.";
        setError(msg);
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscript]
  );

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }

    isCancelledRef.current = false;
    mediaRecorderRef.current.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupAudio();
  }, [cleanupAudio]);

  const startRecording = useCallback(async () => {
    setError(null);
    audioChunksRef.current = [];
    isCancelledRef.current = false;

    if (
      typeof window === "undefined" ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      setError("Microphone access is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Web Audio API setup for live waveform analysis
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Generates 32 frequency buckets for real-time bars
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      setAnalyserNode(analyser);

      // Determine best audio mime type supported
      const candidateTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/wav",
      ];
      let selectedMimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        selectedMimeType =
          candidateTypes.find((type) => MediaRecorder.isTypeSupported(type)) ||
          "";
      }

      const recorder = new MediaRecorder(
        stream,
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const wasCancelled = isCancelledRef.current;
        const chunks = [...audioChunksRef.current];
        const mimeType = recorder.mimeType || selectedMimeType || "audio/webm";

        cleanupAudio();

        if (!wasCancelled && chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: mimeType });
          if (audioBlob.size > 0) {
            sendAudioForTranscription(audioBlob, mimeType);
          }
        }
      };

      recorder.start(250); // Collect slice every 250ms
      setIsRecording(true);
      setDuration(0);

      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsedSec);

        // Auto-stop when reaching max duration (30 seconds)
        if (elapsedSec >= maxDurationSeconds) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state !== "inactive"
          ) {
            mediaRecorderRef.current.stop();
          }
        }
      }, 250);
    } catch (err: unknown) {
      cleanupAudio();
      if (err instanceof DOMException) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setError(
            "Microphone permission was denied. Please allow microphone access in your browser settings."
          );
          return;
        }
        if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("No microphone device was detected.");
          return;
        }
      }
      setError("Failed to access microphone. Please check your system settings.");
    }
  }, [cleanupAudio, maxDurationSeconds, sendAudioForTranscription]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isRecording,
    isTranscribing,
    duration,
    maxDuration: maxDurationSeconds,
    error,
    analyserNode,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
  };
}
