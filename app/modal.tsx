import { Link } from "expo-router";
import { useI18n } from "@/hooks/useI18n";

import { Text, TouchableOpacity, View } from "@/tw";

export default function ModalScreen() {
	const { t } = useI18n();
	return (
		<View className="flex-1 items-center justify-center px-5">
			<Text className="text-3xl font-bold text-gray-900">{t("modalTitle")}</Text>
			<Link href="/" dismissTo asChild>
				<TouchableOpacity className="mt-4 py-3">
					<Text className="text-base font-semibold text-blue-500">
						{t("modalGoHome")}
					</Text>
				</TouchableOpacity>
			</Link>
		</View>
	);
}
