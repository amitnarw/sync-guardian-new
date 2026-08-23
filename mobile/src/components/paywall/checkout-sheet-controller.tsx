import { create } from 'zustand';

type CheckoutSheetState = {
  planId: string | null;
  isOpen: boolean;
  open: (planId: string) => void;
  close: () => void;
  markClosed: () => void;
};

const useCheckoutSheetStore = create<CheckoutSheetState>((set) => ({
  planId: null,
  isOpen: false,
  open: (planId) => set({ planId, isOpen: true }),
  close: () => set({ isOpen: false }),
  markClosed: () => set({ planId: null }),
}));

export function useCheckoutSheet() {
  const open = useCheckoutSheetStore((s) => s.open);
  const close = useCheckoutSheetStore((s) => s.close);
  return {
    present: (planId: string) => open(planId),
    dismiss: () => close(),
  };
}

export function useCheckoutSheetIsOpen(): boolean {
  return useCheckoutSheetStore((s) => s.isOpen);
}

export function useCheckoutPlanId(): string | null {
  return useCheckoutSheetStore((s) => s.planId);
}

export { useCheckoutSheetStore };
