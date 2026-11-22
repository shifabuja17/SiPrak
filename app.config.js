/**
 * Melengkapi app.json dengan nilai rahasia dari environment.
 *
 * Google Maps di Android (development/production build) butuh API key; Expo Go sudah
 * punya key sendiri. Key dibaca dari `GOOGLE_MAPS_API_KEY` di `.env` (tidak di-commit)
 * atau dari environment variable EAS, lalu diteruskan ke plugin `react-native-maps`.
 * Tanpa awalan EXPO_PUBLIC_, key tidak ikut ke bundle JavaScript.
 */
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    console.warn(
      '[app.config] GOOGLE_MAPS_API_KEY belum diisi: tab Peta di build Android menampilkan pesan, bukan peta.',
    );
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      // Dibaca layar Peta: tanpa key, peta Google crash di build Android, jadi layar
      // menampilkan pesan alih-alih membuka peta.
      googleMapsConfigured: Boolean(googleMapsApiKey),
    },
    plugins: (config.plugins ?? []).map((plugin) =>
      plugin === 'react-native-maps'
        ? ['react-native-maps', { androidGoogleMapsApiKey: googleMapsApiKey ?? '' }]
        : plugin,
    ),
  };
};
