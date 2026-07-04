import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppModal, AppModalProps, AppModalIcon } from '@/components/ui/app-modal';

interface ShowModalOptions {
  title: string;
  message: string;
  icon?: AppModalIcon;
  primaryButton?: string;
  onPrimaryPress?: () => void;
  secondaryButton?: string;
  onSecondaryPress?: () => void;
  dismissable?: boolean;
}

interface ModalContextValue {
  showModal: (opts: ShowModalOptions) => void;
  hideModal: () => void;
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
      } = opts;

      setModalProps({
        visible: true,
        title,
        message,
        icon,
        primaryButton,
        secondaryButton,
        dismissable,
        onPrimaryPress: () => {
          onPrimaryPress?.();
          hideModal();
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

  return (
    <ModalContext.Provider value={{ showModal, hideModal }}>
      {children}
      <AppModal
        visible={modalProps.visible}
        title={modalProps.title}
        message={modalProps.message}
        icon={modalProps.icon}
        primaryButton={modalProps.primaryButton}
        secondaryButton={modalProps.secondaryButton}
        dismissable={modalProps.dismissable}
        onPrimaryPress={modalProps.onPrimaryPress}
        onSecondaryPress={modalProps.onSecondaryPress}
        onDismiss={modalProps.onDismiss}
      />
    </ModalContext.Provider>
  );
}
