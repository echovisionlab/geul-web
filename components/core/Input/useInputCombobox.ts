import { useCallback, useState } from 'react';

export interface InputComboboxController {
  dropdownOpened: boolean;
  openDropdown: () => void;
  closeDropdown: () => void;
  toggleDropdown: () => void;
}
export function useInputCombobox({
  defaultOpened = false,
  onDropdownOpen,
  onDropdownClose,
}: {
  defaultOpened?: boolean;
  onDropdownOpen?: () => void;
  onDropdownClose?: () => void;
} = {}): InputComboboxController {
  const [dropdownOpened, setOpened] = useState(defaultOpened);
  const openDropdown = useCallback(() => {
    setOpened(true);
    onDropdownOpen?.();
  }, [onDropdownOpen]);
  const closeDropdown = useCallback(() => {
    setOpened(false);
    onDropdownClose?.();
  }, [onDropdownClose]);
  return { dropdownOpened, openDropdown, closeDropdown, toggleDropdown: dropdownOpened ? closeDropdown : openDropdown };
}
