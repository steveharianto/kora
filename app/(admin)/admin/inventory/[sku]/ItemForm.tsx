'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  saveItem,
  deleteItem,
  toggleArchive,
  saveNotes,
  addImageRecord,
  deleteImageRecord,
  reorderImages,
  approvePendingChanges,
  rejectPendingAction
} from '@/app/actions/inventory';
import { formatRupiah } from '@/lib/utils';

export default function ItemForm({
  isNew, initialData, brands, categories, types, colorOptions, depositTiers,
  initialImages, orders, auditLogs, currentAdmin
}: any) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Normalize role check (handles 'superadmin', 'Super Admin', 'Superadmin')
  const isSuperAdmin = currentAdmin?.role?.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';

  // Safely merge initialData with pending_changes so SKU & required fields aren't wiped out
  const viewData = useMemo(() => {
    if (!initialData) return {};
    const pending = initialData.pending_changes || {};
    return {
      ...initialData,
      ...pending,
      sku: initialData.sku || pending.sku || '',
      measurements: {
        outer: { ...(initialData.measurements?.outer || {}), ...(pending.measurements?.outer || {}) },
        inner: { ...(initialData.measurements?.inner || {}), ...(pending.measurements?.inner || {}) },
        skirt: { ...(initialData.measurements?.skirt || {}), ...(pending.measurements?.skirt || {}) },
      }
    };
  }, [initialData]);

  // Form State
  const [formData, setFormData] = useState({
    sku: viewData.sku || '',
    brand_id: viewData.brand_id || '',
    category_id: viewData.category_id || '',
    type_id: viewData.type_id || '',
    name: viewData.name || '',
    size: viewData.size || '',
    color: viewData.color || '',
    rental_price: viewData.rental_price || '',
    buffer_override: viewData.buffer_override || '',
    status: viewData.status || 'Available',
    website_status: viewData.website_status || 'Draft',
    description: viewData.description || '',
    tags: viewData.tags || [],
    date_added: viewData.date_added || new Date().toISOString().split('T')[0],
  });

  const [meas, setMeas] = useState({
    outer: viewData.measurements?.outer || {},
    inner: viewData.measurements?.inner || {},
    skirt: viewData.measurements?.skirt || {},
  });

  const [notes, setNotes] = useState(initialData?.notes || '');
  const [images, setImages] = useState(initialImages || []);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Sync state when router.refresh() updates initialData
  useEffect(() => {
    if (!initialData) return;
    const pending = initialData.pending_changes || {};
    const merged = {
      ...initialData,
      ...pending,
      sku: initialData.sku || pending.sku || '',
    };

    setFormData({
      sku: merged.sku || '',
      brand_id: merged.brand_id || '',
      category_id: merged.category_id || '',
      type_id: merged.type_id || '',
      name: merged.name || '',
      size: merged.size || '',
      color: merged.color || '',
      rental_price: merged.rental_price || '',
      buffer_override: merged.buffer_override || '',
      status: merged.status || 'Available',
      website_status: merged.website_status || 'Draft',
      description: merged.description || '',
      tags: merged.tags || [],
      date_added: merged.date_added || new Date().toISOString().split('T')[0],
    });
    setMeas({
      outer: { ...(initialData.measurements?.outer || {}), ...(pending.measurements?.outer || {}) },
      inner: { ...(initialData.measurements?.inner || {}), ...(pending.measurements?.inner || {}) },
      skirt: { ...(initialData.measurements?.skirt || {}), ...(pending.measurements?.skirt || {}) },
    });
    setNotes(initialData?.notes || '');
    setImages(initialImages || []);
  }, [initialData, initialImages]);

  // Custom Input Refs
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [tagInputValue, setTagInputValue] = useState('');

  const colorInputRef = useRef<HTMLInputElement>(null);
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [colorFocusedIndex, setColorFocusedIndex] = useState(-1);

  // Dynamic Turnaround Buffer derived from Type settings
  const defaultBufferDays = useMemo(() => {
    const selectedType = types?.find((t: any) => String(t.id) === String(formData.type_id));
    return selectedType?.default_buffer_days ?? 3;
  }, [types, formData.type_id]);

  const effectiveBuffer = useMemo(() => {
    const parsed = parseInt(String(formData.buffer_override));
    return !isNaN(parsed) && parsed >= 0 ? parsed : defaultBufferDays;
  }, [formData.buffer_override, defaultBufferDays]);

  // --- 1. Validation & Header Badges ---
  const missingFields = useMemo(() => {
    const m = [];
    if (!formData.sku) m.push('Code/SKU');
    if (!formData.brand_id) m.push('Brand');
    if (!formData.name) m.push('Name');
    if (!formData.size) m.push('Size');
    if (!formData.rental_price) m.push('Price');
    if (images.length === 0) m.push('Pictures');
    return m;
  }, [formData, images]);

  const isComplete = missingFields.length === 0;

  // Calculate availability (FREE NOW vs BOOKED) using dynamic buffer
  const isBooked = useMemo(() => {
    if (!orders) return false;
    const today = new Date();
    return orders.some((o: any) => {
      const returnDate = new Date(o.return_date);
      const freeDate = new Date(returnDate);
      freeDate.setDate(freeDate.getDate() + effectiveBuffer);
      return today >= new Date(o.event_start_date) && today <= freeDate;
    });
  }, [orders, effectiveBuffer]);

  // --- 3. Auto Deposit Calculation ---
  const calculatedDeposit = useMemo(() => {
    const price = parseFloat(formData.rental_price) || 0;
    const tier = depositTiers.find((t: any) => price <= t.price_up_to) || depositTiers[depositTiers.length - 1];
    return tier ? tier.deposit_value : 0;
  }, [formData.rental_price, depositTiers]);

  // --- Handlers ---
  const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleMeasChange = (group: string, field: string, value: string) => {
    setMeas({ ...meas, [group]: { ...meas[group as keyof typeof meas], [field]: value ? parseInt(value) : undefined } });
  };

  // --- Tags Logic ---
  const addTag = (value: string) => {
    const cleanValue = value.trim().replace(/,+$/, '');
    if (cleanValue && !formData.tags.includes(cleanValue)) {
      setFormData({ ...formData, tags: [...formData.tags, cleanValue] });
    }
    setTagInputValue('');
  };

  const removeTag = (index: number) => {
    const newTags = [...formData.tags];
    newTags.splice(index, 1);
    setFormData({ ...formData, tags: newTags });
    tagInputRef.current?.focus();
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInputValue);
    } else if (e.key === 'Backspace' && tagInputValue === '') {
      if (formData.tags.length > 0) {
        removeTag(formData.tags.length - 1);
      }
    }
  };

  const handleTagBlur = () => {
    if (tagInputValue.trim() !== '') {
      addTag(tagInputValue);
    }
  };

  // --- Color Combobox Logic ---
  const filteredColors = colorOptions.filter((c: string) =>
    c.toLowerCase().includes(formData.color.toLowerCase())
  );

  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <>{text}</>;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="font-bold text-wine-ink bg-wine-soft px-0.5 rounded">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const handleColorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isColorOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setIsColorOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setColorFocusedIndex(prev => Math.min(prev + 1, filteredColors.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setColorFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (colorFocusedIndex >= 0 && colorFocusedIndex < filteredColors.length) {
        setFormData({ ...formData, color: filteredColors[colorFocusedIndex] });
        setIsColorOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsColorOpen(false);
      colorInputRef.current?.blur();
    }
  };

  // --- Image Upload Logic ---
  const handleImageUpload = async (e: any) => {
    const targetSku = initialData?.sku || formData.sku;
    const file = e.target.files[0];
    if (!file || !targetSku) return alert('Please set a SKU first.');
    setUploadingImage(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${targetSku}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('item-images').upload(fileName, file);

    if (!uploadError) {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-images/${fileName}`;

      if (!isNew) {
        const res = await addImageRecord(targetSku, url, images.length + 1);
        if (res?.data) {
          setImages([...images, res.data]);
        }
      } else {
        setImages([...images, { id: Date.now(), image_url: url, display_order: images.length + 1 }]);
      }
    } else {
      alert('Upload failed: ' + uploadError.message);
    }
    setUploadingImage(false);
  };

  const moveImage = async (index: number, direction: 'up' | 'down') => {
    const targetSku = initialData?.sku || formData.sku;
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === images.length - 1)) return;
    const newImages = [...images];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

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

  // --- Submissions & Approval Actions ---
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const targetSku = initialData?.sku || formData.sku;
    const res = await saveItem({ ...formData, sku: targetSku, measurements: meas }, isNew);

    if (res.error) {
      setErrorMsg(res.error);
      setLoading(false);
      return;
    }

    if (isNew) {
      for (const img of images) {
        await addImageRecord(targetSku, img.image_url, img.display_order);
      }
      if (!isSuperAdmin) alert('Item saved.');
      router.push(`/admin/inventory/${targetSku}`);
    } else {
      if (!isSuperAdmin) alert('Changes saved!');
      else alert('Changes saved!');
      router.refresh();
    }
    setLoading(false);
  };

  const handleArchiveToggle = async () => {
    const targetSku = initialData?.sku || formData.sku;
    setLoading(true);
    setErrorMsg('');
    const res = await toggleArchive(targetSku, initialData.is_archived);
    if (res?.error) {
      setErrorMsg(res.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    const targetSku = initialData?.sku || formData.sku;
    if (!confirm('Proceed with deletion?')) return;
    setLoading(true);
    setErrorMsg('');
    const res = await deleteItem(targetSku);
    if (res?.error) {
      setErrorMsg(res.error);
      setLoading(false);
      return;
    }

    router.push('/admin/inventory');
    router.refresh();
  };

  const handleApprove = async () => {
    const targetSku = initialData?.sku || formData.sku;
    setLoading(true);
    setErrorMsg('');
    const res = await approvePendingChanges(targetSku);
    if (res?.error) {
      setErrorMsg(res.error);
      setLoading(false);
      return;
    }

    if (initialData.pending_action === 'DELETE') {
      router.push('/admin/inventory');
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const handleReject = async () => {
    const targetSku = initialData?.sku || formData.sku;
    if (!confirm('Reject this request?')) return;
    setLoading(true);
    setErrorMsg('');
    const res = await rejectPendingAction(targetSku);
    if (res?.error) {
      setErrorMsg(res.error);
      setLoading(false);
      return;
    }

    if (initialData.pending_action === 'CREATE') {
      router.push('/admin/inventory');
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  // --- Dynamic Approval Banner Logic ---
  let pendingBanner = null;
  if (isSuperAdmin && initialData?.pending_action) {
    const pa = initialData.pending_action;
    if (pa === 'DELETE') {
      pendingBanner = { bg: 'bg-bad-bg border-[#D9A79C] text-bad', title: 'Deletion Request', text: 'A staff member requested to permanently delete this item.', approveBtn: 'bg-bad hover:bg-[#6A251C]' };
    } else if (pa === 'ARCHIVE') {
      pendingBanner = { bg: 'bg-warn-bg border-warn/40 text-warn-ink', title: 'Archive Request', text: 'A staff member requested to hide this item from the active catalog.', approveBtn: 'bg-warn hover:bg-[#B37B22]' };
    } else if (pa === 'UNARCHIVE') {
      pendingBanner = { bg: 'bg-[#EFEBE2] border-line text-ink', title: 'Unarchive Request', text: 'A staff member requested to restore this item to the active catalog.', approveBtn: 'bg-ink hover:bg-[#141811] text-white' };
    } else if (pa === 'CREATE') {
      pendingBanner = { bg: 'bg-[#F2F6EF] border-[#CAD3C5] text-wine-ink', title: 'New Item Request', text: 'A staff member drafted this new item.', approveBtn: 'bg-wine hover:bg-[#181E15]' };
    } else if (pa === 'EDIT') {
      pendingBanner = { bg: 'bg-wine-soft border-wine/20 text-wine-ink', title: 'Edit Request', text: 'A staff member submitted changes to this item.', approveBtn: 'bg-wine hover:bg-[#181E15]' };
    }
  }

  return (
    <div>
      {/* 1. SUPERADMIN DYNAMIC APPROVAL BANNER */}
      {pendingBanner && (
        <div className={`mb-6 p-5 rounded-xl border ${pendingBanner.bg} flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm`}>
          <div>
            <h3 className="font-bold text-lg mb-1">{pendingBanner.title}</h3>
            <p className="text-[13px] opacity-90">{pendingBanner.text} Please review the details below before approving.</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleReject}
              disabled={loading}
              className="px-4 py-2 bg-white border border-current/20 text-ink rounded-lg text-[13px] font-semibold hover:bg-[#FDFCFA] transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              Reject Request
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={loading}
              className={`px-4 py-2 text-white rounded-lg text-[13px] font-semibold transition cursor-pointer shadow-sm disabled:opacity-50 ${pendingBanner.approveBtn}`}
            >
              Approve {initialData.pending_action}
            </button>
          </div>
        </div>
      )}

      {/* 2. Validation Banner */}
      {(!pendingBanner || !isComplete) && (
        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${isComplete ? 'bg-[#F2F6EF] border-[#CAD3C5] text-wine-ink' : 'bg-warn-bg border-warn/30 text-warn-ink'}`}>
          <div className="text-[13px]">
            {isComplete ? (
              <><strong className="font-semibold">All required fields complete.</strong> Nothing on this item is holding it in Needs Attention.</>
            ) : (
              <><strong className="font-semibold">Needs Attention:</strong> Missing {missingFields.join(', ')}.</>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Header Badges & Actions */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1.5">Catalog · Inventory</div>
            <h1 className="font-serif text-[29px] font-normal tracking-[0.01em]">
              {isNew ? 'New Item' : `${initialData?.sku || formData.sku} — ${formData.name || 'Draft'}`}
            </h1>
            {!isNew && (
              <p className="text-muted text-[13px] mt-1">
                {brands.find((b: any) => b.id == formData.brand_id)?.name || 'No Brand'} · added {new Date(formData.date_added).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {!isNew && (
              <>
                {initialData.is_archived && <span className="bg-[#EFEBE2] text-muted text-[10px] font-bold tracking-widest uppercase rounded px-2 py-1 mr-2">Archived</span>}
                <span className={`text-[10px] font-bold tracking-widest uppercase rounded px-2 py-1 mr-2 ${formData.status === 'Available' ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'}`}>
                  {formData.status}
                </span>

                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  disabled={loading || !!initialData.pending_action}
                  className="font-medium border border-line bg-card text-ink rounded-lg px-3.5 py-2 text-sm hover:border-[#C9C2B4] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSuperAdmin ? (initialData.is_archived ? 'Unarchive' : 'Archive') : (initialData.is_archived ? 'Req Unarchive' : 'Req Archive')}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading || !!initialData.pending_action}
                  className="font-medium border border-line bg-card text-ink rounded-lg px-3.5 py-2 text-sm hover:border-[#C9C2B4] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSuperAdmin ? 'Delete' : 'Req Delete'}
                </button>
              </>
            )}
            <button
              type="submit"
              disabled={loading || (isSuperAdmin && !!initialData.pending_action)}
              className="font-medium border border-wine bg-wine text-white rounded-lg px-3.5 py-2 text-sm hover:bg-[#181E15] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (isSuperAdmin ? 'Save item' : (isNew ? 'Req Add' : 'Req Save'))}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 text-sm bg-bad-bg border border-[#D9A79C] text-bad rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* 2-Column Grid */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${initialData?.pending_action ? 'opacity-90 pointer-events-none' : ''}`}>

          {/* LEFT: Item Info */}
          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-3">Item information</h3>

            <div className="grid grid-cols-2 gap-3.5 mb-3.5">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Code / SKU <span className="text-bad">*</span></label>
                <input
                  required
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  disabled={!isNew}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 uppercase focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none disabled:bg-[#F1EEE7] disabled:text-muted"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Brand <span className="text-bad">*</span></label>
                <select
                  required
                  name="brand_id"
                  value={formData.brand_id}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                >
                  <option value="">— Select Brand —</option>
                  {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Item name <span className="text-bad">*</span></label>
              <input
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5 mb-3.5">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Category</label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                >
                  <option value="">— Select Category —</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Type</label>
                <select
                  name="type_id"
                  value={formData.type_id}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                >
                  <option value="">— Select Type —</option>
                  {types.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 mb-3.5">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Size <span className="text-bad">*</span></label>
                <input
                  required
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                />
              </div>
              <div className="relative">
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Color</label>
                <input
                  ref={colorInputRef}
                  name="color"
                  value={formData.color}
                  autoComplete="off"
                  onChange={(e) => {
                    handleChange(e);
                    setIsColorOpen(true);
                    setColorFocusedIndex(-1);
                  }}
                  onFocus={() => setIsColorOpen(true)}
                  onBlur={() => setIsColorOpen(false)}
                  onKeyDown={handleColorKeyDown}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                />

                {isColorOpen && filteredColors.length > 0 && (
                  <ul className="absolute z-20 w-full mt-1 bg-white border border-line rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
                    {filteredColors.map((color: string, index: number) => (
                      <li
                        key={color}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormData({ ...formData, color });
                          setIsColorOpen(false);
                        }}
                        onMouseEnter={() => setColorFocusedIndex(index)}
                        className={`px-3 py-2 text-[13px] cursor-pointer transition-colors ${
                          index === colorFocusedIndex ? 'bg-[#F6F4EF] text-wine-ink' : 'text-ink hover:bg-[#FBFAF6]'
                        }`}
                      >
                        {renderHighlightedText(color, formData.color)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Event Tags</label>
              <div
                className="flex flex-wrap items-center gap-1.5 border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] focus-within:ring-2 focus-within:ring-[#CAD3C5] focus-within:border-wine transition-all min-h-[38px] cursor-text"
                onClick={() => tagInputRef.current?.focus()}
              >
                {formData.tags.map((tag: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-wine-soft text-wine-ink text-[12.5px] px-2.5 py-0.5 rounded-[14px]">
                    {tag}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeTag(i); }}
                      className="text-muted hover:text-bad focus:outline-none flex items-center justify-center rounded-full w-3.5 h-3.5 leading-none transition-colors cursor-pointer"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInputValue}
                  onChange={(e) => setTagInputValue(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleTagBlur}
                  placeholder={formData.tags.length === 0 ? "Florals, black tie…" : ""}
                  className="flex-1 bg-transparent border-none outline-none text-[13px] text-ink min-w-[80px] p-0 focus:ring-0 placeholder-[#B4ACA0]"
                />
              </div>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Rental Price (Rp) <span className="text-bad">*</span></label>
              <input
                required
                type="number"
                name="rental_price"
                value={formData.rental_price}
                onChange={handleChange}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
              />
            </div>

            {/* Pricing & Dynamic Deposit/Buffer Calc */}
            <div className="grid grid-cols-2 gap-3.5 mb-3.5 p-3 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6]">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Deposit (From Tier)</label>
                <input disabled value={formatRupiah(calculatedDeposit)} className="w-full text-[13px] border-none bg-transparent font-semibold text-ink" />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Buffer Override</label>
                <input
                  type="number"
                  name="buffer_override"
                  value={formData.buffer_override}
                  onChange={handleChange}
                  placeholder={`Default (${defaultBufferDays})`}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 mb-3.5">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                >
                  <option>Available</option>
                  <option>Under Repair</option>
                  <option>Coming Soon</option>
                  <option>Unavailable</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Website Status</label>
                <select
                  name="website_status"
                  value={formData.website_status}
                  onChange={handleChange}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                >
                  <option>Published</option>
                  <option>Draft</option>
                </select>
              </div>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Date Added</label>
              <input
                type="date"
                name="date_added"
                value={formData.date_added}
                onChange={handleChange}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Description</label>
              <textarea
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
              />
            </div>
          </div>

          {/* RIGHT: Images & Measurements */}
          <div className="space-y-4">
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-3">Pictures <span className="text-bad">*</span> <span className="text-muted text-[12px] ml-2 font-sans">— order = display order</span></h3>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((img: any, i: number) => (
                  <div key={img.id} className="relative flex-shrink-0 w-28">
                    {i === 0 && <div className="absolute top-1 left-1 bg-white/90 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-wine-ink z-10 shadow-sm">COVER</div>}
                    <div className="h-36 bg-[#EBEFE6] rounded-lg overflow-hidden border border-line mb-1.5">
                      <img src={img.image_url} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex justify-between items-center text-muted">
                      <button type="button" onClick={() => moveImage(i, 'up')} className="p-1 hover:bg-[#F6F4EF] rounded cursor-pointer">↑</button>
                      <button type="button" onClick={() => moveImage(i, 'down')} className="p-1 hover:bg-[#F6F4EF] rounded cursor-pointer">↓</button>
                      <button type="button" onClick={() => removeImage(img.id)} className="p-1 hover:text-bad rounded cursor-pointer">×</button>
                    </div>
                  </div>
                ))}

                <label className="flex-shrink-0 w-28 h-36 flex flex-col items-center justify-center border border-dashed border-[#C9C2B4] rounded-lg cursor-pointer hover:bg-[#FDFCFA] transition text-muted text-sm font-medium">
                  {uploadingImage ? 'Uploading...' : '+ Upload'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                </label>
              </div>

              <div className="mt-3 p-3 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6] text-xs text-ink">
                <strong>Single source of truth.</strong> Saving this record publishes name, price, description, and pictures straight to the site.
              </div>
            </div>

            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-1">Measurements</h3>

              <div className="text-[11px] tracking-[0.16em] uppercase text-wine-ink font-bold mb-1 mt-4">Outer</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {['bust', 'waist', 'hips', 'length_front', 'length_back', 'shoulder', 'neck_hole', 'arm_hole', 'arm_length'].map(f => (
                  <div key={`outer-${f}`}>
                    <label className="block text-[10px] text-muted mb-0.5 capitalize">{f.replace('_', ' ')}</label>
                    <input
                      type="number"
                      value={meas.outer[f] || ''}
                      onChange={(e) => handleMeasChange('outer', f, e.target.value)}
                      className="w-full text-[13px] border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-wine bg-[#FDFCFA]"
                    />
                  </div>
                ))}
              </div>

              <div className="text-[11px] tracking-[0.16em] uppercase text-wine-ink font-bold mb-1">Inner</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {['bust', 'waist', 'hips', 'length'].map(f => (
                  <div key={`inner-${f}`}>
                    <label className="block text-[10px] text-muted mb-0.5 capitalize">{f.replace('_', ' ')}</label>
                    <input
                      type="number"
                      value={meas.inner[f] || ''}
                      onChange={(e) => handleMeasChange('inner', f, e.target.value)}
                      className="w-full text-[13px] border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-wine bg-[#FDFCFA]"
                    />
                  </div>
                ))}
              </div>

              <div className="text-[11px] tracking-[0.16em] uppercase text-wine-ink font-bold mb-1">Skirt</div>
              <div className="grid grid-cols-3 gap-2">
                {['waist', 'hips', 'length'].map(f => (
                  <div key={`skirt-${f}`}>
                    <label className="block text-[10px] text-muted mb-0.5 capitalize">{f.replace('_', ' ')}</label>
                    <input
                      type="number"
                      value={meas.skirt[f] || ''}
                      onChange={(e) => handleMeasChange('skirt', f, e.target.value)}
                      className="w-full text-[13px] border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-wine bg-[#FDFCFA]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* 5. Booking Schedule */}
      {!isNew && (
        <div className="mt-4 bg-card border border-line rounded-[10px] p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-[18px] font-normal">Booking schedule</h3>
            <span className={`text-[10px] font-bold tracking-widest uppercase rounded px-2 py-1 ${isBooked ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok'}`}>
              {isBooked ? 'BOOKED' : 'FREE NOW'}
            </span>
          </div>

          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[10px] text-muted uppercase tracking-wider border-b border-line">
                <th className="pb-2">Order</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2">Send</th>
                <th className="pb-2">Event</th>
                <th className="pb-2">Return Deadline</th>
                <th className="pb-2">Free Again</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(!orders || orders.length === 0) ? (
                <tr><td colSpan={7} className="py-4 text-muted">No historical bookings.</td></tr>
              ) : (
                orders.map((o: any) => {
                  const retDate = new Date(o.return_date);
                  const freeDate = new Date(retDate);
                  freeDate.setDate(freeDate.getDate() + effectiveBuffer);
                  return (
                    <tr key={o.order_id} className="border-b border-line border-dashed last:border-none">
                      <td className="py-2.5 font-bold">{o.order_id}</td>
                      <td className="py-2.5">{o.customer_name}</td>
                      <td className="py-2.5">{o.order_date}</td>
                      <td className="py-2.5">{o.event_start_date}</td>
                      <td className="py-2.5">{o.return_date}</td>
                      <td className="py-2.5 text-muted">{freeDate.toISOString().split('T')[0]}</td>
                      <td className="py-2.5"><span className="bg-[#F6F4EF] text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold">{o.status}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Notes & Activity Log */}
      {!isNew && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col">
            <h3 className="font-serif text-[18px] font-normal mb-1">Notes <span className="text-muted text-[12px] font-sans">— internal only</span></h3>
            <div className="flex-1 mt-2">
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] focus:bg-white focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none transition"
                placeholder="Add internal notes..."
              />
              <button
                type="button"
                onClick={() => saveNotes(initialData?.sku || formData.sku, notes)}
                className="mt-2 text-sm font-medium border border-line bg-white rounded-lg px-3 py-1.5 hover:bg-[#F6F4EF] cursor-pointer"
              >
                Post Note
              </button>
            </div>
          </div>

          <div className="bg-card border border-line rounded-[10px] p-5 h-64 overflow-y-auto">
            <h3 className="font-serif text-[18px] font-normal mb-3">Activity log</h3>
            {(!auditLogs || auditLogs.length === 0) ? (
              <p className="text-sm text-muted">No changes recorded yet.</p>
            ) : (
              <ul className="space-y-3 relative before:absolute before:inset-y-0 before:left-[7px] before:w-[1px] before:bg-line">
                {auditLogs.map((log: any) => (
                  <li key={log.id} className="relative pl-5 text-[12px]">
                    <span className="absolute left-1 top-1.5 w-1.5 h-1.5 rounded-full bg-muted"></span>
                    <span className="font-medium text-ink">{log.admin_name}</span> {log.action_type.replace(/_/g, ' ')} <span className="text-muted">· {new Date(log.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
