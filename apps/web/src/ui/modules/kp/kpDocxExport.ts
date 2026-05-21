import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import type { KpInput, KpTemplateConfig, SpecItem } from "./types";
import { getDocumentType } from "./kpDocumentMeta";

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Упрощённый DOCX для сделки (текст + таблица позиций). */
export async function exportDealToDocx(
  template: KpTemplateConfig,
  input: KpInput,
  items: SpecItem[],
  fileName: string,
) {
  const children: (Paragraph | Table)[] = [];
  const title = getDocumentType(template) === "tkp" ? "Технико-коммерческое предложение" : "Коммерческое предложение";

  children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: template.branding?.companyName || "", spacing: { after: 120 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Клиент: ", bold: true }), new TextRun(String(input.clientName || ""))],
    }),
  );

  const tech = stripHtml(String(input.technicalIntro || template.branding?.technicalIntroDefault || ""));
  if (tech) {
    children.push(new Paragraph({ text: "Техническое описание", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: tech }));
  }

  if (items.length) {
    children.push(new Paragraph({ text: "Спецификация", heading: HeadingLevel.HEADING_2 }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: ["Наименование", "Кол-во", "Цена", "Сумма"].map(
              (t) => new TableCell({ children: [new Paragraph({ text: t })] }),
            ),
          }),
          ...items.map(
            (it) =>
              new TableRow({
                children: [
                  it.name,
                  String(it.qty),
                  String(it.unitPrice),
                  String(Math.round(it.qty * it.unitPrice)),
                ].map((t) => new TableCell({ children: [new Paragraph({ text: t })] })),
              }),
          ),
        ],
      }),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
