<script setup>
import Headers from './components/headers.vue'
import { useGlobalStore } from './store'

const globalStore = useGlobalStore()
globalStore.getConfig()
globalStore.getServerPort()
globalStore.fetchSetsList()
globalStore.fetchPicsList()
</script>

<template>
  <headers />
  <div class="mx-auto w-[95%] 2xl:w-[90%] mt-3">
    <router-view />
  </div>
</template>
