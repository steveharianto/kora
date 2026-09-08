'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Loader2, Navigation, CheckCircle2, AlertCircle } from 'lucide-react';

interface AddressData {
  street_address: string;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
}

interface AddressMapPickerProps {
  initialData?: AddressData;
  onChange: (data: AddressData) => void;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function AddressMapPicker({ initialData, onChange }: AddressMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLeafletReady, setIsLeafletReady] = useState(false);
  const [activeResultIdx, setActiveResultIdx] = useState(-1);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  // Default coordinate: Jakarta Showroom (-6.23827, 106.81056)
  const currentLat = initialData?.latitude ?? -6.23827;
  const currentLng = initialData?.longitude ?? 106.81056;

  // 1. Safe Leaflet Asset Ingestion
  useEffect(() => {
    if (window.L) {
      setIsLeafletReady(true);
      return;
    }

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setIsLeafletReady(true);
    document.body.appendChild(script);
  }, []);

  // 2. Normalization Helper for Indonesian Administrative Divisions
  const normalizeAddress = (data: any, latNum: number, lonNum: number) => {
    const addr = data.address || {};

    // Standardize City (Kota/Kabupaten)
    let city = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || '';
    if (city.toLowerCase().includes('south jakarta')) city = 'Jakarta Selatan';
    if (city.toLowerCase().includes('west jakarta')) city = 'Jakarta Barat';
    if (city.toLowerCase().includes('central jakarta')) city = 'Jakarta Pusat';
    if (city.toLowerCase().includes('east jakarta')) city = 'Jakarta Timur';
    if (city.toLowerCase().includes('north jakarta')) city = 'Jakarta Utara';

    // Build concise street line
    const streetComponents = [
      addr.road,
      addr.house_number ? `No. ${addr.house_number}` : '',
      addr.suburb || addr.neighbourhood || addr.village || '',
      addr.residential || '',
    ].filter(Boolean);

    const street = streetComponents.length > 0
      ? streetComponents.join(', ')
      : data.display_name?.split(',').slice(0, 3).join(', ') || '';

    const postcode = addr.postcode || '';

    return {
      street_address: street,
      city: city.replace(/^(Kota|Kabupaten)\s+/i, '').trim(),
      postal_code: postcode,
      latitude: parseFloat(latNum.toFixed(7)),
      longitude: parseFloat(lonNum.toFixed(7)),
    };
  };

