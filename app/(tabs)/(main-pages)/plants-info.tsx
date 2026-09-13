import { useEffect, useState } from 'react'
import { Card, H3, Image, Text, YStack } from 'tamagui'
// 成長ポイントをローカル管理してみる
const stages = [
    { min: 0, name: '種', image: '/images/tree-1.png' },
    { min: 100, name: '芽', image: '/images/tree-2.png' },
    { min: 300, name: '若木', image: '/images/tree-3.png' },
    { min: 600, name: '成木', image: '/images/tree-4.png' },
]

export default function TreeGrowthScreen() {
    const [points, setPoints] = useState(0)

    useEffect(() => {
        const savedPoints = Number(localStorage.getItem('treePoints'))
        setPoints(savedPoints || 0)
    }, [])

    const stage =
        [...stages].reverse().find((item) => points >= item.min) ?? stages[0]

    return (
        <YStack flex={1} items="center" gap="$6" px="$5" pt="$6" bg="$background">
            <Card
                width="100%"
                maxWidth={500}
                size="$4"
                borderWidth={1}
                borderColor="$borderColor"
            >
                <Card.Header p="$4" gap="$4">
                    <H3>木の成長状況</H3>
                    <YStack items="center" gap="$3">
                        <Image
                            source={{ uri: stage.image }}
                            width={250}
                            height={250}
                            objectFit="contain"
                        />
                        <Text fontSize="$6" fontWeight="700">
                            {stage.name}
                        </Text>
                        <Text color="$color10">
                            {points} pt
                        </Text>
                    </YStack>
                </Card.Header>
            </Card>
        </YStack>
    )
}
