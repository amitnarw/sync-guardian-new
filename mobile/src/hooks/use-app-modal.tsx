import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppModal, AppModalProps, AppModalIcon, ButtonVariant } from '@/components/ui/app-modal';

interface ShowModalOptions {
  title: string;
  message: string;
  icon?: AppModalIcon;
  primaryButton?: string;
  onPrimaryPress?: () => void;
  secondaryButton?: string;
  onSecondaryPress?: () => void;
  dismissable?: boolean;
  steps?: string[];
  primaryVariant?: ButtonVariant;
  autoDismissMs?: number;
  primaryLoading?: boolean;
  preventAutoHide?: boolean;
}

interface ModalContextValue {
  showModal: (opts: ShowModalOptions) => void;
  hideModal: () => void;
  updateModal: (opts: Partial<ShowModalOptions>) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useAppModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error('useAppModal must be used within a ModalProvider');
  }
  return ctx;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalProps, setModalProps] = useState<AppModalProps & { visible: boolean }>({
    visible: false,
    title: '',
    message: '',
    steps: [],
    primaryLoading: false,
  });

  const hideModal = useCallback(() => {
    setModalProps((prev) => ({ ...prev, visible: false }));
  }, []);

  const showModal = useCallback(
    (opts: ShowModalOptions) => {
      const {
        title,
        message,
        icon,
        primaryButton = 'Okay',
        onPrimaryPress,
        secondaryButton,
        onSecondaryPress,
        dismissable = true,
        steps = [],
        primaryVariant = 'default',
        autoDismissMs,
        primaryLoading = false,
        preventAutoHide = false,
      } = opts;

      setModalProps({
        visible: true,
        title,
        message,
        icon,
        primaryButton,
        secondaryButton,
        dismissable,
        steps,
        primaryVariant,
        autoDismissMs,
        primaryLoading,
        onPrimaryPress: () => {
          onPrimaryPress?.();
          if (!preventAutoHide) hideModal();
        },
        onSecondaryPress: () => {
          onSecondaryPress?.();
          hideModal();
        },
        onDismiss: () => {
          hideModal();
        },
      });
    },
    [hideModal],
  );

  const updateModal = useCallback((opts: Partial<ShowModalOptions>) => {
    setModalProps((prev) => ({
      ...prev,
      ...opts,
    }));
  }, []);

  return (
    <ModalContext.Provider value={{ showModal, hideModal, updateModal }}>
      {children}
      <AppModal
        visible={modalProps.visible}
        title={modalProps.title}
        message={modalProps.message}
        icon={modalProps.icon}
        primaryButton={modalProps.primaryButton}
        secondaryButton={modalProps.secondaryButton}
        dismissable={modalProps.dismissable}
        steps={modalProps.steps}
        primaryVariant={modalProps.primaryVariant}
        autoDismissMs={modalProps.autoDismissMs}
        primaryLoading={modalProps.primaryLoading}
        onPrimaryPress={modalProps.onPrimaryPress}
        onSecondaryPress={modalProps.onSecondaryPress}
        onDismiss={modalProps.onDismiss}
      />
    </ModalContext.Provider>
  );
}
