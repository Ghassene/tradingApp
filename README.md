# Taux CHF · EUR · TND

Petite application Next.js qui affiche les taux de change réels entre le franc suisse (CHF), l'euro (EUR) et le dinar tunisien (TND) :

- **CHF / EUR**, **EUR / TND** et **CHF / TND**, avec la variation sur 1 jour ;
- un graphique de l'évolution sur 7, 30 ou 90 jours ;
- un convertisseur entre les trois devises.

## Source des données

Les taux viennent de l'API publique et gratuite [currency-api](https://github.com/fawazahmed0/exchange-api), servie par jsDelivr (aucune clé nécessaire). C'est l'une des rares sources gratuites qui couvre le dinar tunisien.

- Taux **quotidiens** (un point par jour), taux moyens sans marge bancaire.
- Si jsDelivr ne répond pas, l'application essaie le miroir `currency-api.pages.dev`.
- La page est régénérée au plus toutes les heures.

## Lancer le projet

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

Pour une version de production :

```bash
npm run build
npm start
```

Aucune base de données ni variable d'environnement n'est nécessaire.

## API

| Route | Description |
| --- | --- |
| `GET /api/rates?days=30` | Taux du jour et historique des `days` derniers jours (1 à 365). |
| `GET /api/health` | Renvoie `{ "ok": true }`. |

## Structure

```
src/
  app/
    page.tsx              page d'accueil (charge 90 jours de taux)
    layout.tsx            thème et polices
    api/rates/route.ts    API JSON des taux
    api/health/route.ts   vérification de santé
  components/
    RatesDashboard.tsx    cartes, graphique et convertisseur
  lib/
    rates.ts              récupération des taux depuis currency-api
```

## App mobile iOS

Une version iPhone (Expo / React Native) se trouve dans le dossier [`mobile/`](mobile/README.md).
