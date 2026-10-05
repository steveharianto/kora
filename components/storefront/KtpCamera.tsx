"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Camera,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  SwitchCamera,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called with the captured image bytes and a suggested filename.
   * The parent is responsible for uploading / displaying.
   */
  onCapture: (blob: Blob, filename: string) => void;
}

/**
 * In-app camera for KTP capture.
 *
 * Uses getUserMedia with facingMode: "environment" (rear camera) by
 * default, with an in-place flip button for devices where the rear camera
 * isn't available or the ID needs to be shot selfie-style.
 *
 * Falls back gracefully — if getUserMedia is unavailable or denied, an
 * error overlay is shown and the parent modal should still offer the
 * file-picker path so the customer isn't stranded.
 */
export default function KtpCamera({ isOpen, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(
    async (facingMode: "environment" | "user") => {
      stopStream();
      setStarting(true);
      setError("");

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setStarting(false);
        setError(
          "This browser doesn't support in-app camera capture. Please use Upload File instead.",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStarting(false);
      } catch (e: any) {
        setStarting(false);
        const name = e?.name;
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera permission was denied. Allow access in your browser, or use Upload File instead."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera detected on this device. Please use Upload File instead."
              : name === "NotReadableError"
                ? "Camera is in use by another app. Close it and try again."
                : e?.message || "Could not start the camera.",
        );
      }
    },
    [stopStream],
  );

  /* Start / restart the camera whenever the modal opens or the lens flips */
  useEffect(() => {
    if (!isOpen) return;
    setCaptured(null);
    startCamera(facing);
    return () => {
      stopStream();
    };
  }, [isOpen, facing, startCamera, stopStream]);

  /* Lock body scroll + Esc to close while open */
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    // 0.92 quality keeps detail on small KTP text without ballooning size.
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
    stopStream();
  };

  const handleRetake = () => {
    setCaptured(null);
    startCamera(facing);
  };

  const handleFlip = () => {
    const next = facing === "environment" ? "user" : "environment";
    setCaptured(null);
    setFacing(next);
  };

  const handleConfirm = async () => {
    if (!captured) return;
    const res = await fetch(captured);
    const blob = await res.blob();
    const filename = `ktp-capture-${Date.now()}.jpg`;
    onCapture(blob, filename);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-[110]"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div className="bg-store-bg w-full max-w-[720px] relative shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-store-border">
            <h3 className="font-serif text-[20px] text-store-fg font-normal">
              {captured ? "Review Photo" : "Take Photo of Your ID"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close camera"
              className="text-store-fg-muted hover:text-store-fg cursor-pointer p-1"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Viewfinder */}
          <div className="relative bg-black aspect-[4/3] overflow-hidden">
            {captured ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={captured}
                alt="Captured ID"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
            )}

            {/* Framing guide — only while capturing, no error */}
            {!captured && !starting && !error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative w-[86%] h-[62%] border-2 border-white/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <div className="absolute -top-7 left-0 text-white/90 text-[11px] tracking-[0.14em] uppercase">
                    Align your ID inside the frame
                  </div>
                </div>
              </div>
            )}

            {starting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <div className="max-w-[440px] p-4 bg-white/95 rounded-lg border border-red-200 text-red-700 text-[12.5px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 px-5 py-5 bg-store-bg">
            {!captured ? (
              <>
                <button
                  type="button"
                  onClick={handleFlip}
                  disabled={starting || Boolean(error)}
                  title="Switch camera"
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-store-border-strong text-[11px] tracking-[0.14em] uppercase text-store-fg hover:bg-store-hover/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SwitchCamera className="w-3.5 h-3.5" strokeWidth={1.6} />
                  Flip
                </button>

                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={starting || Boolean(error)}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-4 h-4" strokeWidth={1.8} />
                  Capture
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="inline-flex items-center gap-1.5 px-5 py-3 border border-store-fg text-store-fg text-[11px] tracking-[0.18em] uppercase font-medium hover:bg-store-hover/50 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.6} />
                  Retake
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" strokeWidth={2} />
                  Use Photo
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
