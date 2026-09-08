-- Catalogue prestations de base (idempotent via ON CONFLICT DO NOTHING sur code)
INSERT INTO public.service_catalog (code, label, description, unit, unit_price_ht, vat_rate, active)
VALUES
  (
    'DEG-HOTTE',
    'Dégraissage hotte',
    'Nettoyage et dégraissage de la hotte d’extraction',
    'forfait',
    0,
    20.00,
    true
  ),
  (
    'DEG-FILTRE',
    'Nettoyage filtres',
    'Dégraissage / remplacement filtres',
    'unité',
    0,
    20.00,
    true
  ),
  (
    'DEG-CONDUIT',
    'Dégraissage conduits',
    'Nettoyage des conduits d’extraction',
    'ml',
    0,
    20.00,
    true
  ),
  (
    'DEG-MOTEUR',
    'Nettoyage moteur / caisson',
    'Intervention sur moteur ou caisson d’extraction',
    'forfait',
    0,
    20.00,
    true
  ),
  (
    'ENT-TRIM',
    'Contrat entretien trimestriel',
    'Prestation d’entretien périodique',
    'visite',
    0,
    20.00,
    true
  ),
  (
    'URGENCE',
    'Intervention urgente',
    'Majoration intervention prioritaire',
    'forfait',
    0,
    20.00,
    true
  )
ON CONFLICT (code) DO NOTHING;
