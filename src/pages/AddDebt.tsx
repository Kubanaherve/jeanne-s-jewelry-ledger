import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import {
  DAILY_CUSTOMER_PAYMENTS_PREFIX,
  DAILY_NEW_DEBT_PREFIX,
  getDateKeyFromIso,
  incrementAppSettingAmount,
} from "@/lib/reporting";
import { ArrowLeft, Save, X } from "lucide-react";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { useCustomerSuggestions } from "@/hooks/useCustomerSuggestions";

interface SelectedItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  selling_price: number;
  cost_price: number;
}

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  selling_price: number;
  cost_price: number;
  created_at: string;
  date_bought: string;
  notes: string | null;
}

interface StoredDebtItem {
  name: string;
  quantity: number;
}

const AddDebtPageEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const { customers } = useCustomerSuggestions();

  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    dueDate: new Date().toISOString().split("T")[0],
    isPaid: false,
    amount: "",
  });
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showInventoryPopup, setShowInventoryPopup] = useState(false);
  const [popupSelectedItem, setPopupSelectedItem] = useState<InventoryItem | null>(null);
  const [popupItemQty, setPopupItemQty] = useState<string>("1");

  const parseStoredItems = (raw: string | null): StoredDebtItem[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry) => {
          if (typeof entry === "string") {
            const match = entry.match(/^(.*?)(?:\s*x?\s*(\d+))?$/i);
            return {
              name: (match?.[1] || entry).trim(),
              quantity: Number(match?.[2]) || 1,
            };
          }
          if (entry && typeof entry === "object") {
            return {
              name: String(entry.name || "").trim(),
              quantity: Number(entry.quantity) || 1,
            };
          }
          return null;
        })
        .filter((entry): entry is StoredDebtItem => !!entry && !!entry.name);
    } catch {
      return [];
    }
  };

  const normalizeKey = (value: string) => value.trim().toLowerCase();

  const mergeDebtItems = (existingItems: StoredDebtItem[], newItems: SelectedItem[]) => {
    const mergedMap = new Map<string, StoredDebtItem>();

    existingItems.forEach((item) => {
      const key = normalizeKey(item.name);
      const prev = mergedMap.get(key);
      if (prev) {
        prev.quantity += Math.max(1, Number(item.quantity) || 1);
      } else {
        mergedMap.set(key, { name: item.name, quantity: Math.max(1, Number(item.quantity) || 1) });
      }
    });

    newItems.forEach((item) => {
      const key = normalizeKey(item.name);
      const prev = mergedMap.get(key);
      if (prev) {
        prev.quantity += item.quantity;
      } else {
        mergedMap.set(key, { name: item.name, quantity: item.quantity });
      }
    });

    return Array.from(mergedMap.values());
  };

  // Fetch inventory when popup opens
  useEffect(() => {
    if (!showInventoryPopup) return;
    const fetchInventory = async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, item_name, quantity, selling_price, cost_price, created_at, date_bought, notes")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Inventory fetch error:", error);
        toast.error("Habaye ikosa mu gufata ibintu");
      } else {
        setInventory(data || []);
      }
    };
    fetchInventory();
  }, [showInventoryPopup]);

  // Customer autocomplete
  const handleCustomerSelect = (customer: { name: string; phone: string | null }) => {
    setForm(prev => ({ ...prev, name: customer.name, phone: customer.phone || "" }));
  };

  // Confirm + Add Item
  const confirmPopupItem = () => {
    if (!popupSelectedItem) return;
    const qty = parseInt(popupItemQty, 10);
    if (isNaN(qty) || qty < 1) return;
    if (qty > popupSelectedItem.quantity) {
      toast.error("Stock ihari ntabwo ihagije");
      return;
    }

    const newItems = [...selectedItems];
    const existingIndex = newItems.findIndex(i => i.id === popupSelectedItem.id);

    if (existingIndex >= 0) {
      newItems[existingIndex].quantity += qty;
    } else {
      newItems.push({
        id: popupSelectedItem.id,
        name: popupSelectedItem.item_name,
        quantity: qty,
        price: popupSelectedItem.selling_price,
        selling_price: popupSelectedItem.selling_price,
        cost_price: popupSelectedItem.cost_price,
      });
    }

    setSelectedItems(newItems);
    recalcAmount(newItems);

    setPopupSelectedItem(null);
    setPopupItemQty("1");
    setShowInventoryPopup(false);
  };

  const removeItemFromList = (id: string) => {
    const newList = selectedItems.filter(i => i.id !== id);
    setSelectedItems(newList);
    recalcAmount(newList);
  };

  const recalcAmount = (items: SelectedItem[]) => {
    const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    setForm(prev => ({ ...prev, amount: total.toString() }));
  };

 const handleSubmit = async () => {
  if (!form.name.trim() || selectedItems.length === 0) {
    toast.error("Uzuza ibisabwa byose");
    return;
  }

  const amountValue = parseFloat(form.amount);
  if (isNaN(amountValue) || amountValue <= 0) {
    toast.error("Amafaranga wanditse ntabwo ari meza");
    return;
  }
  const nowISO = new Date().toISOString();
  const todayKey = getDateKeyFromIso(nowISO);

  // ✅ WhatsApp (must stay BEFORE async)
  if (!form.isPaid && form.phone) {
    const itemsText = selectedItems.map(i => `${i.name} x${i.quantity}`).join(", ");
    const message = `Muraho neza mufashe ${itemsText} muri Jeanne Friend Jewerlies totale ni: ${formatCurrency(amountValue)} murisanga!`;

    let cleanPhone = form.phone.replace(/\s+/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "25" + cleanPhone;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  setIsLoading(true);

  try {
    // ✅ 1. Insert new debt or merge into existing unpaid debt (same customer name)
    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim() || null;
    const selectedDebtItems: StoredDebtItem[] = selectedItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
    }));

    if (form.isPaid) {
      const { error: insertError } = await supabase.from("customers").insert([
        {
          name: trimmedName,
          phone: trimmedPhone,
          items: JSON.stringify(selectedDebtItems),
          amount: amountValue,
          due_date: form.dueDate,
          is_paid: true,
          paid_at: nowISO,
          created_at: nowISO,
        },
      ]);

      if (insertError) throw insertError;
    } else {
      const { data: existingUnpaidCustomer, error: existingError } = await supabase
        .from("customers")
        .select("id, amount, items, phone")
        .eq("is_paid", false)
        .ilike("name", trimmedName)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingUnpaidCustomer) {
        const mergedItems = mergeDebtItems(
          parseStoredItems(existingUnpaidCustomer.items),
          selectedItems
        );

        const { error: updateError } = await supabase
          .from("customers")
          .update({
            amount: (Number(existingUnpaidCustomer.amount) || 0) + amountValue,
            items: JSON.stringify(mergedItems),
            phone: existingUnpaidCustomer.phone || trimmedPhone,
            due_date: form.dueDate,
            updated_at: nowISO,
          })
          .eq("id", existingUnpaidCustomer.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("customers").insert([
          {
            name: trimmedName,
            phone: trimmedPhone,
            items: JSON.stringify(selectedDebtItems),
            amount: amountValue,
            due_date: form.dueDate,
            is_paid: false,
            paid_at: null,
            created_at: nowISO,
          },
        ]);

        if (insertError) throw insertError;
      }
    }

    // ✅ 2. UPDATE INVENTORY
    for (const item of selectedItems) {
      const currentQty = inventory.find(i => i.id === item.id)?.quantity ?? 0;
      if (currentQty < item.quantity) {
        throw new Error(`Stock ya ${item.name} ntihagije`);
      }

      const { error } = await supabase
        .from("inventory_items")
        .update({ quantity: currentQty - item.quantity })
        .eq("id", item.id);

      if (error) throw error;
    }

    // ✅ 3. UPDATE REPORTING TOTALS
    if (form.isPaid) {
      await incrementAppSettingAmount("total_paid", amountValue);
      await incrementAppSettingAmount(
        `${DAILY_CUSTOMER_PAYMENTS_PREFIX}${todayKey}`,
        amountValue
      );
    } else {
      await incrementAppSettingAmount(
        `${DAILY_NEW_DEBT_PREFIX}${todayKey}`,
        amountValue
      );
    }

    // ✅ SUCCESS
    toast.success("Byabitswe neza kandi byahujwe neza ku mukiriya umwe ✨");

    // ✅ REAL-TIME DASHBOARD UPDATE
    window.dispatchEvent(
      new CustomEvent("newDebtAdded", {
        detail: {
          customerName: form.name,
          amount: amountValue,
          isPaid: form.isPaid,
        },
      })
    );

    setSelectedItems([]);
    setForm({
      name: "",
      phone: "",
      dueDate: new Date().toISOString().split("T")[0],
      isPaid: false,
      amount: "",
    });
    navigate("/debts");
  } catch (err) {
    console.error(err);
    toast.error("Habaye ikosa mu kubika umukiriya");
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 p-3 sm:p-4">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl rounded-xl border border-slate-200 py-3 px-3 sm:px-4 flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm sm:text-base font-bold">Kongeramo Umukiriya n'Ibyo yafashe</h1>
      </header>

      {/* Form */}
      <main className="max-w-md mx-auto mt-4 space-y-4">
        <CustomerAutocomplete
          value={form.name}
          onChange={v => setForm({ ...form, name: v })}
          onSelect={handleCustomerSelect}
          suggestions={customers}
          placeholder="Andika izina ry'umukiriya..."
        />
        <Input type="tel" placeholder="07X XXX XXXX" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-white border-slate-200 input-glow" />

        {/* Selected Items */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Items Taken *</label>
          <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
            {selectedItems.map(i => (
              <div key={i.id} className="flex justify-between items-center bg-slate-50 rounded-lg p-2">
                <span className="text-sm font-medium">{i.name} x{i.quantity}</span>
                <button onClick={() => removeItemFromList(i.id)} className="text-red-600 text-lg animate-pulse hover:scale-110 transition-transform" title="Gukuraho ❌">❌</button>
              </div>
            ))}
          </div>
          <Button onClick={() => setShowInventoryPopup(true)} size="sm" className="mt-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground">+ Add Item</Button>
        </div>

        {/* Amount */}
        <Input type="number" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="bg-white border-slate-200 input-glow text-lg font-semibold" />

        {/* Payment Status */}
        <div className="flex items-center justify-between py-3 border-t border-border/50">
          <span>{form.isPaid ? labels.paid : labels.willPayLater}</span>
          <Switch checked={form.isPaid} onCheckedChange={checked => setForm({ ...form, isPaid: checked })} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="flex-1" disabled={isLoading}>
            <X size={16} /> {labels.cancel}
          </Button>
          <Button onClick={handleSubmit} className="flex-1 bg-primary hover:bg-primary/90" disabled={isLoading}>
            {isLoading ? <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <><Save size={16} /> {labels.save}</>}
          </Button>
        </div>
      </main>

      {/* Inventory Popup */}
      {showInventoryPopup && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 w-full max-w-md space-y-4 shadow-xl">
            <h2 className="text-sm font-bold">Hitamo Icyo Ushaka</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {inventory.map(item => (
                <div
                  key={item.id}
                  className={`flex justify-between items-center p-2 rounded-lg cursor-pointer border transition-colors ${popupSelectedItem?.id === item.id ? "bg-primary/10 border-primary/40" : "bg-slate-50 border-slate-200 hover:bg-slate-100"}`}
                  onClick={() => setPopupSelectedItem(item)}
                >
                  <div>
                    <div className="font-semibold">{item.item_name}</div>
                    <div className="text-xs text-muted-foreground">Hasigaye {item.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div>{formatCurrency(item.selling_price)}</div>
                    <div className="text-xs text-muted-foreground">Cost: {formatCurrency(item.cost_price)}</div>
                  </div>
                </div>
              ))}
            </div>
            {popupSelectedItem && (
              <div className="flex gap-2 items-center">
                <span>{popupSelectedItem.item_name}</span>
                <Input
                  type="number"
                  min={1}
                  value={popupItemQty}
                  onChange={e => setPopupItemQty(e.target.value)}
                  placeholder="Qty"
                  className="bg-white/50 w-20 input-glow"
                />
                <Button onClick={confirmPopupItem} className="btn-gold flex-1">OK</Button>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => setShowInventoryPopup(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddDebtPageEnhanced;
