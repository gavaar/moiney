import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type ModalContextType = {
  open: (children: ReactNode) => void;
  close: () => void;
};

export const ModalContext = createContext<ModalContextType | null>(null);

export function useModalState() {
  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);

  const open = useCallback((node: ReactNode) => {
    setContent(node);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, content, open, close };
}

export function useModal(): ModalContextType {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return ctx;
}
