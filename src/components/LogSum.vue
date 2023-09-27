<script setup>
const props = defineProps({
  tabs: Array,
  activeTabs: Array,
  loading: Boolean
})
</script>

<template>
  <Accordion :activeIndex="activeTabs" :multiple="true" class="w-full mb-2">
    <AccordionTab v-for="tab in tabs" :key="tab.title" :disabled="tab.disabled">
      <template #header>
        <i v-if="tab.latestTimestamp" class="pi pi-clock mr-2"></i>
        <span>{{ tab.latestTimestamp }}</span>
        <span v-if="tab.latestTimestamp" class="mx-2">•</span>
        <span>{{ tab.title }}</span>
        <ProgressSpinner
          v-if="loading"
          style="width: 1rem; height: 1rem; margin: 0 1rem"
          strokeWidth="6"
          animationDuration=".8s"
        />
      </template>
      <div class="overflow-auto max-h-20rem">
        <ul>
          <li v-for="msg in tab.msgs" :key="msg.timestamp" v-html="msg.content"></li>
        </ul>
      </div>
    </AccordionTab>
  </Accordion>
</template>

<style scoped></style>
