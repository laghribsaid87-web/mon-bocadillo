import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set) => ({
      user: null,
      profile: null,
      settings: {},
      brand: {},
      cart: [],
      heldCarts: [],
      activeBranchId: 'ALL',
      notify: null,
      
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setSettings: (settings) => set({ settings }),
      setBrand: (brand) => set({ brand }),
      
      addToCart: (item, note = "") => set((state) => {
        const finalName = note ? item.name + note : item.name;
        const existing = state.cart.find(i => i.id === item.id && i.name === finalName);
        if (existing) {
          return { cart: state.cart.map(i => i.id === item.id && i.name === finalName ? { ...i, qty: i.qty + 1 } : i) };
        }
        return { cart: [...state.cart, { ...item, name: finalName, qty: 1 }] };
      }),
      deleteFromCart: (itemId, itemName) => set((state) => ({
        cart: state.cart.filter(i => !(i.id === itemId && i.name === itemName))
      })),
      updateCartItemQty: (item, delta) => set((state) => {
        return {
          cart: state.cart.map(i => {
            if (i.id === item.id && i.name === item.name) {
              const newQty = i.qty + delta;
              if (newQty > 0) return { ...i, qty: newQty };
              return i;
            }
            return i;
          })
        };
      }),
      clearCart: () => set({ cart: [] }),
      setCart: (updater) => set((state) => ({ 
        cart: typeof updater === 'function' ? updater(state.cart) : updater 
      })),
      setHeldCarts: (updater) => set((state) => ({ 
        heldCarts: typeof updater === 'function' ? updater(state.heldCarts) : updater 
      })),
      
      setActiveBranchId: (branchId) => set({ activeBranchId: branchId }),
      
      showNotify: (message, type = 'info') => {
        set({ notify: { message, type, id: Date.now() } });
        setTimeout(() => {
          set((state) => {
            if (state.notify?.id === Date.now()) return state;
            return { notify: null };
          });
        }, 3000);
      },
      clearNotify: () => set({ notify: null }),
    }),
    {
      name: 'pos-storage',
      partialize: (state) => ({ cart: state.cart, heldCarts: state.heldCarts, activeBranchId: state.activeBranchId }),
    }
  )
);

export default useAppStore;
