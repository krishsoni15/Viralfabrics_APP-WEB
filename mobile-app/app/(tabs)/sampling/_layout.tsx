import { Stack } from 'expo-router';

export default function SamplingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[weaverId]" />
    </Stack>
  );
}
