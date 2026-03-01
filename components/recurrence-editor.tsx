import type { RecurrenceUnit } from "@/types/expenses";
import { Text, TextInput, TouchableOpacity, View } from "@/tw";
import { RECURRENCE_UNITS, formatRecurrenceSummary } from "@/utils/recurrence";

const UNIT_LABELS: Record<RecurrenceUnit, string> = {
	day: "Día",
	week: "Semana",
	month: "Mes",
};

interface RecurrenceEditorProps {
	intervalValue: string;
	intervalUnit: RecurrenceUnit;
	onChangeIntervalValue: (value: string) => void;
	onChangeIntervalUnit: (unit: RecurrenceUnit) => void;
	helperText?: string;
	disabled?: boolean;
}

export default function RecurrenceEditor({
	intervalValue,
	intervalUnit,
	onChangeIntervalValue,
	onChangeIntervalUnit,
	helperText,
	disabled = false,
}: RecurrenceEditorProps) {
	const summaryValue = Number.parseInt(intervalValue, 10);

	return (
		<View className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
			<Text className="mb-3 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
				Recurrencia
			</Text>

			<View className="mb-3 flex-row items-center gap-3">
				<View className="w-20 rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
					<Text className="mb-1 text-[11px] font-semibold uppercase tracking-[1px] text-gray-400">
						Cada
					</Text>
					<TextInput
						value={intervalValue}
						onChangeText={onChangeIntervalValue}
						keyboardType="number-pad"
						editable={!disabled}
						className="p-0 text-lg font-bold text-gray-900"
					/>
				</View>

				<View className="flex-1 flex-row gap-2">
					{RECURRENCE_UNITS.map((unit) => {
						const isActive = unit === intervalUnit;
						return (
							<TouchableOpacity
								key={unit}
								onPress={() => onChangeIntervalUnit(unit)}
								disabled={disabled}
								activeOpacity={0.8}
								className={`flex-1 rounded-2xl px-3 py-3 ${
									isActive
										? "bg-primary"
										: "border border-gray-200 bg-white"
								}`}
							>
								<Text
									className={`text-center text-sm font-semibold ${
										isActive ? "text-white" : "text-gray-600"
									}`}
								>
									{UNIT_LABELS[unit]}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>

			{summaryValue > 0 && (
				<Text className="mb-1 text-sm font-semibold text-gray-700">
					{formatRecurrenceSummary(summaryValue, intervalUnit)}
				</Text>
			)}

			{helperText ? (
				<Text className="text-sm leading-5 text-gray-500">{helperText}</Text>
			) : null}
		</View>
	);
}
