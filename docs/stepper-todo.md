# Stepper TODO

Reference always the Nuxt UI documentation in AGENTS.md.

- The step registrazione should have for content the panel with the list of players in the waiting list on the left and the panel with the list of players approved on the right.

```
<template #content="{ item }">
  [waiting list panel] [approved list panel]
</template>
```

- An approved player can be moved to the waiting list and viceversa.

1. Add a button to go to the next round
   1. going to the next round should trigger a modal to confirm the action
   2. going to the next round should trigger the creation of the matches for the next round
2. Add a button to go to the previous round without any modification
3. Add a button to go to reverse the current round and reset all results
4. Add a button to go to the current round
5. 
