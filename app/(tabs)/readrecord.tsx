import { Button, Card, H2, H3, Input, XStack, YStack } from 'tamagui'
import { Plus } from '@tamagui/lucide-icons-2'

export default function TabTwoScreen() {
  return (
    <YStack flex={1} items="center" gap="$6" px="$5" pt="$6" bg="$background">
      <Card width="100%" maxWidth={500} size="$4" borderWidth={1} borderColor="$borderColor">
        <Card.Header p="$4" gap="$1">
          <H3>進捗状況を更新</H3>
          <XStack items="center" gap="$2" width="100%" pt="$3">
            <Button icon={Plus} iconSize="$4" size="$5">
              書籍を選択
            </Button>
            <Input
              theme="surface1"
              flex={1}
              size="$5"
              placeholder="今回読んだページ数を入力"
            />
            <Button size="$5">登録</Button>
          </XStack>
        </Card.Header>
      </Card>
    </YStack>
  )
}
