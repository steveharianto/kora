'use client';

import { useState, useEffect, useRef } from 'react';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLeafletReady, setIsLeafletReady] = useState(false);

  // Default coordinate: Surabaya center (-7.2575, 112.7521) or provided coordinates
  const lat = initialData?.latitude ?? -7.2575;
  const lng = initialData?.longitude ?? 112.7521;

  // 1. Dynamically load Leaflet CDN assets safely in Next.js
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

    return () => {
      // clean-up if unmounted before script finishes
    };
  }, []);

  // 2. Initialize Map & Pin
  useEffect(() => {
    if (!isLeafletReady || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const L = window.L;

      const map = L.map(mapContainerRef.current).setView([lat, lng], initialData?.latitude ? 16 : 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom Pin Icon
      const pinIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color:#2C3527;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);

      marker.on('dragend', async () => {
        const position = marker.getLatLng();
        await reverseGeocode(position.lat, position.lng);
      });

      map.on('click', async (e: any) => {
        marker.setLatLng(e.latlng);
        await reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }

    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
  }, [isLeafletReady]);

  // Reverse Geocode (Coordinate -> Address via Nominatim)
  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const city = addr.city || addr.town || addr.municipality || addr.county || '';
        const street = [addr.road, addr.house_number, addr.suburb].filter(Boolean).join(', ') || data.display_name;
        const postcode = addr.postcode || '';

        onChange({
          street_address: street || initialData?.street_address || '',
          city: city || initialData?.city || '',
          postal_code: postcode || initialData?.postal_code || '',
          latitude: parseFloat(latitude.toFixed(7)),
          longitude: parseFloat(longitude.toFixed(7)),
        });
      } else {
        onChange({
          street_address: initialData?.street_address || '',
          city: initialData?.city || '',
          postal_code: initialData?.postal_code || '',
          latitude: parseFloat(latitude.toFixed(7)),
          longitude: parseFloat(longitude.toFixed(7)),
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
    }
  };

  // Search Address (Text -> Coordinate via Nominatim)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&addressdetails=1&limit=5&countrycodes=id`
      );
      const data = await res.json();
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const handleSelectResult = (result: any) => {
    const latNum = parseFloat(result.lat);
    const lonNum = parseFloat(result.lon);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([latNum, lonNum], 16);
      markerRef.current.setLatLng([latNum, lonNum]);
    }

    const addr = result.address || {};
    const city = addr.city || addr.town || addr.municipality || addr.county || '';
    const street = [addr.road, addr.house_number, addr.suburb].filter(Boolean).join(', ') || result.display_name;
    const postcode = addr.postcode || '';

    onChange({
      street_address: street,
      city,
      postal_code: postcode,
      latitude: parseFloat(latNum.toFixed(7)),
      longitude: parseFloat(lonNum.toFixed(7)),
    });

    setSearchResults([]);
    setSearchQuery('');
  };

  return (
    <div className="space-y-2.5">
      {/* Search Bar */}
      <div className="relative">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Cari jalan, komplek, atau area (OpenStreetMap)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-[12.5px] border border-line rounded-lg px-3 py-1.5 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching}
            className="text-[12.5px] font-medium border border-line bg-card px-3 py-1.5 rounded-lg hover:bg-[#F6F4EF] transition cursor-pointer disabled:opacity-50"
          >
            {searching ? 'Mencari...' : 'Cari'}
          </button>
        </form>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <ul className="absolute z-30 w-full mt-1 bg-white border border-line rounded-lg shadow-lg max-h-48 overflow-y-auto py-1 text-xs">
            {searchResults.map((item, idx) => (
              <li
                key={idx}
                onClick={() => handleSelectResult(item)}
                className="px-3 py-2 cursor-pointer hover:bg-[#F6F4EF] text-ink border-b border-line last:border-none"
              >
                <div className="font-semibold">{item.name || item.display_name.split(',')[0]}</div>
                <div className="text-[10.5px] text-muted truncate">{item.display_name}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-56 rounded-lg border border-line overflow-hidden bg-[#EFEBE2] z-10"
      />
      <div className="flex justify-between text-[11px] text-muted">
        <span>Geser pin atau klik di peta untuk menentukan koordinat.</span>
        <span>
          Lat: {initialData?.latitude || '—'}, Lng: {initialData?.longitude || '—'}
        </span>
      </div>
    </div>
  );
}
