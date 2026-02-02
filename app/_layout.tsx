import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Record Data" }} />
      <Stack.Screen
        name="model"
        options={{ title: "Activity Classification" }}
      />
    </Stack>
  );
}
