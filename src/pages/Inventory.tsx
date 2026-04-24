import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trash2,
  Plus,
  TrendingUp,
  ShoppingCart,
  Wallet,
  Search,
  X,
  PackageOpen,
  ChevronRight,
  Tag,
  BarChart3,
} from "lucide-react";

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

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSellingPrice, setEditingSellingPrice] = useState("");
  const [editingCostPrice, setEditingCostPrice] = useState("");
  const [editingQuantity, setEditingQuantity] = useState("");
  const [editingPriceType, setEditingPriceType] = useState<"cost" | "selling">("selling");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newSellingPrice, setNewSellingPrice] = useState("");
  const [newCostPrice, setNewCostPrice] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, item_name, quantity, selling_price, cost_price, created_at, date_bought, notes")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Habaye ikosa mu gufata ibintu");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    const handleInventoryUpdated = () => setRefreshKey(prev => prev + 1);
    window.addEventListener("inventoryUpdated", handleInventoryUpdated);
    return () => window.removeEventListener("inventoryUpdated", handleInventoryUpdated);
  }, [fetchItems]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  const handleSaveEdit = async (id: string) => {
    const sellingPrice = parseFloat(editingSellingPrice);
    const costPrice = parseFloat(editingCostPrice);
    const quantity = parseInt(editingQuantity, 10);

    if (
      isNaN(sellingPrice) || sellingPrice < 0 ||
      isNaN(costPrice) || costPrice < 0 ||
      isNaN(quantity) || quantity < 0
    ) {
      toast.error("Andika neza amafaranga n'umubare");
      return;
    }

    const previousItems = [...items];
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, selling_price: sellingPrice, cost_price: costPrice, quantity } : item
      )
    );

    const { error } = await supabase
      .from("inventory_items")
      .update({ selling_price: sellingPrice, cost_price: costPrice, quantity })
      .eq("id", id);

    if (error) {
      setItems(previousItems);
      toast.error("Habaye ikosa mu guhindura");
    } else {
      toast.success("Byahinduwe neza ✨");
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Urashaka gusiba iki kintu?")) return;

    const previousItems = [...items];
    setItems(prev => prev.filter(item => item.id !== id));

    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", id);

    if (error) {
      setItems(previousItems);
      toast.error("Habaye ikosa");
    } else {
      toast.success("Byasibwe ✨");
    }
  };

  const handleAddItem = async () => {
    const quantity = parseInt(newQuantity, 10);
    const sellingPrice = parseFloat(newSellingPrice);
    const costPrice = parseFloat(newCostPrice);

    if (
      !newName.trim() ||
      isNaN(quantity) || quantity < 0 ||
      isNaN(sellingPrice) || sellingPrice < 0 ||
      isNaN(costPrice) || costPrice < 0
    ) {
      toast.error("Andika neza izina, amafaranga n'umubare");
      return;
    }

    setIsAdding(true);

    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({
          item_name: newName.trim(),
          quantity,
          selling_price: sellingPrice,
          cost_price: costPrice,
        })
        .select("id, item_name, quantity, selling_price, cost_price, created_at, date_bought, notes")
        .single();

      if (error) throw error;
      if (data) {
        setItems(prev => [data, ...prev]);
        toast.success("Ikintu cyongewe muri stock ✨");
        setNewName("");
        setNewQuantity("");
        setNewSellingPrice("");
        setNewCostPrice("");
        setShowAddForm(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Habaye ikosa mu kongera ikintu");
    } finally {
      setIsAdding(false);
    }
  };

  const totalCostPrice = items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);
  const totalSellingPrice = items.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);
  const totalProfit = totalSellingPrice - totalCostPrice;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const filteredItems = items.filter(item =>
    item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const profitMargin = totalSellingPrice > 0 ? (totalProfit / totalSellingPrice) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition-all"
            >
              <ArrowLeft size={16} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-900">{labels.inventoryTitle}</h1>
              <p className="text-[10px] text-slate-500">{items.length} ubwoko bw'ibintu</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
          >
            <Plus size={14} />
            Ongeraho
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-3 sm:px-4 pb-8">

        {/* ── SUMMARY CARDS ── */}
        {items.length > 0 && (
          <div className="mt-4 space-y-3">
            {/* Top row: 2 cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Cost */}
              <div className="rounded-2xl p-4 bg-white border border-violet-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Wallet size={13} className="text-violet-600" />
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-600/80">Kurangura</span>
                </div>
                <p className="text-base sm:text-lg font-black text-slate-900 leading-none">{formatCurrency(totalCostPrice)}</p>
                <p className="text-[10px] text-slate-500 mt-1">Amafaranga yose yo kurangura</p>
              </div>

              {/* Selling */}
              <div className="rounded-2xl p-4 bg-white border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <ShoppingCart size={13} className="text-emerald-600" />
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700/80">Kugurisha</span>
                </div>
                <p className="text-base sm:text-lg font-black text-slate-900 leading-none">{formatCurrency(totalSellingPrice)}</p>
                <p className="text-[10px] text-slate-500 mt-1">Amafaranga yose azinjira</p>
              </div>
            </div>

            {/* Bottom row: Profit + Items count */}
            <div className="grid grid-cols-3 gap-3">
              {/* Profit */}
              <div className={`col-span-2 rounded-2xl p-4 border shadow-sm ${totalProfit >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <TrendingUp size={12} className={totalProfit >= 0 ? 'text-amber-400' : 'text-red-400'} />
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">Inyungu Yose</span>
                    </div>
                    <p className={`text-xl font-black ${totalProfit >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{formatCurrency(totalProfit)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-500">Margin</p>
                    <p className={`text-lg font-black ${totalProfit >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{profitMargin.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Items total */}
              <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                <BarChart3 size={16} className="text-slate-500 mb-1" />
                <p className="text-xl font-black text-slate-900">{totalItems}</p>
                <p className="text-[9px] text-slate-500 text-center">ibintu byose</p>
              </div>
            </div>
          </div>
        )}

        {/* ── SEARCH ── */}
        {items.length > 0 && (
          <div className="mt-4 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Shakisha ikintu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* ── ITEMS LIST ── */}
        <div className="mt-4 space-y-2">
          {isLoading && items.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-slate-500 text-sm">Gutegereza...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <PackageOpen size={28} className="text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm">
                {searchQuery ? "Nta kintu kibonetse" : "Nta bintu biri muri stock"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} /> Ongeraho ikintu cya mbere
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const itemProfit = item.selling_price - item.cost_price;
              const itemProfitPct = item.cost_price > 0 ? (itemProfit / item.cost_price) * 100 : 0;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all overflow-hidden shadow-sm"
                  style={{ animationDelay: `${index * 0.04}s` }}
                >
                  <div className="p-4 flex items-center justify-between gap-3">
                    {/* Left: name + prices */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{item.item_name}</h3>
                        {item.quantity <= 2 && item.quantity > 0 && (
                          <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-full font-semibold shrink-0">Low</span>
                        )}
                        {item.quantity === 0 && (
                          <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-semibold shrink-0">Out</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Tag size={10} className="text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-400">{formatCurrency(item.selling_price)}</span>
                        </div>
                        <span className="text-slate-300">·</span>
                        <div className="flex items-center gap-1">
                          <Wallet size={10} className="text-violet-400" />
                          <span className="text-xs text-violet-400">{formatCurrency(item.cost_price)}</span>
                        </div>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">📦 {item.quantity}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${itemProfit >= 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                          +{itemProfitPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingSellingPrice(item.selling_price?.toString() ?? "");
                          setEditingCostPrice(item.cost_price?.toString() ?? "");
                          setEditingQuantity(item.quantity.toString());
                          setEditingPriceType("selling");
                        }}
                        className="flex items-center gap-1 bg-primary/10 hover:bg-primary/15 border border-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                      >
                        Hindura
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 flex items-center justify-center text-red-400 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar: quantity-to-selling ratio hint */}
                  <div className="h-0.5 bg-slate-100">
                    <div
                      className={`h-full ${itemProfit >= 0 ? 'bg-gradient-to-r from-amber-500/60 to-emerald-500/60' : 'bg-red-500/60'}`}
                      style={{ width: `${Math.min(Math.abs(itemProfitPct), 100)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── ADD ITEM MODAL ── */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Ongeraho Ikintu</h2>
                <p className="text-xs text-slate-500 mt-0.5">Uzuza amakuru y'ikintu gishya</p>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-all"
              >
                <X size={15} />
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Izina ry'Ikintu</label>
                <input
                  type="text"
                  placeholder="ex. Intore necklace"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Umubare (Stock)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newQuantity}
                  onChange={e => setNewQuantity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-emerald-400/70 mb-1.5">💚 Igiciro Kugurisha</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      value={newSellingPrice}
                      onChange={e => setNewSellingPrice(e.target.value)}
                      className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500/60 transition-all pr-10"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-medium">FRW</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-violet-400/70 mb-1.5">💜 Igiciro Kurangura</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      value={newCostPrice}
                      onChange={e => setNewCostPrice(e.target.value)}
                      className="w-full bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500/60 transition-all pr-10"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-medium">FRW</span>
                  </div>
                </div>
              </div>

              {/* Live margin preview */}
              {newSellingPrice && newCostPrice && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center justify-between border border-slate-200">
                  <span className="text-xs text-slate-600">Inyungu kuri buri kintu:</span>
                  <span className={`text-sm font-bold ${parseFloat(newSellingPrice) - parseFloat(newCostPrice) >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    {formatCurrency((parseFloat(newSellingPrice) || 0) - (parseFloat(newCostPrice) || 0))}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-sm font-medium transition-all"
              >
                Bireke
              </button>
              <button
                onClick={handleAddItem}
                disabled={isAdding}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-bold transition-all active:scale-95"
              >
                {isAdding ? "Wongeraho..." : "Emeza ✨"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editingId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {items.find(i => i.id === editingId)?.item_name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Hindura amafaranga cyangwa umubare</p>
              </div>
              <button
                onClick={() => setEditingId(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-all"
              >
                <X size={15} />
              </button>
            </div>

            {/* Toggle */}
            <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
              <button
                onClick={() => setEditingPriceType("selling")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  editingPriceType === "selling"
                    ? "bg-emerald-500 text-white shadow-lg"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                💚 Kugurisha
              </button>
              <button
                onClick={() => setEditingPriceType("cost")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  editingPriceType === "cost"
                    ? "bg-violet-500 text-white shadow-lg"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                💜 Kurangura
              </button>
            </div>

            {/* Price input */}
            <div className="space-y-3">
              {editingPriceType === "selling" ? (
                <div>
                  <label className="block text-xs font-semibold text-emerald-400/80 mb-1.5">Igiciro cyo Kugurisha</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={editingSellingPrice}
                      onChange={e => setEditingSellingPrice(e.target.value)}
                      placeholder="0"
                      autoFocus
                      className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500/60 transition-all pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">FRW</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Igiciro wasohera kumukiriya</p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-violet-400/80 mb-1.5">Igiciro cyo Kurangura</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={editingCostPrice}
                      onChange={e => setEditingCostPrice(e.target.value)}
                      placeholder="0"
                      autoFocus
                      className="w-full bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500/60 transition-all pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">FRW</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Igiciro cy'ubwenge bwawe</p>
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">📦 Umubare</label>
                <div className="relative">
                  <input
                    type="number"
                    value={editingQuantity}
                    onChange={e => setEditingQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">ibintu</span>
                </div>
              </div>
            </div>

            {/* Live summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ibiciro</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Kugurisha</span>
                <span className="font-bold text-emerald-400 text-sm">{formatCurrency(parseFloat(editingSellingPrice) || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Kurangura</span>
                <span className="font-bold text-violet-400 text-sm">{formatCurrency(parseFloat(editingCostPrice) || 0)}</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">Inyungu / unit</span>
                <span className={`font-black text-base ${(parseFloat(editingSellingPrice) || 0) - (parseFloat(editingCostPrice) || 0) >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {formatCurrency((parseFloat(editingSellingPrice) || 0) - (parseFloat(editingCostPrice) || 0))}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setEditingId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-sm font-medium transition-all"
              >
                Bireke
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all active:scale-95"
                onClick={() => handleSaveEdit(editingId)}
              >
                Emeza ✨
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;