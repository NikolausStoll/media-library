// Vorhandene Logos:
// platforms/  → switch.svg, xbox.svg, playstation.svg (Platzhalter)
// storefronts/ → steam.svg, epic.svg, gog.svg, bnet.png, xbox-app.svg

const PLACEHOLDER = '/platforms/playstation.svg';

export const platformLogos = {
  pc:     PLACEHOLDER,               // kein PC-Logo vorhanden
  xbox:   '/platforms/xbox.svg',
  switch: '/platforms/switch.svg',
  '3ds':  '/platforms/3ds.svg',               // kein 3DS-Logo vorhanden
};

export const storefrontLogos = {
  steam:     '/storefronts/steam.svg',
  epic:      '/storefronts/epic.svg',
  gog:       '/storefronts/gog.svg',
  battlenet: '/storefronts/bnet.png',
  xbox:      '/storefronts/xbox-app.svg',
  uplay:     '/storefronts/ubisoft.png',            // kein Ubisoft-Logo vorhanden
  ea:        '/storefronts/ea.png',            // kein EA-Logo vorhanden
};

/**
 * Gibt das korrekte Logo für eine Platform-Eintrag zurück.
 * PC-Einträge nutzen immer das Storefront-Logo (falls vorhanden).
 */
export function getPlatformLogo(platform, storefront) {
  if (platform === 'pc' && storefront) {
    return storefrontLogos[storefront] ?? PLACEHOLDER;
  }
  return platformLogos[platform] ?? PLACEHOLDER;
}
