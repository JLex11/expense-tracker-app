import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
	const colorScheme = useColorScheme();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
				headerShown: false,
				tabBarButton: HapticTab,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color }) => (
						<Ionicons size={28} name="home" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="transact"
				options={{
					title: "Transact",
					tabBarIcon: ({ color }) => (
						<Ionicons size={28} name="add-circle" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="budget"
				options={{
					title: "Budget",
					tabBarIcon: ({ color }) => (
						<Ionicons size={28} name="pie-chart" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: "Profile",
					tabBarIcon: ({ color }) => (
						<Ionicons size={28} name="person" color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
