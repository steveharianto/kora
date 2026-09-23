"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  saveItem,
  deleteItem,
  toggleArchive,
  saveNotes,
  addImageRecord,
  deleteImageRecord,
  reorderImages,
  approvePendingChanges,
  rejectPendingAction,
} from "@/app/actions/inventory";
import { formatRupiah } from "@/lib/utils";
import RupiahInput from "@/components/RupiahInput";

const SUGGESTED_STYLE_TAGS = ["Hijab Friendly", "Maxi", "Mini", "Midi"];

export default function ItemForm({
  isNew,
  initialData,
  brands,
  categories,
  types,
  colorOptions,
  depositTiers,
  initialImages,
  orders,
  auditLogs,
  currentAdmin,
}: any) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isSuperAdmin =
    currentAdmin?.role?.toLowerCase().replace(/[\s_-]+/g, "") === "superadmin";

  const viewData = useMemo(() => {
    if (!initialData) return {};
    const pending = initialData.pending_changes || {};
    return {
      ...initialData,
      ...pending,
      sku: initialData.sku || pending.sku || "",
      measurements: {
        outer: {
          ...(initialData.measurements?.outer || {}),
          ...(pending.measurements?.outer || {}),
        },
        inner: {
          ...(initialData.measurements?.inner || {}),
          ...(pending.measurements?.inner || {}),
        },
        skirt: {
          ...(initialData.measurements?.skirt || {}),
          ...(pending.measurements?.skirt || {}),
        },
      },
    };
  }, [initialData]);

  const [formData, setFormData] = useState({
    sku: viewData.sku || "",
    brand_id: viewData.brand_id || "",
    category_id: viewData.category_id || "",
    type_id: viewData.type_id || "",
    name: viewData.name || "",
    size: viewData.size || "",
    color: viewData.color || "",
    rental_price: viewData.rental_price || "",
    buffer_override: viewData.buffer_override ?? "",
    status: viewData.status || "Available",
    website_status: viewData.website_status || "Draft",
    description: viewData.description || "",
    tags: viewData.tags || [],
    date_added:
      viewData.date_added ||
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
        new Date(),
      ),
  });

  const [meas, setMeas] = useState({
    outer: viewData.measurements?.outer || {},
    inner: viewData.measurements?.inner || {},
    skirt: viewData.measurements?.skirt || {},
  });

  const [notes, setNotes] = useState(initialData?.notes || "");
  const [images, setImages] = useState(initialImages || []);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    const pending = initialData.pending_changes || {};
    const merged = {
      ...initialData,
      ...pending,
      sku: initialData.sku || pending.sku || "",
    };

    setFormData({
      sku: merged.sku || "",
      brand_id: merged.brand_id || "",
      category_id: merged.category_id || "",
      type_id: merged.type_id || "",
      name: merged.name || "",
      size: merged.size || "",
      color: merged.color || "",
      rental_price: merged.rental_price || "",
      buffer_override: merged.buffer_override ?? "",
      status: merged.status || "Available",
      website_status: merged.website_status || "Draft",
      description: merged.description || "",
      tags: merged.tags || [],
      date_added:
        merged.date_added ||
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
          new Date(),
        ),
    });
    setMeas({
      outer: {
        ...(initialData.measurements?.outer || {}),
        ...(pending.measurements?.outer || {}),
      },
      inner: {
        ...(initialData.measurements?.inner || {}),
        ...(pending.measurements?.inner || {}),
      },
      skirt: {
        ...(initialData.measurements?.skirt || {}),
        ...(pending.measurements?.skirt || {}),
      },
    });
    setNotes(initialData?.notes || "");
    setImages(initialImages || []);
  }, [initialData, initialImages]);

  const tagInputRef = useRef<HTMLInputElement>(null);
  const [tagInputValue, setTagInputValue] = useState("");

  const colorInputRef = useRef<HTMLInputElement>(null);
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [colorFocusedIndex, setColorFocusedIndex] = useState(-1);

  const defaultBufferDays = useMemo(() => {
    const selectedType = types?.find(
      (t: any) => String(t.id) === String(formData.type_id),
    );
    return selectedType?.default_buffer_days ?? 3;
  }, [types, formData.type_id]);

  const effectiveBuffer = useMemo(() => {
    const parsed = parseInt(String(formData.buffer_override), 10);
    return !isNaN(parsed) && parsed >= 0 ? parsed : defaultBufferDays;
  }, [formData.buffer_override, defaultBufferDays]);

  const missingFields = useMemo(() => {
    const m = [];
    if (!formData.sku) m.push("Code/SKU");
    if (!formData.brand_id) m.push("Brand");
    if (!formData.name) m.push("Name");
    if (!formData.size) m.push("Size");
    if (!formData.rental_price) m.push("Price");
    if (images.length === 0) m.push("Pictures");
    return m;
  }, [formData, images]);

  const isComplete = missingFields.length === 0;

  const isBooked = useMemo(() => {
    if (!orders || orders.length === 0) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return orders.some((o: any) => {
      if (!o.pickup_date || !o.return_date) return false;
      const [sy, sm, sd] = o.pickup_date.split("-").map(Number);
      const start = new Date(sy, sm - 1, sd).getTime();

      const [ry, rm, rd] = o.return_date.split("-").map(Number);
      const end = new Date(ry, rm - 1, rd);
      end.setDate(end.getDate() + effectiveBuffer);
      const endWithBuffer = end.getTime();

      const nowTime = today.getTime();
      return nowTime >= start && nowTime <= endWithBuffer;
    });
  }, [orders, effectiveBuffer]);

  const calculatedDeposit = useMemo(() => {
    const price = parseFloat(formData.rental_price) || 0;
    const tier =
      depositTiers.find((t: any) => price <= t.price_up_to) ||
      depositTiers[depositTiers.length - 1];
    return tier ? tier.deposit_value : 0;
  }, [formData.rental_price, depositTiers]);

  const handleChange = (e: any) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleMeasChange = (group: string, field: string, value: string) => {
    setMeas({
      ...meas,
      [group]: {
        ...meas[group as keyof typeof meas],
        [field]: value ? parseInt(value, 10) : undefined,
      },
    });
  };

  const addTag = (value: string) => {
    const cleanValue = value.trim().replace(/,+$/, "");
    if (cleanValue && !formData.tags.includes(cleanValue)) {
      setFormData({ ...formData, tags: [...formData.tags, cleanValue] });
    }
    setTagInputValue("");
  };

  const removeTag = (index: number) => {
    const newTags = [...formData.tags];
    newTags.splice(index, 1);
    setFormData({ ...formData, tags: newTags });
    tagInputRef.current?.focus();
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInputValue);
    } else if (e.key === "Backspace" && tagInputValue === "") {
      if (formData.tags.length > 0) {
        removeTag(formData.tags.length - 1);
      }
    }
  };

  const filteredColors = colorOptions.filter((c: string) =>
    c.toLowerCase().includes(formData.color.toLowerCase()),
  );

  const handleImageUpload = async (e: any) => {
    const targetSku = initialData?.sku || formData.sku;
    const file = e.target.files[0];
    if (!file || !targetSku) return alert("Please set a SKU first.");
    setUploadingImage(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${targetSku}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("item-images")
      .upload(fileName, file);

    if (!uploadError) {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-images/${fileName}`;

      if (!isNew) {
        const res = await addImageRecord(targetSku, url, images.length + 1);
        if (res?.data) {
          setImages([...images, res.data]);
        }
      } else {
        setImages([
          ...images,
          { id: Date.now(), image_url: url, display_order: images.length + 1 },
        ]);
      }
    } else {
      alert("Upload failed: " + uploadError.message);
    }
    setUploadingImage(false);
  };

  const moveImage = async (index: number, direction: "up" | "down") => {
    const targetSku = initialData?.sku || formData.sku;
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === images.length - 1)
    )
      return;
    const newImages = [...images];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    const temp = newImages[index].display_order;
    newImages[index].display_order = newImages[targetIndex].display_order;
    newImages[targetIndex].display_order = temp;

    newImages.sort((a, b) => a.display_order - b.display_order);
    setImages(newImages);

    if (!isNew) {
      await reorderImages(newImages, targetSku);
    }
  };

  const removeImage = async (id: number) => {
    const targetSku = initialData?.sku || formData.sku;
    if (!confirm("Remove picture?")) return;

    if (!isNew) {
      await deleteImageRecord(id, targetSku);
    }
    setImages(images.filter((img: any) => img.id !== id));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const targetSku = initialData?.sku || formData.sku;
    const res = await saveItem(
      { ...formData, sku: targetSku, measurements: meas },
      isNew,
    );

    if (res.error) {
      setErrorMsg(res.error);
      setLoading(false);
      return;
    }

    if (isNew) {
      for (const img of images) {
        await addImageRecord(targetSku, img.image_url, img.display_order);
      }
      alert("Item saved.");
      router.push(`/admin/inventory/${targetSku}`);
    } else {
      alert("Changes saved!");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1.5">
              Catalog · Inventory
            </div>
            <h1 className="font-serif text-[32px] font-normal tracking-[0.01em]">
              {isNew
                ? "New Item"
                : `${initialData?.sku || formData.sku} — ${formData.name || "Draft"}`}
            </h1>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition cursor-pointer disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : isSuperAdmin
                ? "Save item"
                : "Req Save"}
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 text-sm bg-bad-bg border border-[#D9A79C] text-bad rounded-lg">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-line rounded-[10px] p-5 space-y-3.5">
            <h3 className="font-serif text-[18px] font-normal mb-1">
              Item information
            </h3>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Code / SKU <span className="text-bad">*</span>
                </label>
                <input
                  required
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  disabled={!isNew}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 uppercase bg-[#FDFCFA] disabled:bg-[#F1EEE7] disabled:text-muted"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Brand <span className="text-bad">*</span>
                </label>
                <select
                  required
                  name="brand_id"
                  value={formData.brand_id}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="">— Select Brand —</option>
                  {brands.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                Item name <span className="text-bad">*</span>
              </label>
              <input
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Size <span className="text-bad">*</span>
                </label>
                <input
                  required
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Color
                </label>
                <input
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                />
              </div>
            </div>

            {/* STYLE TAGS (RENAMED WITH HIJAB FRIENDLY, MAXI, MINI CHIPS) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted font-medium">
                  Style Tags
                </label>
                <span className="text-[10px] text-muted">
                  Click suggestion or type below
                </span>
              </div>

              {/* Suggestions */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SUGGESTED_STYLE_TAGS.map((tag) => {
                  const isSelected = formData.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setFormData({
                            ...formData,
                            tags: formData.tags.filter(
                              (t: string) => t !== tag,
                            ),
                          });
                        } else {
                          setFormData({
                            ...formData,
                            tags: [...formData.tags, tag],
                          });
                        }
                      }}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition cursor-pointer ${
                        isSelected
                          ? "bg-wine text-white border-wine font-medium"
                          : "bg-[#F6F4EF] text-muted border-line hover:border-ink hover:text-ink"
                      }`}
                    >
                      {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  );
                })}
              </div>

              {/* Tag Input Box */}
              <div
                className="flex flex-wrap items-center gap-1.5 border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] min-h-[38px] cursor-text"
                onClick={() => tagInputRef.current?.focus()}
              >
                {formData.tags.map((tag: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-wine-soft text-wine-ink text-[12px] px-2 py-0.5 rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTag(i);
                      }}
                      className="text-muted hover:text-bad leading-none cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInputValue}
                  onChange={(e) => setTagInputValue(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={
                    formData.tags.length === 0
                      ? "Type custom style tag and press enter..."
                      : ""
                  }
                  className="flex-1 bg-transparent border-none outline-none text-[13px] min-w-[120px] p-0"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                Rental Price (Rp) <span className="text-bad">*</span>
              </label>
              <RupiahInput
                required
                value={Number(formData.rental_price) || 0}
                onChange={(v) => setFormData({ ...formData, rental_price: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5 p-3 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6]">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Deposit (From Tier)
                </label>
                <input
                  disabled
                  value={formatRupiah(calculatedDeposit)}
                  className="w-full text-[13px] border-none bg-transparent font-semibold text-ink"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Buffer Override (Days)
                </label>
                <input
                  type="number"
                  name="buffer_override"
                  value={formData.buffer_override}
                  onChange={handleChange}
                  placeholder={`Default (${defaultBufferDays})`}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-1.5 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option>Available</option>
                  <option>Under Repair</option>
                  <option>Coming Soon</option>
                  <option>Unavailable</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Website Status
                </label>
                <select
                  name="website_status"
                  value={formData.website_status}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option>Published</option>
                  <option>Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* RIGHT: Pictures & Measurements */}
          <div className="space-y-4">
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-3">
                Pictures <span className="text-bad">*</span>
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((img: any, i: number) => (
                  <div key={img.id} className="relative flex-shrink-0 w-28">
                    {i === 0 && (
                      <div className="absolute top-1 left-1 bg-white/90 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-wine-ink z-10 shadow-sm">
                        COVER
                      </div>
                    )}
                    <div className="h-36 bg-[#EBEFE6] rounded-lg overflow-hidden border border-line mb-1.5">
                      <img
                        src={img.image_url}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    </div>
                    <div className="flex justify-between items-center text-muted">
                      <button
                        type="button"
                        onClick={() => moveImage(i, "up")}
                        className="p-1 hover:bg-[#F6F4EF] rounded cursor-pointer"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(i, "down")}
                        className="p-1 hover:bg-[#F6F4EF] rounded cursor-pointer"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="p-1 hover:text-bad rounded cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                <label className="flex-shrink-0 w-28 h-36 flex flex-col items-center justify-center border border-dashed border-[#C9C2B4] rounded-lg cursor-pointer hover:bg-[#FDFCFA] transition text-muted text-sm font-medium">
                  {uploadingImage ? "Uploading..." : "+ Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>
            </div>

            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-1">
                Measurements
              </h3>
              <div className="text-[11px] tracking-[0.16em] uppercase text-wine-ink font-bold mb-1 mt-4">
                Outer
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  "bust",
                  "waist",
                  "hips",
                  "length_front",
                  "length_back",
                  "shoulder",
                  "neck_hole",
                  "arm_hole",
                  "arm_length",
                ].map((f) => (
                  <div key={`outer-${f}`}>
                    <label className="block text-[10px] text-muted mb-0.5 capitalize">
                      {f.replace("_", " ")}
                    </label>
                    <input
                      type="number"
                      value={meas.outer[f] || ""}
                      onChange={(e) =>
                        handleMeasChange("outer", f, e.target.value)
                      }
                      className="w-full text-[13px] border border-line rounded-lg px-2 py-1.5 bg-[#FDFCFA]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
