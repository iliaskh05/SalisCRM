import { PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";

/**
 * Transforme un PDF (produit par jsPDF avec polices intégrées) en PDF/A-3B portant le XML
 * Factur-X en pièce jointe : métadonnées XMP (identification PDF/A + extension Factur-X),
 * profil couleur de sortie sRGB, fichier joint avec relation « Data », identifiant de document.
 * Le résultat est contrôlé avec Mustang / veraPDF (npm run test:facturx).
 */

export type FacturXPdfOptions = {
  xml: string;
  title: string;
  subject: string;
  author: string;
  /** Profil ICC sRGB (obligatoire : le PDF utilise des couleurs RVB) */
  icc: ArrayBuffer;
  createdAt?: Date;
  conformanceLevel?: "MINIMUM" | "BASIC WL" | "BASIC" | "EN 16931" | "EXTENDED";
  documentType?: "INVOICE" | "ORDER";
  fileName?: string;
};

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function xmpPacket(o: Required<Pick<FacturXPdfOptions, "title" | "subject" | "author" | "conformanceLevel" | "documentType" | "fileName">> & { iso: string }): string {
  const property = (name: string, description: string) =>
    `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`;
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
<pdfaid:part>3</pdfaid:part>
<pdfaid:conformance>B</pdfaid:conformance>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(o.title)}</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>${xmlEscape(o.author)}</rdf:li></rdf:Seq></dc:creator>
<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(o.subject)}</rdf:li></rdf:Alt></dc:description>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
<pdf:Producer>SalisCRM</pdf:Producer>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
<xmp:CreatorTool>SalisCRM</xmp:CreatorTool>
<xmp:CreateDate>${o.iso}</xmp:CreateDate>
<xmp:ModifyDate>${o.iso}</xmp:ModifyDate>
<xmp:MetadataDate>${o.iso}</xmp:MetadataDate>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas>
<rdf:Bag>
<rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property>
<rdf:Seq>
${property("DocumentFileName", "name of the embedded XML invoice file")}
${property("DocumentType", "INVOICE")}
${property("Version", "The actual version of the Factur-X XML schema")}
${property("ConformanceLevel", "The conformance level of the embedded Factur-X data")}
</rdf:Seq>
</pdfaSchema:property>
</rdf:li>
</rdf:Bag>
</pdfaExtension:schemas>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
<fx:DocumentType>${o.documentType}</fx:DocumentType>
<fx:DocumentFileName>${o.fileName}</fx:DocumentFileName>
<fx:Version>1.0</fx:Version>
<fx:ConformanceLevel>${o.conformanceLevel}</fx:ConformanceLevel>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function toFacturXPdf(pdf: ArrayBuffer, options: FacturXPdfOptions): Promise<Uint8Array> {
  const createdAt = options.createdAt ?? new Date();
  const fileName = options.fileName ?? "factur-x.xml";
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const ctx = doc.context;
  const catalog = doc.catalog;

  // PDF/A : les métadonnées vivent dans le XMP ; le dictionnaire Info de jsPDF est retiré
  ctx.trailerInfo.Info = undefined;

  // --- XML Factur-X en pièce jointe (relation « Data ») ---
  const xmlBytes = new TextEncoder().encode(options.xml);
  const modDate = PDFString.fromDate(createdAt);
  const embedded = ctx.register(
    ctx.flateStream(xmlBytes, { Type: "EmbeddedFile", Subtype: "text/xml", Params: { Size: xmlBytes.length, ModDate: modDate } }),
  );
  const fileSpec = ctx.register(
    ctx.obj({
      Type: "Filespec",
      F: PDFString.of(fileName),
      UF: PDFHexString.fromText(fileName),
      Desc: PDFString.of("Factur-X"),
      AFRelationship: "Data",
      EF: { F: embedded, UF: embedded },
    }),
  );
  catalog.set(PDFName.of("AF"), ctx.obj([fileSpec]));
  catalog.set(PDFName.of("Names"), ctx.obj({ EmbeddedFiles: { Names: [PDFHexString.fromText(fileName), fileSpec] } }));

  // --- XMP (non compressé, exigé par PDF/A) ---
  // Octets UTF-8 explicites : pdf-lib tronque sinon chaque caractère à 8 bits (le « — » devient un code de contrôle)
  const xmp = ctx.register(
    ctx.stream(
      new TextEncoder().encode(
        xmpPacket({
          title: options.title,
          subject: options.subject,
          author: options.author,
          conformanceLevel: options.conformanceLevel ?? "EN 16931",
          documentType: options.documentType ?? "INVOICE",
          fileName,
          iso: createdAt.toISOString().replace(/\.\d{3}Z$/, "+00:00"),
        }),
      ),
      { Type: "Metadata", Subtype: "XML" },
    ),
  );
  catalog.set(PDFName.of("Metadata"), xmp);

  // --- profil de sortie sRGB ---
  const icc = ctx.register(ctx.flateStream(new Uint8Array(options.icc), { N: 3 }));
  const intent = ctx.register(
    ctx.obj({
      Type: "OutputIntent",
      S: "GTS_PDFA1",
      OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
      Info: PDFString.of("sRGB IEC61966-2.1"),
      DestOutputProfile: icc,
    }),
  );
  catalog.set(PDFName.of("OutputIntents"), ctx.obj([intent]));
  catalog.set(PDFName.of("Lang"), PDFString.of("fr-FR"));

  // --- identifiant de document (exigé par PDF/A) ---
  ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(randomHex(16)), PDFHexString.of(randomHex(16))]);

  return doc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
}
