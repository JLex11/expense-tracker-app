import { database } from "@/database";
import type Category from "@/database/models/Category";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#0a7ea4";

export default function TransactScreen() {
	const insets = useSafeAreaInsets();
	const [amount, setAmount] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [date, setDate] = useState(new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [paymentMethod, setPaymentMethod] = useState("card");
	const [note, setNote] = useState("");
	const [categories, setCategories] = useState<Category[]>([]);

	useEffect(() => {
		database.get<Category>("categories").query().fetch().then(setCategories);
	}, []);

	const handleSave = async () => {
		if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
			Alert.alert("Error", "Please enter a valid amount greater than 0");
			return;
		}
		if (!selectedCategory) {
			Alert.alert("Error", "Please select a category");
			return;
		}
		try {
			await database.write(async () => {
				await database.get("expenses").create((expense: any) => {
					expense.amount = Number(amount);
					expense.categoryId = selectedCategory;
					expense.date = date.getTime();
					expense.note = note;
					expense.paymentMethod = paymentMethod;
				});
			});
			Alert.alert("Success", "Expense saved!");
			setAmount("");
			setNote("");
			setSelectedCategory(null);
		} catch (e) {
			console.error(e);
			Alert.alert("Error", "Failed to save expense");
		}
	};

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
		>
			{/* Amount */}
			<View style={styles.amountSection}>
				<Text style={styles.amountLabel}>Amount</Text>
				<View style={styles.amountRow}>
					<Text style={styles.currency}>$</Text>
					<TextInput
						style={styles.amountInput}
						value={amount}
						onChangeText={setAmount}
						keyboardType="decimal-pad"
						placeholder="0.00"
						placeholderTextColor="#D1D5DB"
					/>
				</View>
			</View>

			{/* Category */}
			<View style={styles.section}>
				<Text style={styles.sectionLabel}>Category</Text>
				<View style={styles.categoryGrid}>
					{categories.map((cat) => {
						const isSelected = selectedCategory === cat.id;
						return (
							<TouchableOpacity
								key={cat.id}
								onPress={() => setSelectedCategory(cat.id)}
								style={[
									styles.categoryItem,
									isSelected
										? styles.categoryItemSelected
										: styles.categoryItemUnselected,
								]}
								activeOpacity={0.7}
							>
								<Ionicons
									name={cat.icon as any}
									size={28}
									color={isSelected ? "white" : "#6B7280"}
								/>
								<Text
									style={[
										styles.categoryText,
										isSelected && styles.categoryTextSelected,
									]}
								>
									{cat.name}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>

			{/* Details */}
			<View style={styles.section}>
				<Text style={styles.sectionLabel}>Details</Text>
				<View style={styles.detailsCard}>
					<View style={styles.detailRow}>
						<Text style={styles.detailLabel}>Date</Text>
						<TouchableOpacity
							onPress={() => setShowDatePicker(true)}
							style={styles.dateButton}
						>
							<Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
						</TouchableOpacity>
					</View>
					{showDatePicker && (
						<DateTimePicker
							value={date}
							mode="date"
							display="default"
							onChange={(event, selectedDate) => {
								setShowDatePicker(false);
								if (selectedDate) setDate(selectedDate);
							}}
						/>
					)}
					<View style={[styles.detailRow, styles.detailRowTop]}>
						<Text style={styles.detailLabel}>Method</Text>
						<View style={styles.methodRow}>
							{["cash", "card", "transfer"].map((method) => (
								<TouchableOpacity
									key={method}
									onPress={() => setPaymentMethod(method)}
									style={[
										styles.methodOption,
										paymentMethod === method && styles.methodOptionActive,
									]}
								>
									<Text
										style={[
											styles.methodText,
											paymentMethod === method && styles.methodTextActive,
										]}
									>
										{method}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>
				</View>

				<TextInput
					style={styles.noteInput}
					placeholder="Add a note..."
					placeholderTextColor="#9CA3AF"
					value={note}
					onChangeText={setNote}
				/>
			</View>

			<TouchableOpacity
				style={styles.saveButton}
				onPress={handleSave}
				activeOpacity={0.8}
			>
				<Text style={styles.saveButtonText}>Save Expense</Text>
			</TouchableOpacity>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff" },
	content: { paddingBottom: 100, paddingHorizontal: 20 },
	amountSection: { marginBottom: 40, alignItems: "center" },
	amountLabel: {
		color: "#9CA3AF",
		fontSize: 16,
		fontWeight: "500",
		marginBottom: 8,
		letterSpacing: 1,
	},
	amountRow: {
		flexDirection: "row",
		alignItems: "center",
		borderBottomWidth: 1,
		borderBottomColor: "#E5E7EB",
		paddingBottom: 8,
	},
	currency: {
		fontSize: 48,
		fontWeight: "bold",
		color: "#1F2937",
		marginRight: 8,
	},
	amountInput: {
		fontSize: 56,
		fontWeight: "bold",
		color: "#1F2937",
		padding: 0,
		minWidth: 100,
		textAlign: "center",
	},
	section: { marginBottom: 32 },
	sectionLabel: {
		fontSize: 12,
		fontWeight: "bold",
		color: "#9CA3AF",
		marginBottom: 16,
		textTransform: "uppercase",
		letterSpacing: 2,
		paddingLeft: 4,
	},
	categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
	categoryItem: {
		padding: 16,
		borderRadius: 24,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
		width: "30%",
		aspectRatio: 1,
	},
	categoryItemSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
	categoryItemUnselected: {
		backgroundColor: "#F9FAFB",
		borderColor: "#F3F4F6",
	},
	categoryText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#4B5563",
		marginTop: 4,
	},
	categoryTextSelected: { color: "white" },
	detailsCard: {
		backgroundColor: "#F9FAFB",
		borderRadius: 24,
		padding: 20,
		borderWidth: 1,
		borderColor: "#F3F4F6",
		marginBottom: 16,
	},
	detailRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	detailRowTop: {
		borderTopWidth: 1,
		borderTopColor: "#E5E7EB",
		paddingTop: 20,
		marginTop: 20,
	},
	detailLabel: { color: "#4B5563", fontWeight: "500" },
	dateButton: {
		backgroundColor: "white",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#F3F4F6",
	},
	dateText: { color: "#1F2937", fontWeight: "600" },
	methodRow: {
		flexDirection: "row",
		backgroundColor: "#E5E7EB",
		borderRadius: 12,
		padding: 4,
	},
	methodOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
	methodOptionActive: { backgroundColor: "white" },
	methodText: {
		fontSize: 14,
		textTransform: "capitalize",
		color: "#6B7280",
		fontWeight: "500",
	},
	methodTextActive: { fontWeight: "bold", color: "#1F2937" },
	noteInput: {
		backgroundColor: "#F9FAFB",
		borderRadius: 24,
		padding: 20,
		borderWidth: 1,
		borderColor: "#F3F4F6",
		color: "#1F2937",
		fontWeight: "500",
	},
	saveButton: {
		backgroundColor: PRIMARY,
		paddingVertical: 20,
		borderRadius: 24,
		alignItems: "center",
	},
	saveButtonText: { color: "white", fontWeight: "bold", fontSize: 18 },
});
