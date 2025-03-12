"use client";

import React from 'react';
import { Modal } from 'antd';
import { LoginForm } from './LoginForm';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
      destroyOnClose
      centered
    >
      <LoginForm onClose={onClose} />
    </Modal>
  );
} 