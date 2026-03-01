import { database } from "@/database";
import type Category from "@/database/models/Category";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "@/tw";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
      className="flex-1 bg-white"
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: 100,
        paddingHorizontal: 20,
      }}
    >
      <View className="mb-10 items-center">
        <Text className="mb-2 text-base font-medium tracking-[1px] text-gray-400">Amount</Text>
        <View className="flex-row items-center border-b border-gray-200 pb-2">
          <Text className="mr-2 text-5xl font-bold text-gray-800">$</Text>
          <TextInput
            className="min-w-[100px] p-0 text-center text-[56px] font-bold text-gray-800"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#D1D5DB"
          />
        </View>
      </View>

      <View className="mb-8">
        <Text className="mb-4 pl-1 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
          Category
        </Text>

        <View className="flex-row flex-wrap gap-3">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                className={`aspect-square w-[30%] items-center justify-center rounded-3xl border p-4 ${
                  isSelected ? "border-primary bg-primary" : "border-gray-100 bg-gray-50"
                }`}
                activeOpacity={0.7}
              >
                <Ionicons name={cat.icon as any} size={28} color={isSelected ? "white" : "#6B7280"} />
                <Text className={`mt-1 text-xs font-semibold ${isSelected ? "text-white" : "text-gray-600"}`}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View className="mb-8">
        <Text className="mb-4 pl-1 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
          Details
        </Text>

        <View className="mb-4 rounded-3xl border border-gray-100 bg-gray-50 p-5">
          <View className="flex-row items-center justify-between">
            <Text className="font-medium text-gray-600">Date</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="rounded-xl border border-gray-100 bg-white px-4 py-2"
            >
              <Text className="font-semibold text-gray-800">{date.toLocaleDateString()}</Text>
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

          <View className="mt-5 border-t border-gray-200 pt-5">
            <View className="flex-row items-center justify-between">
              <Text className="font-medium text-gray-600">Method</Text>

              <View className="flex-row rounded-xl bg-gray-200 p-1">
                {["cash", "card", "transfer"].map((method) => {
                  const isActive = paymentMethod === method;
                  return (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setPaymentMethod(method)}
                      className={`rounded-lg px-4 py-2 ${isActive ? "bg-white" : ""}`}
                    >
                      <Text
                        className={`text-sm capitalize ${
                          isActive ? "font-bold text-gray-800" : "font-medium text-gray-500"
                        }`}
                      >
                        {method}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        <TextInput
          className="rounded-3xl border border-gray-100 bg-gray-50 p-5 font-medium text-gray-800"
          placeholder="Add a note..."
          placeholderTextColor="#9CA3AF"
          value={note}
          onChangeText={setNote}
        />
      </View>

      <TouchableOpacity className="items-center rounded-3xl bg-primary py-5" onPress={handleSave} activeOpacity={0.8}>
        <Text className="text-lg font-bold text-white">Save Expense</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
