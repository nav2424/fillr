import { Redirect, useLocalSearchParams } from 'expo-router'

export default function JoinRoute() {
  const { ref } = useLocalSearchParams<{ ref?: string }>()
  return <Redirect href={{ pathname: '/onboarding', params: ref ? { ref } : {} }} />
}

