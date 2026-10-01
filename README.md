# SalisCRM

CRM interne de **Salis 3 Hottes** (nettoyage / dégraissage d'extraction) : demandes du site, clients, devis, interventions, factures, paiements.

- **Front** : React 19, Vite, TypeScript, Tailwind 4, TanStack Query
- **Backend** : Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions)
- La base est **partagée avec le site public `pro-extract-hub`**, qui écrit les demandes dans `leads`.

## Démarrage local

Prérequis : Node 24 (voir `.nvmrc`), et un projet Supabase de **staging** (jamais la production pour développer).

```bash
npm ci
cp .env.example .env.local   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # http://localhost:5174
```

Sans Supabase, `VITE_DEMO_MODE=true` lance une démo complète avec des données fictives. Le build refuse ce mode quand `VITE_APP_ENV=production`.

## Structure du code

```
src/
  features/<domaine>/   pages et composants propres à un domaine métier :
                        clients (fiche découpée par onglet dans detail/), quotes, invoices, payments,
                        interventions, leads, quote-requests, providers, commercials, dashboard,
                        agenda, catalog, chat, settings, auth, documents, app
  components/ui/        briques d'interface réutilisables (design system)
  components/           layout (cadre de l'application), auth (garde de routes), brand, media
  lib/                  logique sans interface : supabase (client, types générés), pdf, facturx,
                        quotes (calculs), auth (permissions), interventions, email, storage…
  contexts/             AuthContext (session, rôle, double authentification)
  demo/                 mode démonstration (chargé à la demande)
supabase/               migrations, Edge Functions, tests de base de données
scripts/  e2e/  docs/   génération des types, validation Factur-X · test navigateur · RGPD
```

Règle : une page n'importe pas les fichiers internes d'une autre fonctionnalité sauf pour des composants volontairement partagés (ex. `features/quotes/SendQuoteDialog`). Les requêtes Supabase restent dans les pages ou dans `lib/` ; la logique critique (calculs, droits) est en base.

## Où est la logique métier

Les règles critiques sont **en base**, pas dans le navigateur. Le front ne fait qu'appeler des fonctions :

| Domaine | Garanti par la base | Appels front |
|---|---|---|
| Numérotation | `CLI-`, `INT-`, `D-`, `F-`, `AV-` par année, sans trou | automatique à l'insertion |
| Devis | totaux avec remise, statuts autorisés, verrouillés hors brouillon | `create_quote` |
| Factures | immuables après émission, annulation par avoir uniquement | `create_invoice`, `create_invoice_from_quote`, `cancel_invoice` |
| Paiements | pas de sur-encaissement, statut de facture recalculé | insertion dans `payments` |
| Opérations | conversion demande → client, devis → intervention, rapport | `convert_lead_to_client`, `create_intervention_from_quote`, `save_intervention_report` |
| Accès | rôles admin / commercial / prestataire, invitation | `grant_staff_access`, `revoke_staff_access`, Edge Function `invite-staff` |
| Audit | historique de toutes les écritures (lecture direction) | table `audit_log` |

Rôles :
- **admin (direction)** : tout, y compris avoirs, suppressions, gestion des accès.
- **commercial** : clients, devis, factures, paiements, interventions.
- **prestataire** : uniquement ses interventions (avancement, notes, photos, rapport). Aucune donnée financière : il lit la vue `provider_interventions` (sans prix HT) et avance ses interventions par `provider_update_intervention` ; il n'a aucun accès direct à la table `interventions`.

## Factur-X (factures et avoirs)

Les factures et les avoirs se téléchargent au format **Factur-X** : un PDF/A-3 lisible par un humain qui contient le XML structuré (syntaxe CII, profil **EN 16931**). Les devis restent des PDF classiques.

**Validé, pas seulement généré** : `npm run test:facturx` (et la CI) soumettent des factures réalistes — remise sur deux taux de TVA, arrondis piégeux, TVA à 0 %, règlements partiels, avoir — au validateur open source **Mustang** (règles Schematron EN 16931, règles françaises BR-FR, et veraPDF pour le PDF/A-3B). Un fichier au total incohérent est bien rejeté. Le fichier réellement produit par le navigateur a aussi été validé.

