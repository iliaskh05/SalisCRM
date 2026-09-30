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
- **prestataire** : uniquement ses interventions (avancement, notes, photos, rapport). Aucune donnée financière.

## Documents PDF

Devis, factures et avoirs se téléchargent en PDF depuis leur fiche (boutons « PDF », « Facture PDF », « Avoir PDF »). Le PDF est généré dans le navigateur (`src/lib/pdf/`, bibliothèque chargée au premier clic) à partir des montants **enregistrés en base** : il n’y a aucun recalcul côté client.

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

## Base de données

Les migrations sont dans `supabase/migrations/`, toutes rejouables sans effet de bord. La première (`baseline_shared_objects`) recrée `leads`, `staff_profiles` et le bucket `lead-documents`, mais ne modifie rien s'ils existent déjà (cas de la production).

```bash
npm run test:db   # joue toutes les migrations sur un Postgres embarqué + 129 contrôles
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
| `npm run test:unit` | tests unitaires (génération PDF, ventilation TVA) |
| `npm run test:functions` | tests des Edge Functions (envoi d'e-mail) |
