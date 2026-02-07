export const DEFAULT_KP_TEMPLATE_V1 = {
  version: 1,
  name: "КП — Стандарт",
  isActive: true,
  isDefault: true,
  branding: {
    logoFileId: null,
    companyName: "ООО «Решение»",
    primaryColor: "#004EEB",
    footerText: "Контакты: sales@company.ru · +7 (000) 000-00-00",
    signature: {
      name: "",
      title: "",
      phone: "",
      email: "",
    },
    disclaimer: "Коммерческое предложение не является офертой. Срок действия: 10 календарных дней.",
  },
  defaults: {
    currency: "RUB",
    vatPercent: 20,
    partnerModeEnabled: false,
  },
  ui: {
    layout: "twoColumn",
    sections: [
      {
        id: "client",
        title: "Данные клиента",
        fields: [
          { id: "clientName", label: "Компания", type: "text", required: true, placeholder: "ООО «Ромашка»", mapping: { source: "company.name" } },
          { id: "clientInn", label: "ИНН", type: "text", required: false, placeholder: "10 или 12 цифр", mapping: { source: "company.inn" } },
          { id: "clientEmail", label: "Email", type: "email", required: true, placeholder: "name@company.ru", mapping: { source: "company.email" } },
          { id: "clientCity", label: "Город", type: "text", required: false, mapping: { source: "company.city" } }
        ]
      },
      {
        id: "dealParams",
        title: "Параметры расчёта",
        fields: [
          { id: "endpoints", label: "Количество endpoint", type: "number", required: true, min: 1, mapping: { source: "deal.endpoints" } },
          {
            id: "licenseType",
            label: "Тип лицензии",
            type: "select",
            required: true,
            options: [
              { value: "annual", label: "Годовая" },
              { value: "perpetual", label: "Бессрочная" }
            ],
            default: "annual"
          },
          {
            id: "supportTier",
            label: "Техподдержка",
            type: "select",
            required: true,
            options: [
              { value: "base", label: "Базовая" },
              { value: "standard", label: "Стандарт" },
              { value: "premium", label: "Премиум" }
            ],
            default: "standard"
          }
        ]
      },
      {
        id: "modules",
        title: "Спецификация",
        fields: [
          {
            id: "modulesPicker",
            label: "Позиции",
            type: "pricePicker",
            required: true,
            dataSource: { type: "price_list", priceListId: null, filters: { category: "modules" } },
            ui: { mode: "table", search: true, allowCustomRow: true, customRowLabel: "Добавить кастомную позицию" }
          }
        ]
      },
      {
        id: "discounts",
        title: "Скидки",
        fields: [
          { id: "discountPartnerPercent", label: "Партнёрская скидка, %", type: "number", required: false, min: 0, max: 30, visibility: { when: { field: "partnerMode", equals: true } } },
          { id: "discountManualPercent", label: "Доп. скидка, %", type: "number", required: false, min: 0, max: 20 }
        ]
      },
      {
        id: "payment",
        title: "Условия оплаты",
        fields: [
          {
            id: "paymentTerms",
            label: "Условия оплаты",
            type: "select",
            required: false,
            options: [
              { value: "prepay100", label: "100% предоплата" },
              { value: "split50_50", label: "50/50" },
              { value: "postpay", label: "Постоплата" }
            ]
          },
          { id: "deliveryDate", label: "Дата поставки / начала работ", type: "date", required: false }
        ]
      },
      {
        id: "notes",
        title: "Комментарий",
        fields: [
          { id: "comment", label: "Комментарий менеджера", type: "textarea", required: false, placeholder: "Особые условия, сроки…" }
        ]
      }
    ],
    managerFields: [
      { id: "managerName", label: "Менеджер", type: "text", required: false, mapping: { source: "user.name" } }
    ]
  },
  specification: {
    title: "Спецификация",
    showVatColumn: true,
    columns: [
      { key: "name", label: "Наименование", width: "auto" },
      { key: "qty", label: "Кол-во", width: 70, align: "right" },
      { key: "unitPrice", label: "Цена", width: 100, align: "right" },
      { key: "discount", label: "Скидка", width: 90, align: "right", optional: true },
      { key: "lineTotal", label: "Сумма", width: 110, align: "right" }
    ],
    totals: [
      { key: "subtotal", label: "Итого без НДС" },
      { key: "vat", label: "НДС" },
      { key: "total", label: "Итого" }
    ]
  },
  calcRules: {
    applyPartnerDiscountFirst: true,
    discounts: { maxPartnerPercent: 30, maxManualPercent: 20 }
  },
  pdf: {
    page: "A4",
    fileNamePattern: "КП_{clientName}_{dealId}",
    renderMode: "html2canvas_jspdf"
  }
};