À savoir :
- **Aucune plateforme agréée (PDP) n'est connectée.** Le fichier est conforme, mais sa transmission (dépôt sur la PDP de votre choix, ou envoi au client) reste à votre charge. La réforme française ajoute des mentions (catégorie d'opération, adresse de livraison…) qui dépendent de la plateforme retenue : **à valider avec elle** avant l'échéance qui vous concerne.
- TVA à 0 % : traitée comme « exonérée » avec le motif générique « Exonération de TVA ». Si vous avez des cas particuliers (autoliquidation, export, article du CGI), le motif doit être précisé.
- Quantités en « unité » (code C62), un seul pays (France), numéro de TVA du client non géré.
- Les polices (Roboto, Apache 2.0) et le profil sRGB sont intégrés aux fichiers : voir `src/lib/pdf/assets/LICENSES.md`.

## Documents PDF

Devis, factures et avoirs se téléchargent en PDF depuis leur fiche (boutons « PDF », « Facture Factur-X », « Avoir Factur-X »). Le PDF est généré dans le navigateur (`src/lib/pdf/`, bibliothèque chargée au premier clic) à partir des montants **enregistrés en base** : il n’y a aucun recalcul côté client.

Il contient les mentions obligatoires d’une facture (numéro, dates, identité des deux parties, ventilation HT/TVA par taux, pénalités de retard, indemnité de recouvrement de 40 €, escompte). Les coordonnées bancaires ne sont imprimées que si l’IBAN de `src/lib/company.ts` est valide.

> **À vérifier avant la mise en service** : les informations société de `src/lib/company.ts` (adresse, SIREN/SIRET, TVA, capital, IBAN/BIC) figurent sur chaque document. L’IBAN actuel est un exemple : il ne sera pas imprimé tant qu’il n’est pas remplacé par le vrai.

## Envoi des devis par e-mail

Le bouton « Envoyer le devis » expédie le PDF en pièce jointe via l'Edge Function `send-document-email` (Resend). Le devis ne passe en « envoyé » que si l'e-mail est réellement parti. Garde-fous : réservé aux commerciaux / direction, destinataire = adresse d'un **client enregistré**, pièce jointe limitée à 5 Mo.

Activation :

