export const gameData = {
  title: "Wander Farm",
  subtitle: "A little quest is waiting at the end.",
  startPrompt: "Can you make it there?",
  ending: {
    title: "The Last Memory",
    copy: "The farmhouse lights stay on while the whole field settles into a quiet, golden evening.",
    femaleMessage: "I knew you were a farm baddie.",
    maleMessage: "You made the farm proud."
  },
  stages: {
    adventure: {
      name: "The First Path",
      objective: "Find the trail and keep moving."
    },
    catch: {
      name: "Falling Skies",
      objective: "Catch what helps. Dodge what does not."
    },
    memory: {
      name: "Memory Barn",
      objective: "Match the farm pairs before the lantern fades.",
      duration: 90000,
      pairRange: { min: 8, max: 10 },
      cards: [
        { key: "apple", icon: "&#127822;", label: "apple" },
        { key: "bee", icon: "&#128029;", label: "bee" },
        { key: "chicken", icon: "&#128020;", label: "chicken" },
        { key: "flower", icon: "&#127799;", label: "tulip" },
        { key: "carrot", icon: "&#129365;", label: "carrot" },
        { key: "cow", icon: "&#128004;", label: "cow" },
        { key: "tractor", icon: "&#128668;", label: "tractor" },
        { key: "sunflower", icon: "&#127803;", label: "sunflower" },
        { key: "strawberry", icon: "&#127827;", label: "strawberry" },
        { key: "watering-can", icon: "&#128167;", label: "watering can" }
      ]
    },
    defend: {
      name: "Defend the Farmhouse",
      farmhouseHearts: 6,
      appleInterval: 500,
      powerUps: {
        dropChance: 0.46,
        wave2GlowDropRange: { min: 2, max: 3 },
        wave3GoldenAppleCount: 2,
        wave3HeartCount: 2,
        wave3BombDropRange: { min: 1, max: 2 },
        doubleShotDuration: 6000,
        tripleShotDuration: 6000,
        glowingApple: "glowing-apple",
        goldenApple: "golden-apple",
        heart: "heart",
        eggBomb: "egg-bomb"
      },
      boss: {
        name: "The Raccoon King",
        difficulties: {
          easy: {
            label: "Easy",
            hp: 28,
            attackInterval: 1750,
            phaseTwoAttackInterval: 1150,
            phaseTwoCrowInterval: 2500,
            reward: 15,
            stagePoints: 80,
            waveSpawnMultiplier: 1.28,
            enemySpeedMultiplier: 0.76,
            description: "A gentler first win."
          },
          medium: {
            label: "Medium",
            hp: 36,
            attackInterval: 1450,
            phaseTwoAttackInterval: 850,
            phaseTwoCrowInterval: 1950,
            reward: 30,
            stagePoints: 110,
            waveSpawnMultiplier: 1.12,
            enemySpeedMultiplier: 0.88,
            description: "A steady farm fight."
          },
          hard: {
            label: "Hard",
            hp: 45,
            attackInterval: 1200,
            phaseTwoAttackInterval: 650,
            phaseTwoCrowInterval: 1500,
            reward: 50,
            stagePoints: 140,
            waveSpawnMultiplier: 1,
            enemySpeedMultiplier: 1,
            description: "The original full-strength king."
          }
        }
      },
      waves: [
        {
          id: 1,
          duration: 20000,
          startingSpawnInterval: 1150,
          fastestSpawnInterval: 650,
          enemies: ["crow"]
        },
        {
          id: 2,
          duration: 25000,
          startingSpawnInterval: 820,
          fastestSpawnInterval: 450,
          enemies: ["crow", "fox"],
          foxChance: 0.32
        },
        {
          id: 3,
          duration: 23000,
          startingSpawnInterval: 660,
          fastestSpawnInterval: 410,
          enemies: ["crow", "fox", "locust"],
          foxChance: 0.25,
          locustChance: 0.22,
          healthBoost: 2
        }
      ]
    }
  }
};
