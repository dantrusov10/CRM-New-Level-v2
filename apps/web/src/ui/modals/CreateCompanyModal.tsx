import React from "react";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { pb } from "../../lib/pb";
import { useNavigate } from "react-router-dom";
import { notifyPbError } from "../../lib/pbError";

export function CreateCompanyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [inn, setInn] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [city, setCity] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const nav = useNavigate();

  React.useEffect(() => {
    if (open) {
      setName("");
      setInn("");
      setWebsite("");
      setCity("");
    }
  }, [open]);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data: any = { name: name.trim() };
      if (inn.trim()) data.inn = inn.trim();
      if (website.trim()) data.website = website.trim();
      if (city.trim()) data.city = city.trim();
      const rec = await pb.collection("companies").create(data);
      onClose();
      nav(`/companies/${rec.id}`);
    } catch (e) {
      notifyPbError(e, "Не удалось создать компанию");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Создать компанию" onClose={onClose}>
      <div className="grid gap-3">
        <div>
          <div className="text-xs text-text2 mb-1">Название *</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ООО «Ромашка»" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-text2 mb-1">ИНН</div>
            <Input value={inn} onChange={(e) => setInn(e.target.value)} placeholder="7736..." />
          </div>
          <div>
            <div className="text-xs text-text2 mb-1">Город</div>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" />
          </div>
        </div>
        <div>
          <div className="text-xs text-text2 mb-1">Сайт</div>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>{saving ? "Создание..." : "Создать"}</Button>
        </div>
      </div>
    </Modal>
  );
}
