import React from 'react';
import { useAppModal } from '@/hooks/use-app-modal';

interface ErrorModalProps {
  visible: boolean;
  message: string;
  onClose: () => void;
}

export const ErrorModal = ({ visible, message, onClose }: ErrorModalProps) => {
  const { showModal, hideModal } = useAppModal();

  React.useEffect(() => {
    if (visible) {
      showModal({
        title: 'Pairing Failed',
        message,
        icon: 'error',
        primaryButton: 'Got it',
        onPrimaryPress: () => {
          onClose();
          hideModal();
        },
      });
    }
    return () => {
      if (visible) {
        hideModal();
      }
    };
  }, [visible, message, onClose, showModal, hideModal]);

  return null;
};
