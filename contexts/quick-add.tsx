import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";

interface QuickAddContextType {
	visible: boolean;
	open: () => void;
	close: () => void;
}

const QuickAddContext = createContext<QuickAddContextType | null>(null);

/** Global ref so code outside the provider (e.g. quick actions) can open the dialog. */
export const quickAddGlobal: { open: (() => void) | null } = { open: null };

export function QuickAddProvider({ children }: { children: ReactNode }) {
	const [visible, setVisible] = useState(false);

	const open = useCallback(() => setVisible(true), []);
	const close = useCallback(() => setVisible(false), []);

	useEffect(() => {
		quickAddGlobal.open = open;
		return () => {
			quickAddGlobal.open = null;
		};
	}, [open]);

	return (
		<QuickAddContext.Provider value={{ visible, open, close }}>
			{children}
		</QuickAddContext.Provider>
	);
}

export function useQuickAdd() {
	const ctx = useContext(QuickAddContext);
	if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider");
	return ctx;
}