1. Créer un compte [Resend](https://resend.com) et **vérifier le domaine d'envoi** (enregistrements SPF / DKIM chez le registrar) — sans cela les e-mails partent en spam.
2. `npx supabase secrets set RESEND_API_KEY=... EMAIL_FROM="Salis 3 Hottes <devis@votre-domaine.fr>" EMAIL_REPLY_TO=contact@votre-domaine.fr`
3. `npx supabase functions deploy send-document-email`
4. Définir `VITE_EMAIL_PROVIDER=resend` dans Vercel et redéployer.

Tant que `VITE_EMAIL_PROVIDER` est vide, le dialogue propose uniquement « Marquer comme envoyé manuellement » (le PDF se télécharge et se transmet à la main).

## Double authentification (MFA)

Chaque utilisateur peut l'activer depuis **Sécurité du compte** (menu latéral) avec une application d'authentification (Google Authenticator, Authy, 1Password…). Elle est **appliquée par la base** : dès qu'un compte l'a activée, ses droits d'accès (fonction `mfa_satisfied`) sont nuls tant que la session n'a pas passé le code. Un mot de passe volé ne donne donc accès à aucune donnée.

- **Téléphone perdu** : dans le tableau de bord Supabase → Authentication → Users → l'utilisateur → supprimer le facteur MFA. L'utilisateur se reconnecte avec son mot de passe seul.
- **Dernier admin verrouillé** : même procédure (dashboard), ou SQL : `DELETE FROM auth.mfa_factors WHERE user_id = '<uuid>';`.
- **Obligatoire pour la direction (interrupteur)** : Paramètres → « Double authentification de la direction » → « Rendre obligatoire ». Désactivé par défaut. Un administrateur sans double authentification n'a alors plus accès à rien jusqu'à ce qu'il l'active (il est redirigé vers « Sécurité du compte »). On ne peut l'activer que depuis un compte qui l'a lui-même activée, et l'écran liste les administrateurs qui seraient bloqués. **Avant de l'activer en production**, vérifiez que TOTP est bien activé dans Supabase (Authentication → Multi-Factor) en enrôlant votre propre compte.

## RGPD

Outils pour la direction (voir `docs/RGPD.md`, registre des traitements à valider) :

- fiche client → **Exporter les données** (JSON) et **Anonymiser** (les factures restent 10 ans) ;
- Paramètres → **Conservation des données** : purge des demandes anciennes jamais converties, avec simulation préalable. La purge est **manuelle** : rien n'est supprimé automatiquement.

## Base de données

Les types TypeScript des tables, vues et enums (`src/lib/supabase/database.generated.ts`) sont **générés depuis les migrations** (`npm run types:gen`), sans accès à un projet Supabase. Après toute migration, régénérez-les et committez le fichier : la CI le vérifie. Les signatures des fonctions RPC restent écrites à la main dans `src/lib/supabase/types.ts`.

Les migrations sont dans `supabase/migrations/`, toutes rejouables sans effet de bord. La première (`baseline_shared_objects`) recrée `leads`, `staff_profiles` et le bucket `lead-documents`, mais ne modifie rien s'ils existent déjà (cas de la production).

```bash
npm run test:db   # joue toutes les migrations sur un Postgres embarqué + 189 contrôles
```

À lancer avant chaque migration. La CI le fait aussi sur chaque pull request.

Appliquer sur un projet :

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push              # --include-all si la CLI signale la migration « baseline »
npx supabase functions deploy invite-staff
```

Ordre recommandé : **staging → vérification manuelle → production**.

## Mise en production — checklist

### Supabase (tableau de bord du projet)

- [ ] Sauvegardes quotidiennes actives ; **PITR** recommandé (Database → Backups).
- [ ] Extension **pg_cron** activée *avant* la migration `invoicing_integrity` (factures en retard, devis expirés chaque nuit).
- [ ] Authentication → Sign In / Providers : **désactiver les inscriptions publiques**. L'accès se fait par invitation depuis Paramètres. Vérifier au préalable que `pro-extract-hub` n'en dépend pas.
- [ ] Authentication → Password : 10 caractères minimum, minuscules + majuscules + chiffres, protection contre les mots de passe fuités.
- [ ] Authentication → URL Configuration : Site URL = URL de production ; Redirect URLs = `https://<domaine>/definir-mot-de-passe`.
- [ ] Authentication → Emails : SMTP personnalisé (l'envoi par défaut de Supabase est limité à quelques e-mails par heure).
- [ ] Authentication → Multi-Factor : **TOTP activé** (sinon la page « Sécurité du compte » ne peut pas enregistrer d’appareil).
- [ ] Edge Function `invite-staff` déployée.

### Premier compte direction

Créer l'utilisateur (Authentication → Users → Invite), puis dans l'éditeur SQL :

```sql
INSERT INTO public.staff_profiles (user_id, role, display_name)
SELECT id, 'admin', 'Direction' FROM auth.users WHERE email = 'direction@salis3hottes.fr';
```

Tous les comptes suivants se gèrent dans l'application (Paramètres → Inviter un membre). Un prestataire doit être associé à sa fiche prestataire.

### Hébergement (Vercel)

`vercel.json` configure la réécriture SPA, les en-têtes de sécurité (CSP, HSTS, anti-iframe…) et le cache des fichiers.

Variables d'environnement du projet Vercel :

| Variable | Production | Preview |
|---|---|---|
| `VITE_SUPABASE_URL` | projet prod | projet staging |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé publishable prod | clé staging |
| `VITE_APP_ENV` | `production` | `staging` |
| `VITE_SENTRY_DSN` | DSN Sentry | DSN Sentry |

Après le premier déploiement, ouvrir la console du navigateur : aucune erreur « Content Security Policy » ne doit apparaître.

### Suivi des erreurs

Créer un projet Sentry (plateforme React) et renseigner `VITE_SENTRY_DSN`. Sans DSN, rien n'est envoyé.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | typecheck + build de production (`dist/`) |
| `npm run typecheck` | vérification TypeScript |
| `npm run test:db` | migrations + tests base de données |
| `npm run test:unit` | tests unitaires (génération PDF, Factur-X, ventilation TVA) |
| `npm run test:facturx` | valide les Factur-X avec Mustang / veraPDF (Java requis ; télécharge Mustang une fois dans `.cache/`) |
| `npm run test:functions` | tests des Edge Functions (envoi d'e-mail) |
| `npm run test:e2e` | test navigateur (Chromium, faux serveur Supabase) ; 1re fois : `npx playwright install chromium` |
| `npm run types:gen` | régénère `src/lib/supabase/database.generated.ts` depuis les migrations |
| `npm run types:check` | échoue si ce fichier n'est plus à jour (CI) |