  // 3. Reverse Geocode (Coordinate -> Address)
  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );
      const data = await res.json();
      if (data && data.address) {
        const normalized = normalizeAddress(data, latitude, longitude);
        onChange({
          ...normalized,
          street_address: normalized.street_address || initialData?.street_address || '',
          city: normalized.city || initialData?.city || '',
        });
      }
    } catch {
      onChange({
        street_address: initialData?.street_address || '',
        city: initialData?.city || '',
        postal_code: initialData?.postal_code || '',
        latitude: parseFloat(latitude.toFixed(7)),
        longitude: parseFloat(longitude.toFixed(7)),
      });
    } finally {
      setGeocoding(false);
    }
  }, [initialData, onChange]);

  // 4. Initialize Map & Pin
  useEffect(() => {
    if (!isLeafletReady || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const L = window.L;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([currentLat, currentLng], initialData?.latitude ? 16 : 13);

      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // Editorial styling for pin
      const pinIcon = L.divIcon({
        className: 'custom-pin-root',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 rounded-full bg-[#2C3527] text-white flex items-center justify-center shadow-lg border-2 border-white transform -translate-y-1/2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([currentLat, currentLng], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);

      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        await reverseGeocode(pos.lat, pos.lng);
      });

      map.on('click', async (e: any) => {
        marker.setLatLng(e.latlng);
        await reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }

    // Auto-fix layout sizing with ResizeObserver
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize();
    });
    if (mapContainerRef.current) observer.observe(mapContainerRef.current);

    return () => observer.disconnect();
  }, [isLeafletReady, currentLat, currentLng, reverseGeocode, initialData?.latitude]);

  // 5. Progressive Search (Query -> Coordinates)
  const runNominatim = async (query: string) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&addressdetails=1&limit=6&countrycodes=id`
    );
    return await res.json();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchNotice(null);
    setActiveResultIdx(-1);

    try {
      // Pass 1: Literal raw search
      let data = await runNominatim(searchQuery.trim());

      // Pass 2: Progressive fallback for Indonesian complex/block phrasing
      if (!data || data.length === 0) {
        const cleaned = searchQuery
          .replace(/\b(blok|block|no|nomor|rt|rw|gang|gg)\b\.?\s*[\w\d\-\/]+/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleaned.length >= 3 && cleaned !== searchQuery.trim()) {
          data = await runNominatim(cleaned);
          if (data && data.length > 0) {
            setSearchNotice(`Alamat spesifik tidak ditemukan di peta. Menampilkan area: "${cleaned}"`);
          }
        }
      }

      setSearchResults(data || []);
      if (!data || data.length === 0) {
        setSearchNotice('Lokasi tidak ditemukan. Coba ketik nama jalan utama atau geser pin manual pada peta.');
      }
    } catch {
      setSearchResults([]);
      setSearchNotice('Gagal menghubungkan ke server peta. Silakan geser pin manual.');
    } finally {
      setSearching(false);
    }
  };

  // 6. Center to Result
  const handleSelectResult = (result: any) => {
    const latNum = parseFloat(result.lat);
    const lonNum = parseFloat(result.lon);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([latNum, lonNum], 17);
      markerRef.current.setLatLng([latNum, lonNum]);
    }

    const normalized = normalizeAddress(result, latNum, lonNum);
    onChange(normalized);

    setSearchResults([]);
    setSearchNotice(null);
    setSearchQuery('');
  };

  // 7. Locate User via GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung geolokasi GPS.');
      return;
    }

    setGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([userLat, userLng], 17);
          markerRef.current.setLatLng([userLat, userLng]);
        }

        await reverseGeocode(userLat, userLng);
        setGeocoding(false);
      },
      () => {
        alert('Gagal mendeteksi lokasi. Pastikan izin lokasi aktif.');
        setGeocoding(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-2 font-sans">
      {/* Search Bar Barricaded from Form Bubbling */}
      <div className="relative">
        <div className="flex gap-1.5 items-center">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari jalan, komplek perumahan, atau area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (activeResultIdx >= 0 && searchResults[activeResultIdx]) {
                    handleSelectResult(searchResults[activeResultIdx]);
                  } else {
                    handleSearch();
                  }
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveResultIdx((prev) => Math.min(prev + 1, searchResults.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveResultIdx((prev) => Math.max(prev - 1, 0));
                } else if (e.key === 'Escape') {
                  setSearchResults([]);
                }
              }}
              className="w-full text-[13px] border border-line rounded-lg pl-8 pr-3 py-2 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none placeholder-[#B4ACA0]"
            />
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSearch();
            }}
            disabled={searching}
            className="px-3.5 py-2 text-xs font-semibold bg-wine text-white rounded-lg hover:bg-[#181E15] transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
          >
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cari'}
          </button>

          <button
            type="button"
            title="Gunakan Lokasi GPS Saya"
            onClick={handleLocateMe}
            disabled={geocoding}
            className="p-2 border border-line bg-white rounded-lg hover:bg-[#F6F4EF] text-ink transition cursor-pointer flex-shrink-0"
          >
            <Navigation className={`w-4 h-4 ${geocoding ? 'animate-pulse text-wine' : ''}`} />
          </button>
        </div>

        {/* Fallback Notice */}
        {searchNotice && (
          <div className="mt-1.5 p-2 bg-[#FBF8EF] border border-[#E8DFC2] text-[#84661E] rounded-md text-[11px] flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{searchNotice}</span>
          </div>
        )}

        {/* Results Dropdown */}
        {searchResults.length > 0 && (
          <ul className="absolute z-30 w-full mt-1.5 bg-white border border-line rounded-xl shadow-xl max-h-56 overflow-y-auto py-1 text-xs">
            {searchResults.map((item, idx) => (
              <li
                key={idx}
                onClick={() => handleSelectResult(item)}
                onMouseEnter={() => setActiveResultIdx(idx)}
                className={`px-3 py-2.5 cursor-pointer border-b border-line last:border-none transition ${
                  idx === activeResultIdx ? 'bg-[#F6F4EF] text-wine-ink' : 'text-ink hover:bg-[#FDFCFA]'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-muted flex-shrink-0" />
                  <span className="truncate">{item.name || item.display_name.split(',')[0]}</span>
                </div>
                <div className="text-[11px] text-muted truncate pl-4.5 mt-0.5">
                  {item.display_name}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map Display Container */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          className="w-full h-64 rounded-xl border border-line overflow-hidden bg-[#EFEBE2] z-10"
        />

        {geocoding && (
          <div className="absolute top-2.5 left-2.5 z-20 bg-white/95 backdrop-blur-xs border border-line px-2.5 py-1 rounded-md text-[11px] font-medium shadow-sm flex items-center gap-1.5 text-ink">
            <Loader2 className="w-3 h-3 animate-spin text-wine" />
            <span>Mengambil rincian alamat...</span>
          </div>
        )}
      </div>

      {/* Coordinate Readout */}
      <div className="flex items-center justify-between text-[11px] text-muted pt-0.5">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-[#2E7D47]" />
          Klik peta atau seret pin untuk kalibrasi titik kurir.
        </span>
        <span className="font-mono font-medium text-ink bg-[#F6F4EF] px-1.5 py-0.5 rounded border border-line">
          {initialData?.latitude ? `${initialData.latitude}, ${initialData.longitude}` : 'Belum Ditandai'}
        </span>
      </div>
    </div>
  );
}
