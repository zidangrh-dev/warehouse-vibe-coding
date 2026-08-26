// Komponen gambar yang mengambil foto dengan header Authorization (bukan token di URL).
// Fix Strix vuln-0004: JWT tidak lagi bocor via query string di web.
import React, { useEffect, useState } from 'react';
import { Image, Platform } from 'react-native';
import { photoUrl, authImageHeaders } from './api';

export default function AuthImage({ photo, style, resizeMode, ...rest }) {
  const [uri, setUri] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    async function load() {
      if (!photo?.filename) return;
      const url = photoUrl(photo);
      // Native: token via query (aman, tidak ada referrer leak).
      if (Platform.OS !== 'web') {
        if (!cancelled) setUri(url);
        return;
      }
      // Web: fetch dengan Authorization header -> blob URL.
      try {
        const res = await fetch(url, { headers: authImageHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setUri(objectUrl);
      } catch (e) {
        if (!cancelled) setUri(null);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo?.filename]);

  return (
    <Image
      source={uri ? { uri } : undefined}
      style={style}
      resizeMode={resizeMode}
      {...rest}
    />
  );
}
