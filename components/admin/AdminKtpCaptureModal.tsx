"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, Upload, Loader2, RefreshCw, Check } from "lucide-react";
import KtpCamera from "@/components/storefront/KtpCamera";
import { uploadKtpFile, removeKtpFile } from "@/lib/ktpUpload";
import { uploadKtpOnBehalfOfCustomer } from "@/app/actions/customers";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  onUploaded: () => void;
}

type Step = "idle" | "camera" | "preview";

/**
 * Admin-side KTP capture / upload modal.
 *
 * Shares the same KtpCamera component and lib/ktpUpload util as the
 * customer-facing flow. Uploads to storage client-side, then calls
 * uploadKtpOnBehalfOfCustomer to write the DB row + audit log.
 * Customer status flips to "KTP Pending" so the existing Approve / Reject
 * review flow still applies.
 */
export default function AdminKtpCaptureModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  onUploaded,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<{ url: string; path: string } | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen) return;
    setStep("idle");
    setUploading(false);
    setSaving(false);
    setError("");
    setPhoto(null);
  }, [isOpen]);

  /**
   * If the admin closes the modal after uploading but before saving,
   * clean up the orphaned storage object.
   */
  const handleClose = async () => {
    if (photo && step === "preview") {
      await removeKtpFile(photo.path);
    }
    onClose();
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setError("");
    const res = await uploadKtpFile(file, file.name);
    setUploading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setPhoto({ url: res.photoUrl, path: res.photoPath });
    setStep("preview");
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleCameraCapture = async (blob: Blob, filename: string) => {
    setStep("idle");
    setUploading(true);
    setError("");
    const res = await uploadKtpFile(blob, filename);
    setUploading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setPhoto({ url: res.photoUrl, path: res.photoPath });
    setStep("preview");
  };

  const handleRetake = async () => {
    if (photo) await removeKtpFile(photo.path);
    setPhoto(null);
    setStep("camera");
  };

  const handleSave = async () => {
    if (!photo) return;
    setSaving(true);
    setError("");

    const res = await uploadKtpOnBehalfOfCustomer(customerId, {
      photoUrl: photo.url,
      photoPath: photo.path,
    });

    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    onUploaded();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[80]"
        onClick={handleClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-card border border-line rounded-xl w-full max-w-xl my-8 relative shadow-2xl">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="absolute right-5 top-5 text-muted hover:text-ink transition-colors cursor-pointer z-10 p-1"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <div className="px-6 sm:px-8 pt-8 pb-8">
            <div className="text-[10.5px] tracking-[0.22em] uppercase text-muted mb-2 font-medium">
              KTP Upload · On Behalf
            </div>
            <h2 className="font-serif text-[22px] sm:text-[26px] font-normal tracking-[0.01em] mb-2 text-ink">
              Upload {customerName}&rsquo;s ID
            </h2>
            <p className="text-[12.5px] text-muted leading-relaxed mb-6 max-w-[520px]">
              Use this when the customer is at the showroom and hands you their
              ID, or when they&rsquo;ve sent the photo via WhatsApp. Saved as{" "}
              <strong>KTP Pending</strong> — review it below.
            </p>

            {error && (
              <div className="mb-5 p-3 bg-bad-bg border border-[#D9A79C] text-bad rounded-md text-[12px]">
                {error}
              </div>
            )}

            {step === "idle" && !uploading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStep("camera")}
                  className="flex flex-col items-center gap-3 p-6 border border-dashed border-line hover:border-wine bg-[#FDFCFA] hover:bg-[#F6F4EF] transition-colors cursor-pointer rounded-lg"
                >
                  <Camera className="w-7 h-7 text-wine" strokeWidth={1.4} />
                  <span className="text-[12.5px] text-ink font-medium">
                    Take Photo
                  </span>
                  <span className="text-[11px] text-muted text-center leading-snug">
                    Open the camera and photograph the ID
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 border border-dashed border-line hover:border-wine bg-[#FDFCFA] hover:bg-[#F6F4EF] transition-colors cursor-pointer rounded-lg"
                >
                  <Upload className="w-7 h-7 text-wine" strokeWidth={1.4} />
                  <span className="text-[12.5px] text-ink font-medium">
                    Upload File
                  </span>
                  <span className="text-[11px] text-muted text-center leading-snug">
                    Pick a photo from the device
                  </span>
                </button>
              </div>
            )}

            {uploading && (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-wine animate-spin" />
                <p className="text-[12.5px] text-muted">Uploading…</p>
              </div>
            )}

            {step === "preview" && photo && (
              <div>
                <div className="border border-line bg-[#F6F4EF] p-2 mb-6 rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt="KTP preview"
                    className="w-full h-auto object-contain max-h-[420px] mx-auto"
                  />
                </div>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-line bg-card text-ink rounded-lg text-xs font-medium hover:bg-[#F6F4EF] transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.6} />
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-wine text-white rounded-lg text-xs font-semibold hover:bg-[#181E15] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" strokeWidth={2} />
                    {saving ? "Saving…" : "Save KTP"}
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        </div>
      </div>

      <KtpCamera
        isOpen={step === "camera"}
        onClose={() => setStep("idle")}
        onCapture={handleCameraCapture}
      />
    </>
  );
}
