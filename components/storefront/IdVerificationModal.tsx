"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadCustomerKtp } from "@/app/actions/customerProfile";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
}

const MAX_SIZE_MB = 5;
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const BUCKET = "ktp-photos";
const SIGNED_URL_TTL_S = 60 * 60 * 24 * 365; // 1 year — Supabase max

type ViewState = "idle" | "uploading" | "uploaded";

export default function IdVerificationModal({
  isOpen,
  onClose,
  onProceed,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ViewState>("idle");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setState("idle");
    setUploadedUrl(null);
    setError("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setState("idle");
    setUploadedUrl(null);
    setUploadedPath(null);
    setError("");
  }, [isOpen]);

  const handleFile = async (file: File) => {
    setError("");

    if (!ACCEPTED.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    setState("uploading");

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `ktp/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });

      if (upErr) throw new Error(upErr.message);

      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_S);

      if (signErr || !signed?.signedUrl) {
        throw new Error(
          signErr?.message || "Could not sign the uploaded file.",
        );
      }

      setUploadedPath(path);
      setUploadedUrl(signed.signedUrl);
      setState("uploaded");
    } catch (e: any) {
      setError(e.message || "Upload failed. Please try again.");
      setState("idle");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };
  const handleReplace = async () => {
    // Best-effort cleanup of the abandoned upload.
    if (uploadedPath) {
      const supabase = createClient();
      await supabase.storage
        .from(BUCKET)
        .remove([uploadedPath])
        .catch(() => {});
    }
    setUploadedUrl(null);
    setUploadedPath(null);
    setState("idle");
    setError("");
  };

  const handleProceed = async () => {
    if (!uploadedUrl || !uploadedPath) return;
    setSaving(true);
    setError("");

    const res = await uploadCustomerKtp({
      photoUrl: uploadedUrl,
      photoPath: uploadedPath,
    });
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    onProceed();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-[80]"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[880px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>

          <h2 className="font-serif text-[26px] sm:text-[36px] text-store-accent text-center pt-12 pb-6 font-normal">
            ID Verification Required
          </h2>

          <div className="px-6 sm:px-12 pb-12">
            {state === "uploaded" && uploadedUrl ? (
              <div>
                <p className="text-center text-[13px] text-store-fg-muted max-w-[520px] mx-auto leading-relaxed mb-10">
                  Thank you for uploading your ID. You can now proceed to
                  checkout.
                </p>

                <div className="max-w-[600px] mx-auto">
                  <div className="relative border border-store-border-strong bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={uploadedUrl}
                      alt="Uploaded ID"
                      className="w-full h-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleReplace}
                      aria-label="Replace ID"
                      className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-white border border-store-border rounded-full shadow-sm hover:bg-store-hover/50 transition-colors cursor-pointer"
                    >
                      <X
                        className="w-4 h-4 text-store-fg-muted"
                        strokeWidth={2}
                      />
                    </button>
                  </div>

                  <p className="text-center text-[12px] text-store-fg-muted leading-relaxed mt-6">
                    Your ID will only be used for verification purposes and
                    handled securely in accordance with our Privacy Policy.
                  </p>

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px] text-center">
                      {error}
                    </div>
                  )}

                  <div className="flex justify-center mt-10">
                    <button
                      type="button"
                      onClick={handleProceed}
                      disabled={saving}
                      className="px-12 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Proceed to Checkout"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-center text-[13px] text-store-fg-muted max-w-[520px] mx-auto leading-relaxed mb-12">
                  You haven&apos;t uploaded your ID yet. Please upload it below
                  to proceed with checkout. Make sure your ID follows the
                  guidelines below.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-16 max-w-[660px] mx-auto mb-14">
                  <ReferenceCard
                    variant="good"
                    caption="Make sure your ID is clear and fully visible."
                  />
                  <ReferenceCard
                    variant="bad"
                    caption="Avoid cropped or partially visible ID photos."
                  />
                </div>

                {error && (
                  <div className="max-w-[600px] mx-auto mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px] text-center">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  disabled={state === "uploading"}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-[640px] mx-auto block border border-dashed border-store-fg/30 hover:border-store-accent bg-transparent py-12 px-6 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  <div className="flex items-center justify-center gap-3 text-store-fg-muted">
                    {state === "uploading" ? (
                      <>
                        <Loader2
                          className="w-5 h-5 animate-spin"
                          strokeWidth={1.5}
                        />
                        <span className="text-[13px] tracking-wide">
                          Uploading…
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" strokeWidth={1.5} />
                        <span className="text-[13px] tracking-wide">
                          Upload your ID (KTP) Here
                        </span>
                      </>
                    )}
                  </div>
                </button>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </>
  );
}

function ReferenceCard({
  variant,
  caption,
}: {
  variant: "good" | "bad";
  caption: string;
}) {
  const isBad = variant === "bad";
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full aspect-[3/2]">
        <div className="absolute inset-0 bg-[#909090] overflow-hidden">
          <div
            className={`absolute top-[14%] bottom-[14%] bg-white ${
              isBad ? "left-[8%] right-[-18%]" : "left-[8%] right-[8%]"
            }`}
          >
            <div className="absolute top-0 left-0 right-0 h-[28%] bg-[#64765B]" />
            <div className="absolute left-[7%] top-[42%] w-[18%] aspect-square bg-[#E1DFCE] flex items-center justify-center">
              <div className="w-1/2 h-1/2 rounded-full bg-[#64765B] opacity-60" />
            </div>
            <div className="absolute left-[30%] top-[42%] right-[8%] h-[8%] bg-[#E1DFCE]" />
            <div className="absolute left-[30%] top-[56%] right-[8%] h-[8%] bg-[#E1DFCE]" />
            <div className="absolute left-[30%] bottom-[12%] right-[8%] h-[8%] bg-[repeating-linear-gradient(45deg,#E1DFCE_0,#E1DFCE_2px,transparent_2px,transparent_5px)]" />
          </div>
        </div>

        <div
          className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full flex items-center justify-center ring-4 ring-store-bg ${
            isBad ? "bg-[#E53935]" : "bg-[#10B981]"
          }`}
        >
          {isBad ? (
            <X className="w-6 h-6 text-white" strokeWidth={3} />
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      <p className="text-[12.5px] text-store-fg-muted leading-snug text-center mt-6">
        {caption}
      </p>
    </div>
  );
}
