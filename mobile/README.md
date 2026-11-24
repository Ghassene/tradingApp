# App mobile iOS · Taux CHF · EUR · TND

Application iPhone (Expo / React Native) qui affiche les mêmes taux réels que le site : CHF/EUR, EUR/TND et CHF/TND, avec un graphique sur 7, 30 ou 90 jours et un convertisseur. Tirez l'écran vers le bas pour actualiser.

## L'essayer sur votre iPhone (gratuit, sans Mac)

1. Installez **Expo Go** depuis l'App Store sur l'iPhone.
2. Sur le PC, dans ce dossier :

   ```bash
   npm install
   npx expo start
   ```

3. Scannez le QR code affiché avec l'appareil photo de l'iPhone. L'app s'ouvre dans Expo Go.

Le PC et l'iPhone doivent être sur le même Wi-Fi. Sinon, lancez `npx expo start --tunnel`.

## La publier sur l'App Store

Il faut un compte **Apple Developer** (99 $ par an). La compilation se fait dans le cloud d'Expo (EAS), donc pas besoin de Mac :

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform ios
npx eas-cli@latest submit --platform ios
```

L'identifiant de l'app est `com.ghassene.tauxchfeurtnd` (dans `app.json`), modifiable avant la première publication.

## Données

Même source que le site : [currency-api](https://github.com/fawazahmed0/exchange-api), taux quotidiens moyens, sans clé d'API.

## Structure

```
App.tsx            écran principal (cartes, graphique, convertisseur)
src/rates.ts       récupération des taux
src/RateChart.tsx  graphique tactile (react-native-svg)
app.json           nom, icône, identifiant iOS
```
