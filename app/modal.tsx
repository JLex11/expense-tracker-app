import { Link } from "expo-router";

import { Text, TouchableOpacity, View } from "@/tw";

export default function ModalScreen() {
	return (
		<View className="flex-1 items-center justify-center px-5">
			<Text className="text-3xl font-bold text-gray-900">This is a modal</Text>
			<Link href="/" dismissTo asChild>
				<TouchableOpacity className="mt-4 py-3">
					<Text className="text-base font-semibold text-blue-500">
						Go to home screen
					</Text>
				</TouchableOpacity>
			</Link>
		</View>
	);
}
