import { database } from "@/database";
import type Category from "@/database/models/Category";
import { useExpenses } from "@/hooks/useExpenses";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "@/tw";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FilterType = "today" | "week" | "month" | "custom";
const FILTERS: { key: FilterType; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const expenses = useExpenses();
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<FilterType>("month");
  const [searchQuery, setSearchQuery] = useState("");

  React.useEffect(() => {
    database.get<Category>("categories").query().fetch().then(setCategories);
  }, []);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return expenses
      .filter((exp) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const cat = categories.find((c) => c.id === exp.categoryId);
          if (!exp.note?.toLowerCase().includes(q) && !cat?.name.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (filter === "today") return exp.date >= startOfToday;
        if (filter === "week") return exp.date >= startOfWeek.getTime();
        if (filter === "month") return exp.date >= startOfMonth;
        return true;
      })
      .sort((a, b) => b.date - a.date);
  }, [expenses, filter, searchQuery, categories]);

  const groupedExpenses = useMemo(() => {
    const groups: Record<string, typeof expenses> = {};
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfYesterday = startOfToday - 86400000;

    filteredExpenses.forEach((exp) => {
      let groupName = "";
      if (exp.date >= startOfToday) groupName = "TODAY";
      else if (exp.date >= startOfYesterday) groupName = "YESTERDAY";
      else {
        groupName = new Date(exp.date)
          .toLocaleDateString(undefined, { month: "short", day: "numeric" })
          .toUpperCase();
      }

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(exp);
    });

    return groups;
  }, [filteredExpenses]);

  const handleDelete = (id: string) => {
    Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await database.write(async () => {
              const expense = await database.get("expenses").find(id);
              await (expense as any).destroyPermanently();
            });
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between border-b border-gray-100 px-5 pb-3 pt-4">
        <Text className="text-2xl font-bold text-gray-900">Expense History</Text>
        <TouchableOpacity className="h-10 w-10 items-center justify-center rounded-full bg-blue-50">
          <Ionicons name="add" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <View className="border-b border-gray-100 bg-white px-5 py-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="mb-3 flex-row gap-2"
        >
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                className={`rounded-full px-4 py-2 ${isActive ? "bg-blue-500" : "bg-gray-100"}`}
              >
                <Text
                  className={`font-medium capitalize ${isActive ? "text-white" : "text-gray-500"}`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View className="flex-row items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            className="flex-1 text-sm font-medium text-gray-800"
            placeholder="Search by notes or category..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerClassName="pb-24">
        {Object.entries(groupedExpenses).map(([groupName, exps]) => (
          <View key={groupName} className="mt-6 px-5">
            <Text className="mb-3 text-[12px] font-bold tracking-[2px] text-gray-400">{groupName}</Text>
            <View className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
              {exps.map((exp, index) => {
                const cat = categories.find((c) => c.id === exp.categoryId);
                const isLast = index === exps.length - 1;
                const timeText = new Date(exp.date).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <TouchableOpacity
                    key={exp.id}
                    onLongPress={() => handleDelete(exp.id)}
                    delayLongPress={500}
                    className={`flex-row items-center bg-white p-4 ${!isLast ? "border-b border-gray-100" : ""}`}
                  >
                    <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-orange-50">
                      <Ionicons name={(cat?.icon || "help-circle") as any} size={24} color="#f59e0b" />
                    </View>

                    <View className="flex-1">
                      <Text className="mb-1 font-bold text-gray-900">{cat?.name || "Unknown"}</Text>
                      <Text numberOfLines={1} className="text-xs text-gray-400">
                        {exp.note || "No notes"}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text className="mb-1 font-bold text-gray-900">-${exp.amount.toFixed(2)}</Text>
                      <Text className="text-xs text-gray-400">{timeText}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {filteredExpenses.length === 0 && (
          <View className="items-center justify-center px-10 py-20">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-50">
              <Ionicons name="receipt-outline" size={40} color="#d1d5db" />
            </View>
            <Text className="text-center text-lg font-medium text-gray-500">No expenses found</Text>
            <Text className="mt-2 text-center text-gray-400">
              Try adjusting your filters or search query.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
