import { SmartTransactionForm } from './SmartTransactionForm';

interface NewTransactionWizardProps {
  open: boolean;
  onClose: () => void;
  defaultMonth?: number;
  defaultYear?: number;
}

export function NewTransactionWizard({ open, onClose, defaultMonth, defaultYear }: NewTransactionWizardProps) {
  return (
    <SmartTransactionForm
      open={open}
      onClose={onClose}
      defaultMonth={defaultMonth}
      defaultYear={defaultYear}
    />
  );
}
