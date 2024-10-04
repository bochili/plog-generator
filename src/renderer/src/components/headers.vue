<script setup>
import router from '../router'
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { IconCodeSquare, IconEye, IconPlayArrow, IconStop } from '@arco-design/web-vue/es/icon'
import { useGlobalStore } from '../store'
import { Message } from '@arco-design/web-vue'

const globalStore = useGlobalStore()
const route = useRoute()
watch(route, (to, from) => {
  console.log('路由变化:', to.path, from.path)
  key.value = to.path
  // 在这里处理路由变化的逻辑
})
const key = ref(route.path)
const exportModalVisible = ref(false)
const generating = ref(false)
const generateSite = async () => {
  if (!globalStore.config.template) return Message.error('请在设置中选择前端模板')
  if (selectedPath.value === '') return (exportModalVisible.value = true)
  sendGenerate()
}
const sendGenerate = async () => {
  generating.value = true
  const res = await window.electron.ipcRenderer.invoke(
    'generate',
    selectedPath.value
  )
  if (res) {
    Message.success('站点生成成功！')
  } else {
    Message.error('站点生成失败！')
  }
  generating.value = false
}
const previewStatus = ref(0)
const selectedPath = ref('')
const starting = ref(false)
const selectExportPath = async () => {
  const paths = await window.electron.ipcRenderer.invoke('dialog:openDirectory')
  if (paths.length > 0) {
    selectedPath.value = `${paths[0]}`
  }
}
const handleExportOK = async () => {
  if (selectedPath.value === '') return Message.error('请选择导出路径')
  exportModalVisible.value = false
  sendGenerate()
}
const runPreview = async () => {
  starting.value = true
  const res = await window.electron.ipcRenderer.invoke(
    'start:preview',
    selectedPath.value
  )
  if (res) {
    Message.success('预览启动成功！')
  } else {
    Message.error('预览启动失败！')
  }
  starting.value = false
  getPreviewStatus()
}
const stopPreview = async () => {
  starting.value = true
  const res = await window.electron.ipcRenderer.invoke('stop:preview')
  if (res) {
    Message.success('已停止！')
  } else {
    Message.error('停止失败！')
  }
  starting.value = false
  getPreviewStatus()
}
const openSiteFolder = () => {
  window.electron.ipcRenderer.send(
    'open-folder',
    selectedPath.value
  )
}
const getPreviewStatus = async () => {
  previewStatus.value = await window.electron.ipcRenderer.invoke('get:preview')
}
onMounted(() => {
  key.value = route.path
  getPreviewStatus()
  selectedPath.value = globalStore.config?.exportPath
})
globalStore.$subscribe(() => {
  selectedPath.value = globalStore.config?.exportPath
})
</script>

<template>
  <a-modal :visible="exportModalVisible" @cancel="exportModalVisible=false" @close="exportModalVisible = false"
           @ok="handleExportOK">
    <template #title>请设置</template>
    <a-form>
      <a-form-item field="exportPath" label="站点生成位置" validate-trigger="input" required>
        <a-input v-model="selectedPath" placeholder="请输入本机绝对路径" />
        <a-button type="primary" class="ml-3" @click="selectExportPath">
          <template #icon>
            <icon-eye />
          </template>
          浏览
        </a-button>
        <template #extra>
          <div>生成站点静态文件的存放位置，设置之后每次生成站点将不再询问保存路径。</div>
        </template>
      </a-form-item>
    </a-form>
  </a-modal>
  <div class="flex justify-between items-center">
    <a-menu mode="horizontal" :default-selected-keys="['1']" :selected-keys="[key]">
      <a-menu-item key="/" @click="router.push('/')">图库</a-menu-item>
      <a-menu-item key="/sets" @click="router.push('/sets')">影集</a-menu-item>
      <a-menu-item key="/setting" @click="router.push('/setting')">设置</a-menu-item>
    </a-menu>
    <a-button
      class="mr-2"
      type="primary"
      status="danger"
      :loading="generating"
      @click="generateSite"
    >
      <template #icon>
        <icon-code-square />
      </template>
      生成站点
    </a-button>
    <a-button
      v-if="selectedPath"
      class="mr-2"
      type="primary"
      @click="openSiteFolder"
    >
      站点目录
    </a-button>
    <a-button
      v-if="
        !previewStatus &&
        selectedPath
      "
      class="mr-5"
      type="primary"
      status="success"
      :loading="starting"
      @click="runPreview"
    >
      <template #icon>
        <icon-play-arrow />
      </template>
      运行
    </a-button>
    <a-button
      v-if="previewStatus"
      class="mr-5"
      type="primary"
      status="warning"
      :loading="starting"
      @click="stopPreview"
    >
      <template #icon>
        <icon-stop />
      </template>
      停止 (127.0.0.1:{{previewStatus}})
    </a-button>
  </div>
</template>

<style scoped></style>
