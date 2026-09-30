/**
 * Nom de fichier sûr pour Supabase Storage : sans accents, espaces ni caractères
 * spéciaux (rejetés par Storage), préfixé par un horodatage pour rester unique.
 * « Photo hotte été (1).JPG » → « 1727700000000-photo-hotte-ete-1.jpg »
 */
export function storageFileName(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  const ext = dot > 0 ? originalName.slice(dot + 1) : "";
  const clean = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const safeBase = clean(base).slice(0, 60) || "fichier";
  const safeExt = clean(ext).slice(0, 10);
  return `${Date.now()}-${safeBase}${safeExt ? `.${safeExt}` : ""}`;
}
