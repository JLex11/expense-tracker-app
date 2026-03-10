export function formatCurrency(
	amount: number,
	currency: string,
	options?: Intl.NumberFormatOptions,
) {
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			maximumFractionDigits: 2,
			...options,
		}).format(amount);
	} catch {
		return `${getCurrencySymbol(currency)}${amount.toFixed(2)}`;
	}
}

export function getCurrencySymbol(currency: string) {
	if (currency === "EUR") return "€";
	if (currency === "GBP") return "£";
	if (currency === "JPY" || currency === "CNY") return "¥";
	if (currency === "BRL") return "R$";
	if (currency === "INR") return "₹";
	return "$";
}
