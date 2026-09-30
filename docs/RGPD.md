# RGPD — registre des traitements (brouillon à valider)

> Document de travail établi **à partir du code** de SalisCRM. Ce n'est pas un avis juridique : la direction (et un juriste / DPO si besoin) doit le relire, le compléter et le dater avant de s'en servir comme registre officiel (art. 30 RGPD).

## Traitements

| Traitement | Personnes | Données | Finalité | Base légale (à confirmer) |
|---|---|---|---|---|
| Demandes de devis du site (`leads`) | Prospects (gérants de restaurants…) | nom, société, e-mail, téléphone, adresse, message, photos, origine (UTM), consentement | Répondre à la demande, relancer | Mesures précontractuelles ; intérêt légitime (prospection B2B) |
| Fichier clients (`clients`, installations, interventions, rapports, photos) | Clients et leurs contacts | coordonnées, SIRET, description des installations, signatures (nom), photos de chantier | Exécuter le contrat, planifier, traçabilité des interventions | Contrat |
| Devis, factures, avoirs, paiements | Clients | identité, adresse, montants, moyens de paiement | Facturation, comptabilité | Obligation légale |
| Comptes de l'équipe (`staff_profiles`, Supabase Auth) | Direction, commerciaux, prestataires | e-mail, nom, rôle, dernière connexion, facteur MFA | Accès sécurisé | Intérêt légitime / contrat de travail ou de prestation |
| Journal d'audit (`audit_log`) | Clients, prospects, équipe | copie des champs modifiés, auteur, date | Sécurité, traçabilité | Intérêt légitime |
| Historique d'activité (`activities`) | Clients, prospects | événements, notes | Suivi commercial | Intérêt légitime |

## Durées de conservation

| Donnée | Durée | Mise en œuvre |
|---|---|---|
| Demandes non converties (sans devis) | 36 mois (paramétrable 12–120) | **Paramètres → Conservation des données** : simulation puis suppression, à lancer manuellement. *Non planifiée automatiquement* : à décider. |
| Factures, avoirs, paiements | 10 ans (obligation comptable) | Jamais supprimés ; un client facturé ne peut être qu'anonymisé (coordonnées), son nom est conservé |
| Client inactif | à définir (3 ans sans échange est l'usage) | Anonymisation manuelle depuis la fiche client |
| Journal d'audit | **à définir** | Aucune purge automatique. Les valeurs personnelles sont retirées lors d'une anonymisation ou d'une purge |
| Sauvegardes Supabase | selon l'offre (7 jours à 30 jours) | Hors contrôle de l'application : à mentionner dans la politique de confidentialité |

## Droits des personnes — procédure

Toutes ces opérations sont réservées à la direction et sont tracées dans le journal d'audit.

- **Accès / portabilité** : fiche client → « Exporter les données » (JSON : client, installations, demandes, devis, factures, paiements, interventions, rapports, documents, historique).
- **Effacement** : fiche client → « Anonymiser ». Efface contact, téléphone, e-mail, notes, demande d'origine, remarques d'installation, signatures, et **les anciennes valeurs dans le journal d'audit**. Les factures restent (obligation légale). Les documents déposés sont listés pour revue et suppression manuelle (onglet Documents).
- **Rectification** : modification normale de la fiche.
- **Opposition à la prospection** : ne plus relancer ; si la personne le demande, anonymiser.

Délai de réponse légal : 1 mois.

## Sous-traitants (à vérifier : contrat DPA, localisation des données)

| Service | Rôle | Données | À contrôler |
|---|---|---|---|
| Supabase | Base de données, authentification, fichiers | toutes | Région du projet (idéalement UE), DPA signé, durée des sauvegardes |
| Vercel | Hébergement du site | aucune donnée métier (code statique) ; journaux d'accès | DPA |
| Sentry (optionnel) | Suivi des erreurs | messages d'erreur, pas de données personnelles par défaut | Région (UE), DPA ; vérifier qu'aucune donnée client n'apparaît dans les erreurs |
| Resend (optionnel) | Envoi des devis par e-mail | e-mail du client, PDF du devis | DPA, région |

## Mesures de sécurité en place

Accès par invitation uniquement ; rôles cloisonnés (un prestataire ne voit que ses interventions) ; règles d'accès appliquées par la base (RLS) ; double authentification appliquée par la base pour les comptes qui l'activent ; factures immuables ; journal d'audit non modifiable par l'application ; fichiers privés (liens signés à durée limitée) ; en-têtes de sécurité (CSP, HSTS) ; sauvegardes Supabase.

## Points ouverts (à décider)

1. Information des personnes : **la politique de confidentialité et les mentions légales relèvent du site public** (formulaire de demande de devis, dépôt séparé `pro-extract-hub`). Elles doivent citer les finalités, durées et droits ci-dessus.
2. Planifier ou non la purge des demandes anciennes (action irréversible, volontairement manuelle pour l'instant).
3. Durée de conservation du journal d'audit.
4. Rendre la double authentification obligatoire pour la direction (aujourd'hui : volontaire, appliquée dès qu'elle est activée).
5. Photos de chantier : vérifier qu'elles ne montrent pas de personnes identifiables.
